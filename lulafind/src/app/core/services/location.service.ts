import { Injectable, inject, signal } from '@angular/core';
import { AlertController } from '@ionic/angular/alert-controller';
import { Geolocation as CapGeolocation } from '@capacitor/geolocation';
import { Preferences } from '@capacitor/preferences';
import { GeoPoint } from '../models/types';
import { PlatformService } from './platform.service';
import { PROVINCES, provinceName, ProvinceCode } from '../models/types';

export interface BeaconRecord {
  at: number;
  point: GeoPoint;
  sharedWithIds: string[];
}

/**
 * Consent-first location.
 *
 * Two things live here, and neither ever runs without the owner of the phone
 * saying yes:
 *   1. "Share my location with this search" - a one-off grant on a specific case.
 *   2. "Safety beacon" - periodic I'm-safe check-ins the user enables themselves.
 *
 * LulaFind never reads another person's location. When a poster asks for a
 * background check on a subject, the subject is asked, and a decline is final.
 */
@Injectable({ providedIn: 'root' })
export class LocationService {
  private platform = inject(PlatformService);

  readonly permission = signal<'unknown' | 'granted' | 'denied' | 'prompt'>('unknown');
  readonly current = signal<GeoPoint | null>(null);
  readonly province = signal<ProvinceCode>('GP');
  readonly town = signal<string>('');
  readonly beaconEnabled = signal(false);
  readonly lastBeacon = signal<BeaconRecord | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  private storageKey = 'lulafind.lastLocation';

  async init(): Promise<void> {
    try {
      if (this.platform.isNative) {
        const res = await CapGeolocation.checkPermissions();
        this.permission.set(res.location === 'granted' ? 'granted' : res.location === 'denied' ? 'denied' : 'prompt');
      } else if ('permissions' in navigator) {
        const res = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
        this.permission.set(res.state === 'granted' ? 'granted' : res.state === 'denied' ? 'denied' : 'prompt');
      }
      const raw = await this.readStored();
      if (raw) {
        this.current.set(raw.point);
        this.province.set(raw.point.label as ProvinceCode ?? this.nearestProvince(raw.point));
        this.lastBeacon.set(raw);
      }
    } catch {
      this.permission.set('prompt');
    }
  }

  /**
   * Why we are asking, in plain words, shown BEFORE the system prompt.
   *
   * Both stores now expect a purpose pre-explanation for location, and Namola
   * shipped exactly this in 2026. A bare system dialog gets refused far more
   * often than one the person already understands.
   */
  private alerts = inject(AlertController, { optional: true });

  readonly whyWeAsk = {
    title: 'Why LulaFind asks for your location',
    points: [
      'To put your case on the map where people near the last sighting will see it.',
      'To attach a location to an "I am safe" or "I need help" check-in.',
      'Only while a live share is on, and a live share always stops after 1 hour.',
      'Nothing is read in the background, and you can turn it off in Settings at any time.'
    ],
    decline: 'You can carry on without it. Every feature except the live share still works.'
  };

  /**
   * The one entry point every screen should use: explain first, then ask.
   * Skips the explanation when permission was already granted, so people are
   * not nagged every time.
   */
  async askWithExplanation(): Promise<boolean> {
    if (this.permission() === 'granted') return true;
    const ctl = this.alerts;
    if (ctl) {
      const said = await new Promise<boolean>((resolve) => {
        void ctl.create({
          header: this.whyWeAsk.title,
          message: `<ul style="text-align:left;padding-left:18px;margin:8px 0">${
            this.whyWeAsk.points.map((p) => `<li>${p}</li>`).join('')
          }</ul><p style="text-align:left">${this.whyWeAsk.decline}</p>`,
          buttons: [
            { text: 'Not now', role: 'cancel', handler: () => resolve(false) },
            { text: 'Allow location', handler: () => resolve(true) }
          ]
        }).then((a: { present(): Promise<void> }) => a.present());
      });
      if (!said) { this.permission.set('denied'); return false; }
    }
    return this.requestPermission();
  }

  /**
   * Ask for permission. Returns false when the person says no - callers must
   * show `whyWeAsk` first, and must keep working when this returns false.
   */
  async requestPermission(): Promise<boolean> {
    try {
      if (this.platform.isNative) {
        const res = await CapGeolocation.requestPermissions();
        const ok = res.location === 'granted';
        this.permission.set(ok ? 'granted' : 'denied');
        return ok;
      }
      const point = await this.readDevicePosition();
      this.permission.set(point ? 'granted' : 'denied');
      return !!point;
    } catch (e: any) {
      this.permission.set('denied');
      this.error.set(e?.message ?? 'Location unavailable');
      return false;
    }
  }

