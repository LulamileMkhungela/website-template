import { Injectable, inject, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import { LULA_API } from '../data/api';
import { ConsentRecord, EscalationRecord, Post } from '../models/types';
import { AuthService } from './auth.service';
import { DataService } from './data.service';

export interface EscalationPartner {
  id: string;
  name: string;
  detail: string;
  reach: string;
  defaultOn: boolean;
  href: string;
  actionLabel: string;
  personOnly?: boolean;
}

export const PARTNERS: EscalationPartner[] = environment.escalationPartners as EscalationPartner[];

/**
 * Case contacts.
 *
 * LulaFind never forwards a case to SAPS, an NGO, or a newsroom. The poster
 * calls or messages the service themselves. A note on the case only records
 * that they said they did. It is not a police acknowledgement.
 */
@Injectable({ providedIn: 'root' })
export class EscalationService {
  private api = inject(LULA_API);
  private auth = inject(AuthService);
  private data = inject(DataService);

  readonly partners = PARTNERS;
  readonly sending = signal(false);
  readonly lastResult = signal<string | null>(null);

  partnersFor(post: Post): EscalationPartner[] {
    if (post.type === 'story') return [];
    const person = post.type === 'missing' || post.type === 'khumbulekhaya' || post.type === 'sighting';
    return PARTNERS.filter((p) => person || !p.personOnly);
  }

  statusOf(post: Post, partnerId: string): EscalationRecord | undefined {
    return post.escalation.partners.find((p) => p.partnerId === partnerId);
  }

  /** Step 1: the poster is shown the consent sheet and agrees. */
  async grantConsent(post: Post, partnerIds: string[], ttlDays = 30): Promise<Post | undefined> {
    void ttlDays;
    const me = this.auth.viewerId;
    if (!me) throw new Error('Sign in first');
    if (post.authorId !== me) throw new Error('Only the person who posted this case can grant escalation consent');
    const now = Date.now();
    const records: ConsentRecord[] = [
      ...post.consent.filter((c) => c.kind !== 'escalation'),
      {
        kind: 'escalation',
        label: `I contacted ${partnerIds.length} service(s) myself. LulaFind did not send the case`,
        granted: true,
        at: now,
        expiresAt: null,
        detail: partnerIds.map((id) => PARTNERS.find((p) => p.id === id)?.name ?? id).join(', ')
      }
    ];
    const next: Post = {
      ...post,
      escalation: { ...post.escalation, requested: true, consentGranted: true, consentAt: now },
      consent: records,
      events: [...post.events, { at: now, kind: 'claimed', byUserId: me, note: `Poster noted contact for their own records. Nothing was sent` }]
    };
    await this.api.savePost(next);
    this.data.touch(next);
    return next;
  }

  /**
   * Records that the poster says they contacted these services.
   * Does not call them, message them, or invent a reference number.
   */
  async dispatch(post: Post, partnerIds: string[]): Promise<Post | undefined> {
    if (!post.escalation.consentGranted) throw new Error('Consent is required before escalation');
    this.sending.set(true);
    this.lastResult.set(null);
    try {
      const now = Date.now();
      const updated: EscalationRecord[] = partnerIds.map((id) => {
        const partner = PARTNERS.find((p) => p.id === id);
        return {
          partnerId: id,
          partnerName: partner?.name ?? id,
          status: 'noted',
          requestedAt: now,
          sentAt: now,
          reference: null
        };
      });
      const next: Post = {
        ...post,
        escalation: { ...post.escalation, partners: updated },
        updatedAt: now,
        events: [...post.events, { at: now, kind: 'claimed', byUserId: this.auth.viewerId, note: `Poster recorded contact with ${updated.length} service(s). Nothing was sent` }]
      };
      await this.api.savePost(next);
      this.data.touch(next);
      await this.data.notify({
        userId: post.authorId,
        kind: 'escalation',
        title: 'Contact noted on your case',
        body: `You recorded ${updated.map((p) => p.partnerName).join(', ')}. LulaFind did not send the case.`,
        route: `/post/${post.id}`,
        postId: post.id
      });
      this.lastResult.set('Saved on this case. LulaFind did not send it.');
      return next;
    } finally {
      this.sending.set(false);
    }
  }

  /** Consent can always be withdrawn. */
  async revokeConsent(post: Post): Promise<Post | undefined> {
    const hasRecord = post.consent.some((c) => c.kind === 'escalation');
    const consent = hasRecord
      ? post.consent.map((c) => (c.kind === 'escalation' ? { ...c, granted: false } : c))
      : [
          ...post.consent,
          { kind: 'escalation' as const, label: 'Escalation consent withdrawn', granted: false, at: Date.now(), expiresAt: null }
        ];
    const next: Post = {
      ...post,
      escalation: { ...post.escalation, consentGranted: false },
      consent,
      events: [...post.events, { at: Date.now(), kind: 'claimed', byUserId: this.auth.viewerId, note: 'Escalation consent withdrawn' }]
    };
    await this.api.savePost(next);
    this.data.touch(next);
    return next;
  }

  /**
   * Do not call this to fake a police acknowledgement. Kept only so an old
   * demo status can be rewritten. It does not contact SAPS.
   */
  async acknowledge(post: Post, partnerId: string): Promise<Post | undefined> {
    const next: Post = {
      ...post,
      escalation: {
        ...post.escalation,
        partners: post.escalation.partners.map((p) =>
          p.partnerId === partnerId ? { ...p, status: 'acknowledged' } : p
        )
      }
    };
    await this.api.savePost(next);
    this.data.touch(next);
    return next;
  }

  newReference(post: Post): string {
    return `LF-${post.id.slice(-6).toUpperCase()}`;
  }

  /** Poster-facing nudge once a case has real traction. */
  shouldNudgeOutcome(post: Post): boolean {
    if (post.status !== 'active') return false;
    if (post.authorId !== this.auth.viewerId) return false;
    if (post.outcomeNudgeAt && Date.now() - post.outcomeNudgeAt < 12 * 3600_000) return false;
    return post.upvotes >= 20 || post.commentCount >= 3;
  }
}
