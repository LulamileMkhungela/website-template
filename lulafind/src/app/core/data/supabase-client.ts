import { signal } from '@angular/core';
import { environment } from '../../../environments/environment';

/**
 * Supabase client configuration.
 *
 * The real Supabase JS client would be instantiated here. For now we export
 * the config values and the enabled flag so the rest of the app can check
 * whether a real Supabase project is configured.
 */

/** The Supabase project URL from the environment. */
export const SUPABASE_URL: string = (environment as any).supabaseUrl ?? '';

/** The Supabase publishable (anon) key from the environment. */
export const SUPABASE_KEY: string = (environment as any).supabaseKey ?? '';

/** Banner text shown at the top of every page when Supabase is misconfigured. */
export const supabaseNotice = signal<string>('');

/**
 * Returns true when a real Supabase URL and anon key are present in the
 * environment, so apiFactory() knows to use SupabaseApi instead of MockApi.
 *
 * Reads `environment.supabaseUrl` and `environment.supabaseKey` — the flat
 * keys set in environment.ts — NOT the nested `environment.supabase.url`
 * shape that was previously attempted.
 */
export function liveSupabaseEnabled(): boolean {
  return !!(SUPABASE_URL && SUPABASE_KEY &&
    SUPABASE_URL.startsWith('https://') &&
    SUPABASE_KEY.length > 10);
}
