declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BANANA_API_URL?: string;
    BANANA_API_TIMEOUT_MS?: string;
    BUCKET?: R2Bucket;
  }
}
