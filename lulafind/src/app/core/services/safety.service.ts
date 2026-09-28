import { Injectable, computed, inject, signal } from '@angular/core';
import { LULA_API } from '../data/api';
import { CheckIn, CheckInStatus, GeoPoint, UserProfile } from '../models/types';
import { uid } from '../utils/format';
import { AuthService } from './auth.service';
import { DataService } from './data.service';
import { LocationService } from './location.service';

export const LIVE_SHARE_MS = 60 * 60 * 1000; // live location always stops after 1 hour

export const CHECK_IN_COPY: Record<CheckInStatus, { label: string; short: string; ring: string; detail: string }> = {
  safe: {
    label: 'I am safe',
    short: 'Safe',
    ring: 'Green ring',
    detail: 'A green ring means this person is safe.'
  },
  unfamiliar: {
    label: 'I am in an unfamiliar place',
    short: 'Unfamiliar place',
    ring: 'Orange ring',
    detail: 'An orange ring means this person is somewhere they do not know.'
  },
  need_help: {
    label: 'I need someone to check on me',
    short: 'Check on me',
    ring: 'Red ring',
    detail: 'A red ring means this person asked someone to check on them. In a real emergency, call 10111.'
  }
};

/** One line, shown wherever a coloured ring can appear. Colour is never the only clue. */
export const RING_KEY = 'Green ring: safe. Orange ring: unfamiliar place. Red ring: check on me.';

/**
 * "Am I safe?" check-ins and optional live location.
 *
 * The person sets their own status. Nothing is shared unless they turn on live
 * location, and live location always expires after one hour. If a share expires
 * and the person has not said they are okay, LulaFind asks their followers to
 * check on them - only when that setting is on.
 */
@Injectable({ providedIn: 'root' })
export class SafetyService {
  private api = inject(LULA_API);
  private auth = inject(AuthService);
  private data = inject(DataService);
  private location = inject(LocationService);

  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  private timer: ReturnType<typeof setTimeout> | null = null;

  readonly myCheckIn = computed(() => this.auth.user()?.checkIn ?? null);

  readonly liveActive = computed(() => {
    const c = this.myCheckIn();
    return !!c?.liveShareOn && !!c.liveUntil && c.liveUntil > Date.now();
  });

  /** Seconds of live sharing left, or 0. */
  readonly liveSecondsLeft = signal(0);

  /* --------------------------- check in --------------------------- */

  async checkIn(input: {
    status: CheckInStatus;
    note?: string;
    shareLocation?: boolean;
    live?: boolean;
  }): Promise<CheckIn> {
    const me = this.auth.user();
    if (!me) throw new Error('Sign in to check in');
    if (me.suspended) throw new Error('Your account is suspended');

    this.busy.set(true);
    this.error.set(null);
    try {
      let point: GeoPoint | null = null;
      if (input.shareLocation || input.live) {
        if (this.location.permission() !== 'granted') {
          const ok = await this.location.askWithExplanation();
          if (!ok) throw new Error('Location permission is off. Turn it on in your phone settings, or check in without a location.');
        }
        point = await this.location.readDevicePosition();
        if (!point) throw new Error('We could not read your location. Try again, or check in without a location.');
      }

      const live = !!input.live && !!point;
      const now = Date.now();
      const record: CheckIn = {
        status: input.status,
        note: (input.note ?? '').trim().slice(0, 200),
        at: now,
        location: point,
        liveShareOn: live,
        liveUntil: live ? now + LIVE_SHARE_MS : null
      };

      await this.save({ ...me, checkIn: record, lastBeaconAt: now });
      await this.notifyFollowers(me, record);

      if (live) this.startCountdown(record.liveUntil!);
      return record;
    } catch (e: any) {
      this.error.set(e?.message ?? 'Could not save your check-in');
      throw e;
    } finally {
      this.busy.set(false);
    }
  }

