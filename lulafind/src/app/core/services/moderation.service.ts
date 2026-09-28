import { Injectable, computed, inject, signal } from '@angular/core';
import { KvStore } from '../data/local-db';
import { LULA_API } from '../data/api';
import { REPORT_REASONS, ReportTarget, UserReport, UserProfile } from '../models/types';
import { uid } from '../utils/format';
import { AuthService } from './auth.service';

export interface ReportInput {
  target: ReportTarget;
  targetId: string;
  summary: string;
  reason: string;
  detail?: string;
}

/**
 * Reports and admin actions.
 *
 * Any member can report a post, a comment or a person. Only a LulaFind admin
 * (the app owner / trust & safety team) can act on the queue: remove the post,
 * suspend or delete the account, or dismiss the report as unfounded.
 *
 * Reports are kept in the device store in mock mode. In Firebase mode this is
 * the `reports/{reportId}` collection - the service methods map 1:1 onto it.
 */
@Injectable({ providedIn: 'root' })
export class ModerationService {
  private api = inject(LULA_API);
  private auth = inject(AuthService);
  private store = new KvStore('lulafind.moderation');

  readonly reports = signal<UserReport[]>([]);
  readonly busy = signal(false);

  readonly reasons = REPORT_REASONS;

  readonly isAdmin = computed(() => this.auth.user()?.isAdmin === true);
  readonly openCount = computed(() => this.reports().filter((r) => r.status === 'open').length);
  readonly openReports = computed(() => this.reports().filter((r) => r.status === 'open'));

  constructor() {
    this.load();
  }

  load(): void {
    const list = this.store.get<UserReport[]>('reports', []);
    this.reports.set([...list].sort((a, b) => b.at - a.at));
  }

  /** Drop the local report queue (used by Settings → Reset demo data). */
  reset(): void {
    this.store.remove('reports');
    this.reports.set([]);
  }

  private persist(): void {
    this.store.set('reports', this.reports());
  }

  /* --------------------------- reporting --------------------------- */

  /** File a report. Duplicate reports on the same item by the same person merge. */
  async report(input: ReportInput): Promise<UserReport> {
    const me = this.auth.viewerId;
    if (!me) throw new Error('Sign in to report something');
    if (!input.reason) throw new Error('Choose a reason');

    const existing = this.reports().find(
      (r) => r.targetId === input.targetId && r.byUserId === me && r.status === 'open'
    );
    if (existing) throw new Error('You already reported this. Our team is on it.');

    const report: UserReport = {
      id: uid('rep'),
      target: input.target,
      targetId: input.targetId,
      summary: input.summary.slice(0, 140),
      reason: REPORT_REASONS.find((r) => r.id === input.reason)?.label ?? input.reason,
      detail: (input.detail ?? '').trim().slice(0, 600),
      byUserId: me,
      at: Date.now(),
      status: 'open',
      resolvedAt: null,
      adminNote: '',
      actionTaken: null
    };
    this.reports.set([report, ...this.reports()]);
    this.persist();
    return report;
  }

  hasReported(targetId: string): boolean {
    const me = this.auth.viewerId;
    return !!me && this.reports().some((r) => r.targetId === targetId && r.byUserId === me && r.status === 'open');
  }

  /* --------------------------- admin --------------------------- */

  private requireAdmin(): void {
    if (!this.isAdmin()) throw new Error('Only LulaFind admins can do that');
  }

  async resolve(reportId: string, status: 'actioned' | 'dismissed', adminNote: string, actionTaken: string | null): Promise<void> {
    this.requireAdmin();
    const next = this.reports().map((r) =>
      r.id === reportId
        ? { ...r, status, adminNote: adminNote.trim(), actionTaken, resolvedAt: Date.now() }
        : r
    );
    this.reports.set(next);
    this.persist();
  }

