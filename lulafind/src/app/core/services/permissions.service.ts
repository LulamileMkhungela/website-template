import { Injectable, signal, computed } from '@angular/core';

/**
 * The permission kinds the app may request.
 * - notifications : push / local notifications
 * - camera        : take photos for posts and profile
 * - photos        : pick images from the gallery
 * - location      : one-time precise location for sighting geo-tags
 */
export type PermKind = 'notifications' | 'camera' | 'photos' | 'location';

export type PermStatus = 'unknown' | 'denied' | 'granted' | 'prompt';

export interface PermRow {
  kind: PermKind;
  label: string;
  why: string;
  status: PermStatus;
  statusLabel: string;
}

const PERM_META: Record<PermKind, { label: string; why: string }> = {
  notifications: {
    label: 'Notifications',
    why: 'Get alerts when someone comments on your post or a new case appears near you.'
  },
  camera: {
    label: 'Camera',
    why: 'Take photos directly when posting a missing person or sighting.'
  },
  photos: {
    label: 'Photos / Gallery',
    why: 'Upload photos from your gallery to posts and your profile.'
  },
  location: {
    label: 'Location',
    why: 'Attach an accurate map pin to sightings. Never used in the background.'
  }
};

function statusLabel(s: PermStatus): string {
  switch (s) {
    case 'granted': return 'On';
    case 'denied':  return 'Denied — open phone settings to allow';
    case 'prompt':  return 'Not yet asked';
    default:        return 'Unknown';
  }
}

/**
 * PermissionsService — thin wrapper around the Capacitor permissions APIs.
 *
 * In web / mock mode every permission is simulated in-memory so the settings
 * page renders correctly without a native runtime. On a real device, swap the
 * stubs below for the appropriate Capacitor plugin calls.
 */
@Injectable({ providedIn: 'root' })
export class PermissionsService {
  private statuses = signal<Record<PermKind, PermStatus>>({
    notifications: 'unknown',
    camera:        'unknown',
    photos:        'unknown',
    location:      'unknown'
  });

  readonly busy = signal(false);

  /** Advisory message shown below the permission list (e.g. after a denial). */
  readonly note = signal<string | null>(null);

  /** All permission rows, ready for the template @for loop. */
  readonly rows = computed((): PermRow[] => {
    const s = this.statuses();
    return (Object.keys(PERM_META) as PermKind[]).map((kind) => ({
      kind,
      label: PERM_META[kind].label,
      why:   PERM_META[kind].why,
      status: s[kind],
      statusLabel: statusLabel(s[kind])
    }));
  });

  /**
   * Re-query the current status for every permission.
   * On native this would call the Capacitor plugin; in mock mode it reads
   * the in-memory map so the UI can reflect manual toggles during testing.
   */
  async refresh(): Promise<void> {
    // In a real native build replace this with Capacitor plugin queries, e.g.:
    //   const { camera } = await Camera.checkPermissions();
    //   const { receive } = await PushNotifications.checkPermissions();
    // For now we leave whatever is already set so the UI stays stable.
  }

  /**
   * Request a specific permission from the OS.
   * Returns true when the permission is granted after the request.
   */
  async enable(kind: PermKind): Promise<boolean> {
    this.busy.set(true);
    this.note.set(null);
    try {
      // In a real native build call the Capacitor plugin here, e.g.:
      //   const result = await Camera.requestPermissions({ permissions: ['camera'] });
      //   const granted = result.camera === 'granted';
      // Mock: mark granted so the toggle flips in the UI.
      this.statuses.update((s) => ({ ...s, [kind]: 'granted' as PermStatus }));
      return true;
    } catch {
      this.statuses.update((s) => ({ ...s, [kind]: 'denied' as PermStatus }));
      this.note.set(`Could not enable ${PERM_META[kind].label}. Open phone settings to allow it.`);
      return false;
    } finally {
      this.busy.set(false);
    }
  }

  /**
   * Open the OS settings screen for this app so the user can manually toggle
   * a permission that was previously denied.
   * Returns true when the plugin opened settings, false in a web browser.
   */
  async openPhoneSettings(): Promise<boolean> {
    try {
      // In a real native build:
      //   const { NativeSettings } = await import('capacitor-native-settings');
      //   await NativeSettings.openAndroid({ option: AndroidSettings.ApplicationDetails });
      //   return true;
      return false;
    } catch {
      return false;
    }
  }
}
