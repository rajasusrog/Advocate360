/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

// Read Supabase credentials safely supporting node test environment
const env = (typeof import.meta !== 'undefined' && (import.meta as any).env) || process.env || {};
const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL || 'https://placeholder-project.supabase.co';
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || 'placeholder-anon-key';

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey &&
  !supabaseUrl.includes('placeholder')
);

// Create single Supabase client instance
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export const PENDING_PORTAL_INVITE_STORAGE_KEY = 'adv360_pending_portal_invite';

/**
 * Safely persists a pending client invitation token across the OAuth redirect lifecycle
 * without exposing it to external origins or logging raw tokens.
 */
export function savePendingPortalInviteToken(rawToken: string): void {
  const cleaned = (rawToken || '').trim();
  if (!/^[0-9a-fA-F]{32,128}$/.test(cleaned)) return;
  const payload = JSON.stringify({
    token: cleaned,
    savedAt: Date.now(),
    returnPath: '/portal/redeem',
  });
  try {
    if (typeof window !== 'undefined') {
      window.sessionStorage?.setItem(PENDING_PORTAL_INVITE_STORAGE_KEY, payload);
      window.localStorage?.setItem(PENDING_PORTAL_INVITE_STORAGE_KEY, payload);
    }
  } catch {
    // Ignore storage quota errors
  }
}

/**
 * Reads a pending client invitation token if it was saved within the last 30 minutes.
 */
export function peekPendingPortalInviteToken(): string | null {
  try {
    if (typeof window === 'undefined') return null;
    const raw =
      window.sessionStorage?.getItem(PENDING_PORTAL_INVITE_STORAGE_KEY) ||
      window.localStorage?.getItem(PENDING_PORTAL_INVITE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.token !== 'string') return null;
    const maxAgeMs = 30 * 60 * 1000;
    if (typeof parsed.savedAt === 'number' && Date.now() - parsed.savedAt > maxAgeMs) {
      clearPendingPortalInviteToken();
      return null;
    }
    if (!/^[0-9a-fA-F]{32,128}$/.test(parsed.token.trim())) {
      clearPendingPortalInviteToken();
      return null;
    }
    return parsed.token.trim();
  } catch {
    return null;
  }
}

/**
 * Clears the stored pending client invitation token after redemption or sign-out.
 */
export function clearPendingPortalInviteToken(): void {
  try {
    if (typeof window !== 'undefined') {
      window.sessionStorage?.removeItem(PENDING_PORTAL_INVITE_STORAGE_KEY);
      window.localStorage?.removeItem(PENDING_PORTAL_INVITE_STORAGE_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

/**
 * Initiates Google OAuth Sign-In via Supabase Auth while preserving any pending client invitation
 */
export async function signInWithGoogle(options?: { pendingInviteToken?: string }) {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment variables.');
  }

  if (options?.pendingInviteToken) {
    savePendingPortalInviteToken(options.pendingInviteToken);
  } else if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('token');
    if (urlToken) {
      savePendingPortalInviteToken(urlToken);
    }
  }

  const redirectUrl = `${window.location.origin}/auth/callback`;
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectUrl,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  });

  if (error) {
    console.error('Google Sign-In Error:', error.message);
    throw error;
  }

  return data;
}

/**
 * Signs out current user session
 */
export async function signOut() {
  clearPendingPortalInviteToken();
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error('Sign-Out Error:', error.message);
    throw error;
  }
}

/**
 * Returns current authenticated user session
 */
export async function getCurrentSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.warn('Get Session Error:', error.message);
    return null;
  }
  return data.session;
}
