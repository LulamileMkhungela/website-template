import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FIREBASE_AUTH_PLUGIN, GoogleAuthService } from './google-auth.service';

/**
 * GoogleAuthService speaks to the Firebase Authentication Capacitor plugin.
 * The plugin is stood in through its injection token - no module mocking, so
 * the Angular test builder stays happy.
 */

interface PluginMock {
  signInWithGoogle: ReturnType<typeof vi.fn>;
  signOut: ReturnType<typeof vi.fn>;
  getCurrentUser: ReturnType<typeof vi.fn>;
}

function bed(): { plugin: PluginMock; service: GoogleAuthService } {
  TestBed.resetTestingModule();
  const plugin: PluginMock = {
    signInWithGoogle: vi.fn(),
    signOut: vi.fn(),
    getCurrentUser: vi.fn()
  };
  TestBed.configureTestingModule({
    providers: [{ provide: FIREBASE_AUTH_PLUGIN, useValue: plugin }]
  });
  const service = TestBed.inject(GoogleAuthService);
  // The environment files still carry a blank Firebase Web app ID, so the
  // mechanics tests pretend the config is complete. The real blank-config
  // behaviour is covered in its own test below.
  vi.spyOn(service as unknown as { configMissing(): string[] }, 'configMissing').mockReturnValue([]);
  return { plugin, service };
}

describe('GoogleAuthService (Firebase Authentication Capacitor plugin)', () => {
  let plugin: PluginMock;
  let service: GoogleAuthService;

  beforeEach(() => {
    ({ plugin, service } = bed());
  });

  it('returns the Firebase-issued Google ID token and profile of the signed-in account', async () => {
    plugin.signInWithGoogle.mockResolvedValue({
      credential: { idToken: 'google-id-token' },
      user: { email: 'ma@gmail.com', displayName: 'Ma Dlamini', uid: 'gid-1' }
    });
    await expect(service.signInWithGoogle()).resolves.toEqual({
      idToken: 'google-id-token',
      email: 'ma@gmail.com',
      displayName: 'Ma Dlamini',
      providerUserId: 'gid-1'
    });
  });

  it('treats a closed Google window as a cancel, not a crash', async () => {
    plugin.signInWithGoogle.mockRejectedValue(new Error('auth/popup-closed-by-user'));
    await expect(service.signInWithGoogle()).rejects.toThrow('GOOGLE_CANCELED');
  });

  it('insists on an ID token - without one there is nothing to hand to Supabase', async () => {
    plugin.signInWithGoogle.mockResolvedValue({ credential: {}, user: { email: 'ma@gmail.com' } });
    await expect(service.signInWithGoogle()).rejects.toThrow('GOOGLE_NO_ID_TOKEN');
  });

  it('maps the Android DEVELOPER_ERROR to the missing SHA-1 fingerprint hint', async () => {
    plugin.signInWithGoogle.mockRejectedValue(new Error('DEVELOPER_ERROR'));
    await expect(service.signInWithGoogle()).rejects.toThrow(/SHA-1/);
  });

  it('maps a native cancel error string to GOOGLE_CANCELED', async () => {
    plugin.signInWithGoogle.mockRejectedValue(new Error('The user canceled the sign-in flow'));
    await expect(service.signInWithGoogle()).rejects.toThrow('GOOGLE_CANCELED');
  });

  it('sign-out is best-effort and never throws when Firebase already forgot the device', async () => {
    plugin.signOut.mockRejectedValue(new Error('offline'));
    await expect(service.signOut()).resolves.toBeUndefined();
    expect(plugin.signOut).toHaveBeenCalled();
  });

  it('getCurrentUser returns null when nobody is signed in on the Firebase side', async () => {
    plugin.getCurrentUser.mockResolvedValue({ user: null });
    await expect(service.getCurrentUser()).resolves.toBeNull();
  });

  it('refuses to start while the Firebase Web app ID is still blank (real environment state)', async () => {
    TestBed.resetTestingModule();
    const real = TestBed.inject(GoogleAuthService); // no overrides - reads the real environment
    await expect(real.signInWithGoogle()).rejects.toThrow(/appId/);
  });
});