  /** Admin removes a post and closes every open report against it. */
  async removePost(postId: string, note: string): Promise<void> {
    this.requireAdmin();
    this.busy.set(true);
    try {
      const post = await this.api.post(postId);
      await this.api.deletePost(postId);
      const summary = post ? post.title : postId;
      this.reports.set(
        this.reports().map((r) =>
          r.targetId === postId && r.status === 'open'
            ? { ...r, status: 'actioned' as const, adminNote: note.trim(), actionTaken: 'Post removed', resolvedAt: Date.now() }
            : r
        )
      );
      this.persist();
      if (post) {
        await this.api.pushNotification({
          id: uid('n'),
          userId: post.authorId,
          kind: 'moderation',
          title: 'Your post was removed',
          body: note.trim() || 'A LulaFind admin removed this post. Read the community rules.',
          at: Date.now(),
          read: false,
          route: null,
          postId
        });
      }
      void summary;
    } finally {
      this.busy.set(false);
    }
  }

  /** Admin suspends a person: they keep their account but cannot post or chat. */
  async suspendUser(userId: string, note: string, suspended = true): Promise<void> {
    this.requireAdmin();
    const u = await this.api.user(userId);
    if (!u) throw new Error('That person no longer has an account');
    if (u.isAdmin) throw new Error('You cannot suspend another admin');
    await this.api.saveUser({ ...u, suspended });
    this.reports.set(
      this.reports().map((r) =>
        r.targetId === userId && r.status === 'open'
          ? { ...r, status: 'actioned' as const, adminNote: note.trim(), actionTaken: suspended ? 'Account suspended' : 'Suspension lifted', resolvedAt: Date.now() }
          : r
      )
    );
    this.persist();
    await this.api.pushNotification({
      id: uid('n'),
      userId,
      kind: 'moderation',
      title: suspended ? 'Your account is suspended' : 'Your account is active again',
      body: note.trim() || (suspended ? 'A LulaFind admin suspended your account.' : 'You can post and chat again.'),
      at: Date.now(),
      read: false,
      route: null,
      postId: null
    });
  }

  /** Admin deletes a person and everything they posted. */
  async removeUser(userId: string, note: string): Promise<void> {
    this.requireAdmin();
    const u = await this.api.user(userId);
    if (!u) throw new Error('That person no longer has an account');
    if (u.isAdmin) throw new Error('You cannot remove another admin');
    await this.api.deleteUser(userId);
    this.reports.set(
      this.reports().map((r) =>
        r.targetId === userId && r.status === 'open'
          ? { ...r, status: 'actioned' as const, adminNote: note.trim(), actionTaken: 'Account deleted', resolvedAt: Date.now() }
          : r
      )
    );
    this.persist();
  }

  /** Everyone LulaFind admins can act on. */
  /**
   * Mark a sighting as verified against something official.
   * Admin only. This is the badge that tells a family a sighting is a real lead
   * rather than a rumour - the source is always recorded with it.
   */
  async verifySighting(
    postId: string,
    source: 'cctv' | 'police' | 'records' | 'photo',
    note = ''
  ): Promise<void> {
    if (!this.isAdmin()) throw new Error('Only LulaFind admins can verify a sighting');
    const p = await this.api.post(postId);
    if (!p) throw new Error('That post does not exist');
    await this.api.savePost({
      ...p,
      sightingVerified: { by: this.auth.viewerId, at: Date.now(), source, note: note.trim().slice(0, 200) }
    });
  }

  /** Undo a verification, leaving the record intact. */
  async unverifySighting(postId: string): Promise<void> {
    if (!this.isAdmin()) throw new Error('Only LulaFind admins can do that');
    const p = await this.api.post(postId);
    if (!p) return;
    await this.api.savePost({ ...p, sightingVerified: null });
  }

  async allUsers(): Promise<UserProfile[]> {
    this.requireAdmin();
    return this.api.users();
  }

  async clearResolved(): Promise<void> {
    this.requireAdmin();
    this.reports.set(this.reports().filter((r) => r.status === 'open'));
    this.persist();
  }
}
