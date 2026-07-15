import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * True when Supabase credentials are present. When false, the app runs in a
 * local "dev bypass" mode: no login screen, and the backend (with AUTH_ENABLED=false)
 * attributes everything to a single dev user.
 */
export const authConfigured = Boolean(url && anonKey);

/**
 * What the auth redirect put in the URL fragment, read before anything else can
 * consume it.
 *
 * Supabase returns recovery links and OAuth results in the hash, then rewrites
 * the URL to hide the tokens — so by the time React mounts, `type=recovery` is
 * usually gone. Failures are the mirror image: the rewrite is skipped, and an
 * `error_code=otp_expired` sits in the address bar that the client reports to
 * nobody, because `createClient` swallows the initialisation error.
 *
 * Snapshotting at module scope, above `createClient`, makes both observable:
 * this runs before the client exists, let alone before its async init touches
 * the hash.
 */
function readAuthCallback(): { type: string | null; errorDescription: string | null } {
  if (typeof window === 'undefined') return { type: null, errorDescription: null };
  const params = new URLSearchParams(window.location.hash.slice(1));
  return {
    type: params.get('type'),
    // `error` alone is a code like "access_denied"; the description is the
    // sentence Supabase actually wrote for a human.
    errorDescription: params.get('error_description')?.replace(/\+/g, ' ') ?? null,
  };
}

export const authCallback = readAuthCallback();

export const supabase: SupabaseClient | null = authConfigured
  ? createClient(url as string, anonKey as string, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

/** Strip a consumed (or failed) auth fragment so a reload doesn't replay it. */
export function clearAuthCallbackHash(): void {
  if (typeof window !== 'undefined' && window.location.hash) {
    window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
  }
}

/** Current access token (Supabase JWT) for authorizing backend requests, or null. */
export async function getAccessToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
