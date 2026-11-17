# Authentication setup

MFA and Google/GitHub sign-in are implemented. Google and GitHub require OAuth applications owned by you; empty credentials keep their buttons disabled.

## Local use

The local `.env` contains a generated private MFA encryption key. Keep that key stable: changing it prevents existing authenticator secrets from being decrypted. Production must have its own stable 32-byte key (64 hexadecimal characters). Never commit keys or provider secrets.

Set these server-only environment variables, then restart the server:

```text
AUTH_ORIGIN=http://localhost:5173
MFA_ENCRYPTION_KEY=<64 hexadecimal characters>
GOOGLE_CLIENT_ID=<Google web client ID>
GOOGLE_CLIENT_SECRET=<Google web client secret>
GITHUB_CLIENT_ID=<GitHub OAuth client ID>
GITHUB_CLIENT_SECRET=<GitHub OAuth client secret>
```

Generate an encryption key using `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Store it privately. Do not replace an existing key.

## Google

1. Open Google Cloud Console, select/create a project, and configure Google Auth Platform branding, audience, and test users if the app is in testing.
2. Create an OAuth client with application type **Web application**.
3. Register this exact authorized redirect URI for local development:
   `http://localhost:5173/api/oauth/google/callback`
4. For the existing hosted game, register:
   `https://banana-quest-jungle-1105.elvenborage2.chatgpt.site/api/oauth/google/callback`
5. Put the client ID and secret into the corresponding server environment values.

Google reference: https://developers.google.com/identity/protocols/oauth2/web-server

## GitHub

1. Open GitHub Settings ? Developer settings ? OAuth Apps ? New OAuth App.
2. For local development, use homepage `http://localhost:5173` and authorization callback URL:
   `http://localhost:5173/api/oauth/github/callback`
3. Register a separate production OAuth app with homepage:
   `https://banana-quest-jungle-1105.elvenborage2.chatgpt.site`
   and callback URL:
   `https://banana-quest-jungle-1105.elvenborage2.chatgpt.site/api/oauth/github/callback`
4. Generate a client secret and configure the corresponding server environment values.

GitHub reference: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps

## Production

Configure values as runtime environment variables/secrets in Sites, rather than in source or the hosting manifest. Set `AUTH_ORIGIN` to the exact HTTPS site origin, without a trailing path. Configure custom-domain callback URLs separately if using another origin. Redeploy to apply environment changes. Preserve the existing Site access policy.

Apply `drizzle/0002_account_security.sql` once to existing databases after migrations 0000 and 0001. The local database has already been upgraded. New databases need all migrations in order. Do not rerun ALTER statements on already upgraded databases. Local and hosted databases are separate.

## Using MFA

On the login page, select **Set up two-step verification after login** before signing in. Account security opens after successful sign-in. You can also open it later using the lock icon (**Account security**). Enter your current password if applicable, then choose **Set up authenticator**. Scan the QR code or manually enter the setup key in an authenticator app. Confirm with a current six-digit code, then download and save the eight recovery codes privately. Existing other sessions are signed out when MFA is enabled. Each recovery code can be used only once.

The login challenge applies after password login and after Google/GitHub login. The login page provides separate authenticator-code and recovery-code entry modes. Refreshing the page resumes an unexpired verification challenge. Codes cannot be reused in the same TOTP time step; wait for a new authenticator code when changing settings immediately after login. Challenges expire after five minutes and allow five attempts. Enrollment expires after ten minutes. MFA disable/recovery regeneration requires a valid factor and, for password accounts, the current password. Regeneration invalidates previous recovery codes. Provider-only accounts must enroll within ten minutes of signing in.

Provider identities create separate accounts identified by the provider's stable user ID. Existing password accounts are never automatically merged by email. Scores and coins remain attached to the account used to sign in.

## Verification

- `node --experimental-vm-modules scripts/auth-security-test.mjs`: isolated in-memory SQLite tests; provider HTTP is mocked.
- `node scripts/auth-browser-test.mjs`: Chrome checks (including independent QR decoding) against the running local server; creates and removes an isolated local test player.
- `node node_modules/typescript/bin/tsc --noEmit --incremental false`
- `npm run build`

Real provider consent/login must be verified after registering the OAuth apps and configuring their credentials. Those external checks cannot run with placeholder credentials.
