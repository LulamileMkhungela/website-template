import { describe, expect, it } from 'vitest';
import { signInSupabaseWithGoogleIdToken, SupabaseAuthLike } from './supabase-auth-bridge';

/** Minimal stand-in for the Supabase auth client that records signInWithIdToken calls. */
function fakeSupabaseAuth(result: { data?: unknown; error?: { message: string } | null }) {
  const calls: Array<{ provider: string; token: string }> = [];
  const client: SupabaseAuthLike = {
    signInWithIdToken: async (options) => {
      calls.push(options);
      return { data: result.data as never, error: result.error ?? null };
    }
  };
  return { client, calls };
}

describe('supabase-auth-bridge (Google ID token to Supabase session)', () => {

  it('exchanges the Firebase Google ID token with provider "google"', async () => {
    const { client, calls } = fakeSupabaseAuth({ data: { user: { id: 'u-1', email: 'ma@gmail.com' } } });
    const data = await signInSupabaseWithGoogleIdToken(client, 'google-id-token');
    expect(calls).toEqual([{ provider: 'google', token: 'google-id-token' }]);
    expect(data.user?.id).toBe('u-1');
  });

  it('surfaces Supabase client-id rejections together with the fix', async () => {
    const { client } = fakeSupabaseAuth({ error: { message: 'Invalid credentials: unauthorized client id' } });
    await expect(signInSupabaseWithGoogleIdToken(client, 'google-id-token'))
      .rejects.toThrow(/Authorized Client IDs/);
  });

  it('passes unrelated Supabase errors through untouched', async () => {
    const { client } = fakeSupabaseAuth({ error: { message: 'rate limited' } });
    await expect(signInSupabaseWithGoogleIdToken(client, 'google-id-token')).rejects.toThrow('rate limited');
  });

  it('refuses to run without a configured Supabase client', async () => {
    await expect(signInSupabaseWithGoogleIdToken(null, 'google-id-token'))
      .rejects.toThrow(/Supabase is not configured/);
  });

  it('refuses an empty token - there would be nothing to verify', async () => {
    const { client, calls } = fakeSupabaseAuth({ data: { user: null } });
    await expect(signInSupabaseWithGoogleIdToken(client, '')).rejects.toThrow('GOOGLE_NO_ID_TOKEN');
    expect(calls).toHaveLength(0);
  });
});
