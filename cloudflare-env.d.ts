declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    MFA_ENCRYPTION_KEY?: string;
    AUTH_ORIGIN?: string;
    GOOGLE_CLIENT_ID?: string;
    GOOGLE_CLIENT_SECRET?: string;
    GITHUB_CLIENT_ID?: string;
    GITHUB_CLIENT_SECRET?: string;
    BANANA_API_URL?: string;
    BANANA_API_TIMEOUT_MS?: string;
    BUCKET?: R2Bucket;
  }
}