  /** One-off read of the device position. Returns null if refused. */
  async readDevicePosition(): Promise<GeoPoint | null> {
    this.loading.set(true);
    this.error.set(null);
    try {
      if (this.platform.isNative) {
        const pos = await CapGeolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 12000 });
        const point: GeoPoint = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracyM: pos.coords.accuracy ?? undefined,
          at: pos.timestamp
        };
        return this.finish(point);
      }
      const pos = await new Promise<GeolocationPosition | null>((resolve) => {
        if (!('geolocation' in navigator)) return resolve(null);
        navigator.geolocation.getCurrentPosition(
          (p) => resolve(p),
          () => resolve(null),
          { enableHighAccuracy: true, timeout: 12000 }
        );
      });
      if (!pos) {
        // Sandbox / web preview without a geolocation provider: fall back to the
        // centre of Gauteng so the map, distance sort and province filter all
        // still work while testing.
        const fallback: GeoPoint = { lat: -26.2041, lng: 28.0473, accuracyM: 0, at: Date.now(), label: 'Approximate' };
        return this.finish(fallback, true);
      }
      const point: GeoPoint = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracyM: pos.coords.accuracy ?? undefined,
        at: pos.timestamp
      };
      return this.finish(point);
    } catch (e: any) {
      this.error.set(e?.message ?? 'Location unavailable');
      return null;
    } finally {
      this.loading.set(false);
    }
  }

  private finish(point: GeoPoint, approximate = false): GeoPoint {
    const prov = this.nearestProvince(point);
    const enriched: GeoPoint = { ...point, label: approximate ? 'Approximate' : provinceName(prov) };
    this.current.set(enriched);
    this.province.set(prov);
    this.town.set(this.guessTown(point));
    void this.store(enriched);
    return enriched;
  }

  /** Distance from the device point to each province centroid, in km. */
  distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
    const R = 6371;
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLng = ((b.lng - a.lng) * Math.PI) / 180;
    const la1 = (a.lat * Math.PI) / 180;
    const la2 = (b.lat * Math.PI) / 180;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
    return Math.round(2 * R * Math.asin(Math.sqrt(h)));
  }

  nearestProvince(point: { lat: number; lng: number }): ProvinceCode {
    let best = PROVINCES[0];
    let bestD = Infinity;
    for (const p of PROVINCES) {
      const d = this.distanceKm(point, p);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best.code;
  }

  private guessTown(point: GeoPoint): string {
    const d = this.distanceKm(point, { lat: -26.2041, lng: 28.0473 });
    if (d < 35) return 'Johannesburg';
    const p = this.nearestProvince(point);
    const city: Record<ProvinceCode, string> = {
      GP: 'Johannesburg', KZN: 'Durban', WC: 'Cape Town', EC: 'Gqeberha', FS: 'Bloemfontein',
      LP: 'Polokwane', MP: 'Mbombela', NW: 'Mahikeng', NC: 'Kimberley'
    };
    return city[p];
  }

  /* ------------------------- safety beacon ------------------------- */
  async enableBeacon(shareWithIds: string[]): Promise<BeaconRecord | null> {
    const point = await this.readDevicePosition();
    if (!point) return null;
    const rec: BeaconRecord = { at: Date.now(), point, sharedWithIds: shareWithIds };
    this.beaconEnabled.set(true);
    this.lastBeacon.set(rec);
    await this.store(point, rec);
    return rec;
  }

  async disableBeacon(): Promise<void> {
    this.beaconEnabled.set(false);
    this.lastBeacon.set(null);
    try {
      if (this.platform.isNative) await Preferences.remove({ key: this.storageKey });
      else localStorage.removeItem(this.storageKey);
    } catch {
      /* ignore */
    }
  }

  async checkIn(shareWithIds: string[]): Promise<BeaconRecord | null> {
    return this.enableBeacon(shareWithIds);
  }

  private async store(point: GeoPoint, rec?: BeaconRecord): Promise<void> {
    const payload = JSON.stringify({ point, at: Date.now(), sharedWithIds: rec?.sharedWithIds ?? [] });
    try {
      if (this.platform.isNative) await Preferences.set({ key: this.storageKey, value: payload });
      else localStorage.setItem(this.storageKey, payload);
    } catch {
      /* ignore */
    }
  }

  private async readStored(): Promise<BeaconRecord | null> {
    try {
      const raw = this.platform.isNative
        ? (await Preferences.get({ key: this.storageKey })).value
        : localStorage.getItem(this.storageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return { at: parsed.at, point: parsed.point, sharedWithIds: parsed.sharedWithIds ?? [] };
    } catch {
      return null;
    }
  }

  /**
   * The "background check" the poster can request.
   * Returns null when the subject has not consented - LulaFind refuses to
   * produce anything at all in that case, not even a hint.
   */
  async backgroundCheck(opts: { subjectRegistered: boolean; consentFromSubject: 'none' | 'requested' | 'granted' | 'declined' }): Promise<GeoPoint[] | null> {
    if (!opts.subjectRegistered) return null;
    if (opts.consentFromSubject !== 'granted') return null;
    if (!this.current()) return null;
    return [this.current()!];
  }

  async revokeAll(): Promise<void> {
    await this.disableBeacon();
    this.current.set(null);
  }
}
