/**
 * The only place where Supabase learns about Google.
 *
 * Firebase Authentication performs the Google sign-in (popup on web, native
 * Google Sign-In on Android/iOS). The Google ID token Firebase issues is
 * exchanged here with `supabase.auth.signInWithIdToken({ provider: 'google',
 * token })` so Supabase mints the session that the existing tables, storage
 * and RLS policies key off — exactly the session email/password members get.
 *
 * Supabase's own Google OAuth redirect is deliberately NOT used.
 *
 * One prerequisite lives on the Supabase side: the Firebase OAuth client ID
 * that signs the token must be listed under
 * Supabase → Authentication → Providers → Google → Authorized Client IDs,
 * otherwise Supabase rejects the token. See docs/FIREBASE_GOOGLE_AUTH.md.
 */

/** Minimal shape of what `signInWithIdToken` resolves with. */
export interface SupabaseIdTokenExchange {
  user: {
    id: string;
    email?: string;
    user_metadata?: Record<string, unknown>;
    app_metadata?: Record<string, unknown>;
  } | null;
  session?: unknown;
}

/** The slice of the Supabase auth client this bridge actually needs. */
export interface SupabaseAuthLike {
  signInWithIdToken(options: { provider: 'google'; token: string }): Promise<{ data: SupabaseIdTokenExchange; error: { message: string } | null }>;
}

export async function signInSupabaseWithGoogleIdToken(
  supabaseAuth: SupabaseAuthLike | null | undefined,
  googleIdToken: string
): Promise<SupabaseIdTokenExchange> {
  if (!supabaseAuth) {
    throw new Error('Supabase is not configured, so the Google sign-in cannot be linked to an account.');
  }
  if (!googleIdToken) throw new Error('GOOGLE_NO_ID_TOKEN');

  const { data, error } = await supabaseAuth.signInWithIdToken({ provider: 'google', token: googleIdToken });
  if (error) {
    const raw = String(error.message ?? error);
    if (/client|unauthorized|invalid credentials|signature|audience|jwt/i.test(raw)) {
      throw new Error(
        'Supabase did not accept the Google sign-in. Add the Firebase OAuth client ID under ' +
        'Supabase → Authentication → Providers → Google → Authorized Client IDs, then try again.'
      );
    }
    throw new Error(raw);
  }
  return data;
}
