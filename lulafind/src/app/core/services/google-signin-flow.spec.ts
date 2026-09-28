import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LocalDb } from '../data/local-db';
import { LULA_API, MockApi } from '../data/api';
import { AuthService } from './auth.service';
import { GoogleAuthService, GoogleIdTokenSignIn } from './google-auth.service';
import { UserProfile } from '../models/types';

/**
 * The Google sign-in journey after the Firebase bridge:
 * Firebase runs the Google sign-in, its Google ID token is exchanged at
 * Supabase with signInWithIdToken, and email/password keeps working exactly
 * as before. No Supabase Google OAuth redirect anywhere.
 */

let db: LocalDb;

/** Records what AuthService actually asks Supabase to do. */
function fakeSupabaseAuthClient() {
  const state = {
    idTokenCalls: [] as Array<{ provider: string; token: string }>,
    oauthCalls: [] as unknown[],
    passwordCalls: [] as unknown[],
    idTokenUser: null as Record<string, unknown> | null,
    idTokenError: null as { message: string } | null
  };
  const auth = {
    onAuthStateChange: (_fn: unknown) => ({ data: { subscription: { unsubscribe: () => undefined } } }),
    getSession: async () => ({ data: { session: null }, error: null }),
    signInWithOAuth: async (options: unknown) => {
      state.oauthCalls.push(options);
      return { data: {}, error: null };
    },
    signInWithPassword: async (options: unknown) => {
      state.passwordCalls.push(options);
      return { data: { user: { id: 'u_demo', email: 'demo@lulafind.app', user_metadata: {} } }, error: null };
    },
    signInWithIdToken: async (options: { provider: string; token: string }) => {
      state.idTokenCalls.push(options);
      if (state.idTokenError) return { data: null, error: state.idTokenError };
      return { data: { user: state.idTokenUser, session: { access_token: 'supabase-session' } }, error: null };
    },
    signOut: async () => ({ error: null })
  };
  return { auth, state };
}

function fakeGoogleAuth() {
  const state = {
    result: {
      idToken: 'google-id-token',
      email: 'ma@gmail.com',
      displayName: 'Ma Dlamini',
      providerUserId: 'gid-1'
    } as GoogleIdTokenSignIn,
    error: null as Error | null
  };
  const fake = {
    signInWithGoogle: vi.fn(async () => {
      if (state.error) throw state.error;
      return state.result;
    }),
    signOut: vi.fn(async () => undefined),
    getCurrentUser: vi.fn(async () => null)
  };
  return { fake, state };
}

/** Stand-in for the real sign-in screen so AuthService.signOut() can navigate. */
@Component({ standalone: true, template: '' })
class AuthStubComponent {}

function bed(): { api: MockApi & { client?: { auth: unknown } }; client: ReturnType<typeof fakeSupabaseAuthClient>; google: ReturnType<typeof fakeGoogleAuth>; auth: AuthService } {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith('lulafind.'))
      .forEach((k) => localStorage.removeItem(k));
  } catch { /* node - nothing to clear */ }
  db = new LocalDb(true);
  const client = fakeSupabaseAuthClient();
  const google = fakeGoogleAuth();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([{ path: 'auth', component: AuthStubComponent }]),
      { provide: LULA_API, useValue: new MockApi(db) },
      { provide: GoogleAuthService, useValue: google.fake }
    ]
  });
  const api = TestBed.inject(LULA_API) as MockApi & { client?: { auth: unknown } };
  api.client = { auth: client.auth };
  return { api, client, google, auth: TestBed.inject(AuthService) as AuthService };
}

const asSettableUser = (auth: AuthService) => auth as unknown as { user: { set(v: UserProfile | null): void } };

describe('Google sign-in via Firebase to Supabase (signInWithIdToken)', () => {

  beforeEach(() => { /* each test builds its own bed */ });

  it('exchanges the Firebase Google ID token for a Supabase session and never starts an OAuth redirect', async () => {
    const { client, auth } = bed();
    client.state.idTokenUser = {
      id: 'u_demo',
      email: 'ma@gmail.com',
      user_metadata: {},
      app_metadata: { provider: 'google' }
    };

    const profile = await auth.signInWithProvider('google');

    expect(profile.id).toBe('u_demo');
    expect(auth.user()?.id).toBe('u_demo');
    expect(client.state.idTokenCalls).toEqual([{ provider: 'google', token: 'google-id-token' }]);
    expect(client.state.oauthCalls).toHaveLength(0);
  });

  it('hands a brand-new Google account to the sign-up form instead of auto-creating it', async () => {
    const { client, auth } = bed();
    client.state.idTokenUser = {
      id: '00000000-0000-4000-8000-000000000199',
      email: 'brand.new@gmail.com',
      user_metadata: { full_name: 'Brand New Member' },
      app_metadata: { provider: 'google' }
    };

    await expect(auth.signInWithProvider('google')).rejects.toThrow('NEW_ACCOUNT');
    expect(auth.user()).toBeNull();
    expect(auth.pendingProvider()).toMatchObject({
      provider: 'google',
      email: 'brand.new@gmail.com',
      displayName: 'Brand New Member'
    });
    expect(client.state.oauthCalls).toHaveLength(0);
  });

  it('propagates a canceled Google window and never calls Supabase', async () => {
    const { google, client, auth } = bed();
    google.state.error = new Error('GOOGLE_CANCELED');

    await expect(auth.signInWithProvider('google')).rejects.toThrow('GOOGLE_CANCELED');
    expect(client.state.idTokenCalls).toHaveLength(0);
    expect(client.state.oauthCalls).toHaveLength(0);
  });

  it('explains the Supabase Authorized Client IDs fix when the token is rejected', async () => {
    const { client, auth } = bed();
    client.state.idTokenError = { message: 'Invalid credentials: unauthorized client id' } as { message: string };

    await expect(auth.signInWithProvider('google')).rejects.toThrow(/Authorized Client IDs/);
  });

  it('sign-out ends both the Supabase session and the Firebase Google session', async () => {
    const { google, auth } = bed();
    asSettableUser(auth).user.set(db.user('u_demo') ?? null);

    await auth.signOut();

    expect(google.fake.signOut).toHaveBeenCalled();
    expect(auth.user()).toBeNull();
  });

  it('keeps email + password on Supabase signInWithPassword - Firebase stays out of that path', async () => {
    const { google, client, auth } = bed();

    const profile = await auth.signIn('nomvula@example.co.za', 'correct-horse');

    expect(profile.id).toBe('u_demo');
    expect(client.state.passwordCalls).toHaveLength(1);
    expect(google.fake.signInWithGoogle).not.toHaveBeenCalled();
    expect(client.state.idTokenCalls).toHaveLength(0);
    expect(client.state.oauthCalls).toHaveLength(0);
  });
});
