/**
 * Client-side auth input validation.
 *
 * Scope note: this is UX, not security. It exists to catch typos and give
 * immediate feedback — anything here can be bypassed with curl. The actual
 * defence against junk signups is Supabase's "Confirm email" setting: with it
 * on, an address nobody owns never receives a link, so GoTrue never issues a
 * session and the account is inert.
 *
 * The `type="email"` input alone is not enough: the HTML5 spec does not require
 * a TLD, so `test@test` and `x@y` satisfy the browser's own check. That gap is
 * what let arbitrary strings through, and it's what EMAIL_RE closes.
 */

// Requires a dotted domain and an alphabetic TLD of 2+ chars, so `a@b` and
// `test@test` are rejected. Deliberately not RFC 5322-exhaustive — that grammar
// permits addresses no real mail provider issues, and the cost of a false
// reject here is a user who cannot sign up at all.
const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;

const MAX_EMAIL_LENGTH = 254; // RFC 5321 forward-path limit
export const MIN_PASSWORD_LENGTH = 8;

export function validateEmail(raw: string): string | null {
  const email = raw.trim();
  if (!email) return 'Email is required.';
  if (email.length > MAX_EMAIL_LENGTH) return 'That email is too long.';
  if (!EMAIL_RE.test(email)) return 'Enter a valid email address, like you@example.com.';
  return null;
}

/**
 * Only enforced on sign-up. Sign-in deliberately skips it: an existing account
 * may predate this rule, and telling someone their *correct* password is
 * "invalid" would lock them out of their own data.
 */
export function validatePassword(password: string): string | null {
  if (!password) return 'Password is required.';
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  return null;
}
