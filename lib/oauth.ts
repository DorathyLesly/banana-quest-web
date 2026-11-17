/**
 * OAuth utility functions for Google and GitHub.
 * Pure fetch-based — no external libraries. Compatible with Cloudflare Workers.
 */

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface OAuthUser {
  provider: 'google' | 'github';
  providerId: string;
  email: string;
  name: string;
  avatar?: string;
}

// ---------------------------------------------------------------------------
// CSRF State
// ---------------------------------------------------------------------------

/**
 * Generate a random 32-character hex string for OAuth state (CSRF protection).
 */
export function generateState(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ---------------------------------------------------------------------------
// Google OAuth
// ---------------------------------------------------------------------------

/**
 * Build the Google OAuth 2.0 authorization URL.
 */
export function getGoogleAuthUrl(config: OAuthConfig, state: string): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'offline',
    prompt: 'consent',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Exchange an authorization code for a Google access token.
 */
export async function getGoogleToken(
  config: OAuthConfig,
  code: string,
  verifier?: string
): Promise<string> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    signal: AbortSignal.timeout(10000),
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      code,
      ...(verifier ? { code_verifier: verifier } : {}),
      grant_type: 'authorization_code',
    }).toString(),
  });

  if (!response.ok) {
    await response.text();
    throw new Error(`Google token exchange failed (${response.status}): provider request rejected`);
  }

  const data = (await response.json()) as { access_token?: string };
  if (!data.access_token) {
    throw new Error('Google token response missing access_token');
  }
  return data.access_token;
}

/**
 * Fetch the authenticated Google user's profile.
 */
export async function getGoogleUser(accessToken: string): Promise<OAuthUser> {
  const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    signal: AbortSignal.timeout(10000),
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    await response.text();
    throw new Error(`Google user info request failed (${response.status}): provider request rejected`);
  }

  const data = (await response.json()) as {
    id: string;
    email: string;
    name: string;
    picture?: string;
    verified_email?: boolean;
  };

  return {
    provider: 'google',
    providerId: data.id,
    email: data.verified_email ? data.email : "",
    name: data.name,
    avatar: data.picture,
  };
}

// ---------------------------------------------------------------------------
// GitHub OAuth
// ---------------------------------------------------------------------------

/**
 * Build the GitHub OAuth authorization URL.
 */
export function getGitHubAuthUrl(config: OAuthConfig, state: string): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: 'user:email',
    state,
  });
  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

/**
 * Exchange an authorization code for a GitHub access token.
 */
export async function getGitHubToken(
  config: OAuthConfig,
  code: string,
  verifier?: string
): Promise<string> {
  const response = await fetch('https://github.com/login/oauth/access_token', {
    signal: AbortSignal.timeout(10000),
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      code,
      ...(verifier ? { code_verifier: verifier } : {}),
    }),
  });

  if (!response.ok) {
    await response.text();
    throw new Error(`GitHub token exchange failed (${response.status}): provider request rejected`);
  }

  const data = (await response.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };

  if (data.error) {
    throw new Error(
      `GitHub token error: ${data.error} — ${data.error_description ?? ''}`
    );
  }
  if (!data.access_token) {
    throw new Error('GitHub token response missing access_token');
  }
  return data.access_token;
}

/**
 * Fetch the authenticated GitHub user's profile.
 * Falls back to the /user/emails endpoint when the primary profile has no
 * public email address.
 */
export async function getGitHubUser(accessToken: string): Promise<OAuthUser> {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/json',
    'User-Agent': 'Jungle-Digits-App',
  };

  // Fetch user profile
  const userRes = await fetch('https://api.github.com/user', { headers, signal: AbortSignal.timeout(10000) });
  if (!userRes.ok) {
    await userRes.text();
    throw new Error(`GitHub user request failed (${userRes.status}): provider request rejected`);
  }

  const user = (await userRes.json()) as {
    id: number;
    email: string | null;
    name: string | null;
    login: string;
    avatar_url?: string;
  };

  let email = ''; // Only use a verified address from /user/emails.

  // If the profile has no public email, query the emails endpoint
  if (!email) {
    const emailRes = await fetch('https://api.github.com/user/emails', { headers, signal: AbortSignal.timeout(10000) });
    if (emailRes.ok) {
      const emails = (await emailRes.json()) as Array<{
        email: string;
        primary: boolean;
        verified: boolean;
      }>;
      const primary = emails.find((e) => e.primary && e.verified);
      const verified = emails.find((e) => e.verified);
      email = primary?.email ?? verified?.email ?? '';
    }
  }

  return {
    provider: 'github',
    providerId: String(user.id),
    email,
    name: user.name ?? user.login,
    avatar: user.avatar_url,
  };
}