  /** Clear the status. You do not have to set one at all. */
  async clearCheckIn(): Promise<void> {
    const me = this.auth.user();
    if (!me) return;
    this.stopCountdown();
    await this.save({ ...me, checkIn: null });
  }

  /** Turn live sharing off early, keeping the status. */
  async stopLiveSharing(): Promise<void> {
    const me = this.auth.user();
    const c = me?.checkIn;
    if (!me || !c) return;
    this.stopCountdown();
    await this.save({ ...me, checkIn: { ...c, liveShareOn: false, liveUntil: null } });
  }

  /* ------------------------ live expiry ------------------------ */

  private startCountdown(until: number): void {
    this.stopCountdown();
    const tick = () => {
      const left = Math.max(0, Math.round((until - Date.now()) / 1000));
      this.liveSecondsLeft.set(left);
      if (left <= 0) {
        this.stopCountdown();
        void this.onLiveExpired();
      }
    };
    tick();
    this.timer = setInterval(tick, 1000);
  }

  private stopCountdown(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.liveSecondsLeft.set(0);
  }

  /**
   * The hour is up. If the person has "ask my followers to check on me" turned
   * on and has not said they are safe, their followers are told.
   */
  private async onLiveExpired(): Promise<void> {
    const me = this.auth.user();
    const c = me?.checkIn;
    if (!me || !c || !c.liveShareOn) return;
    const wantsNotify = me.privacy?.notifyFollowersOnExpiry !== false;
    const stillWorried = c.status !== 'safe';

    await this.save({ ...me, checkIn: { ...c, liveShareOn: false, liveUntil: null } });

    if (!wantsNotify || !stillWorried) return;

    const followers = await this.followersOf(me.id);
    for (const f of followers) {
      await this.api.pushNotification({
        id: uid('n'),
        userId: f.id,
        kind: 'checkin',
        title: `Check on ${me.displayName}`,
        body: `${me.displayName} shared their location for an hour and has not said they are safe. Please check on them.`,
        at: Date.now(),
        read: false,
        route: `/user/${me.id}`,
        postId: null
      });
    }
  }

  private async notifyFollowers(me: UserProfile, record: CheckIn): Promise<void> {
    // only "check on me" and live sharing are worth telling people about
    if (record.status === 'safe' && !record.liveShareOn) return;
    const followers = await this.followersOf(me.id);
    const body = record.liveShareOn
      ? `${me.displayName} is sharing their live location for the next hour.`
      : `${me.displayName} asked people to check on them.`;
    for (const f of followers) {
      await this.api.pushNotification({
        id: uid('n'),
        userId: f.id,
        kind: 'checkin',
        title: record.status === 'need_help' ? `Check on ${me.displayName}` : `${me.displayName} checked in`,
        body,
        at: Date.now(),
        read: false,
        route: `/user/${me.id}`,
        postId: null
      });
    }
  }

  private async followersOf(userId: string): Promise<UserProfile[]> {
    const all = await this.api.users();
    const out: UserProfile[] = [];
    for (const u of all) {
      if (u.id === userId) continue;
      if (await this.api.isFollowing(u.id, userId)) out.push(u);
    }
    return out;
  }

  private async save(u: UserProfile): Promise<void> {
    await this.api.saveUser(u);
    // keep the session and the feed author cache in step
    await this.auth.updateProfile(u);
    this.data.touchAuthor(u);
  }

  /* ------------------------ reading others ------------------------ */

  /**
   * What a visitor is allowed to see. Returns null when the person has hidden
   * their status or is not sharing.
   */
  visibleCheckIn(u: UserProfile | null | undefined, viewerId: string | null): CheckIn | null {
    if (!u?.checkIn) return null;
    const c = u.checkIn;
    if (u.id === viewerId) return c;
    if (!u.privacy?.showLocation && c.location) {
      return { ...c, location: null, liveShareOn: false, liveUntil: null };
    }
    if (c.liveShareOn && c.liveUntil && c.liveUntil <= Date.now()) {
      return { ...c, liveShareOn: false, liveUntil: null };
    }
    return c;
  }
}
