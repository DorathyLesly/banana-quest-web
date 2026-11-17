import { env } from "cloudflare:workers";
import { generateTOTPSecret, generateTOTP, getTOTPUri, generateBackupCodes } from "./totp";
import { getGoogleAuthUrl, getGoogleToken, getGoogleUser, getGitHubAuthUrl, getGitHubToken, getGitHubUser, type OAuthConfig } from "./oauth";
export const hex = (bytes: ArrayBuffer | Uint8Array) => Array.from(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes), x => x.toString(16).padStart(2, "0")).join("");
export const random = () => hex(crypto.getRandomValues(new Uint8Array(32)));
export const hash = async (value: string) => hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
export function equal(a: string, b: string) { let diff = a.length ^ b.length; for (let i = 0; i < Math.max(a.length, b.length); i++)
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0); return diff === 0; }
export async function password(value: string, salt: string) { const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(value), "PBKDF2", false, ["deriveBits"]); return hex(await crypto.subtle.deriveBits({ name: "PBKDF2", salt: new TextEncoder().encode(salt), iterations: 100000, hash: "SHA-256" }, key, 256)); }
const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
export function cookie(request: Request, name: string, value: string, age: number) { return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`; }
function readCookie(request: Request, name: string) { return request.headers.get("cookie")?.split(";").map(x => x.trim()).find(x => x.startsWith(name + "="))?.slice(name.length + 1) || ""; }
function redirect(path: string, cookies: string[] = []) { const headers = new Headers({ Location: path, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" }); for (const value of cookies)
    headers.append("Set-Cookie", value); return new Response(null, { status: 303, headers }); }
async function key() { const value = env.MFA_ENCRYPTION_KEY; if (!value || !/^[a-f0-9]{64}$/i.test(value))
    throw Error("MFA encryption key is not configured"); return crypto.subtle.importKey("raw", Uint8Array.from(value.match(/../g)!, x => parseInt(x, 16)), "AES-GCM", false, ["encrypt", "decrypt"]); }
export async function seal(secret: string) { const iv = crypto.getRandomValues(new Uint8Array(12)); return hex(iv) + ":" + hex(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await key(), new TextEncoder().encode(secret))); }
export async function unseal(value: string) { const [iv, data] = value.split(":"); if (!iv || !data)
    throw Error("Invalid encrypted secret"); return new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: Uint8Array.from(iv.match(/../g)!, x => parseInt(x, 16)) }, await key(), Uint8Array.from(data.match(/../g)!, x => parseInt(x, 16)))); }
export async function totpStep(secret: string, code: string) { if (!/^\d{6}$/.test(code))
    return -1; const now = Math.floor(Date.now() / 30000); for (const offset of [-1, 0, 1])
    if (equal(await generateTOTP(secret, (now + offset) * 30), code))
        return now + offset; return -1; }
export async function createSession(request: Request, user: any) { const raw = random(); await env.DB!.prepare("INSERT INTO sessions(token,username,expires) VALUES(?,?,?)").bind(await hash(raw), user.username, Date.now() + 604800000).run(); return cookie(request, "bq_session", raw, 604800); }
export async function finishLogin(request: Request, user: any, oauth = false) {
    if (user.mfa_enabled) {
        await env.DB!.prepare("DELETE FROM auth_challenges WHERE expires<?").bind(Date.now()).run();
        const raw = random();
        await env.DB!.prepare("INSERT INTO auth_challenges(token,username,expires,attempts) VALUES(?,?,?,0)").bind(await hash(raw), user.username, Date.now() + 300000).run();
        const headers = new Headers({ "Cache-Control": "no-store" });
        headers.append("Set-Cookie", cookie(request, "bq_mfa", raw, 300));
        headers.append("Set-Cookie", cookie(request, "bq_session", "", 0));
        return oauth ? redirect("/?auth=mfa", [cookie(request, "bq_mfa", raw, 300), cookie(request, "bq_session", "", 0)]) : Response.json({ mfaRequired: true }, { headers });
    }
    const session = await createSession(request, user);
    return oauth ? redirect("/?auth=success", [session]) : Response.json({ user: { name: user.display_name, best: user.best, games: user.games, coins: user.coins } }, { headers: { "Cache-Control": "no-store", "Set-Cookie": session } });
}
function config(provider: string, request: Request): OAuthConfig | null {
    const clientId = provider === "google" ? env.GOOGLE_CLIENT_ID : env.GITHUB_CLIENT_ID;
    const clientSecret = provider === "google" ? env.GOOGLE_CLIENT_SECRET : env.GITHUB_CLIENT_SECRET;
    if (!clientId || !clientSecret || !env.AUTH_ORIGIN) return null;
    let origin: URL;
    try { origin = new URL(env.AUTH_ORIGIN); } catch { return null; }
    const requested = new URL(request.url);
    const loopback = new Set(["localhost", "127.0.0.1", "[::1]"]);
    const localAlias = origin.protocol === "http:" && requested.protocol === "http:"
        && origin.port === requested.port && loopback.has(origin.hostname) && loopback.has(requested.hostname);
    if (origin.origin !== requested.origin && !localAlias) return null;
    return { clientId, clientSecret, redirectUri: origin.origin + `/api/oauth/${provider}/callback` };
}
async function attempt(user: any) { const result = await env.DB!.prepare("UPDATE players SET failures=failures+1,locked_until=CASE WHEN failures>=4 THEN ? ELSE 0 END WHERE username=? AND locked_until<=? RETURNING failures").bind(Date.now() + 30000, user.username, Date.now()).first<any>(); return !!result; }
async function verifyFactor(user: any, code: string) {
    if (!await attempt(user))
        return false;
    const normalized = code.trim().toUpperCase();
    if (/^[A-Z0-9]{8}$/.test(normalized)) {
        const digest = await hash(normalized);
        const old = user.mfa_backup_codes || "[]";
        const codes = JSON.parse(old) as string[];
        if (!codes.includes(digest))
            return false;
        const result = await env.DB!.prepare("UPDATE players SET mfa_backup_codes=?,failures=0,locked_until=0 WHERE username=? AND mfa_enabled=1 AND mfa_backup_codes=?").bind(JSON.stringify(codes.filter(x => x !== digest)), user.username, old).run();
        return !!result.meta.changes;
    }
    const step = await totpStep(await unseal(user.mfa_secret), normalized);
    if (step < 0)
        return false;
    const result = await env.DB!.prepare("UPDATE players SET mfa_last_step=?,failures=0,locked_until=0 WHERE username=? AND mfa_enabled=1 AND COALESCE(mfa_last_step,-1)<?").bind(step, user.username, step).run();
    return !!result.meta.changes;
}
export async function authHandler(request: Request): Promise<Response | null> {
    const url = new URL(request.url), action = url.pathname.slice(5), db = env.DB!;
    if (!["profile", "auth-config", "mfa-status", "mfa-login", "mfa-cancel", "security", "mfa-setup", "mfa-enable", "mfa-disable", "mfa-backup"].includes(action) && !action.startsWith("oauth/"))
        return null;
    if (!db)
        return json({ error: "Account storage is unavailable." }, 503);
    if (["profile", "auth-config", "mfa-status", "security"].includes(action) && request.method !== "GET")
        return json({ error: "Use GET for this action." }, 405);
    if (request.method === "POST" && request.headers.get("origin") && request.headers.get("origin") !== url.origin)
        return json({ error: "Invalid request origin." }, 403);
    if (action === "auth-config" && request.method === "GET")
        return json({ google: !!config("google", request), github: !!config("github", request) });
    if (action === "mfa-status" && request.method === "GET") {
        const raw = readCookie(request, "bq_mfa");
        const pending = raw ? await db.prepare("SELECT 1 FROM auth_challenges c JOIN players p ON p.username=c.username WHERE c.token=? AND c.expires>? AND c.attempts<5 AND p.mfa_enabled=1").bind(await hash(raw), Date.now()).first() : null;
        return json({ mfaPending: !!pending });
    }
    if (action.startsWith("oauth/")) {
        if (request.method !== "GET")
            return json({ error: "Use GET." }, 405);
        const [, provider, callback] = action.split("/");
        if (!["google", "github"].includes(provider) || callback && callback !== "callback")
            return json({ error: "Unknown provider." }, 404);
        const settings = config(provider, request);
        if (!settings)
            return redirect("/?auth=unconfigured");
        // Bind the OAuth state cookie to the same host as the registered callback.
        // Move local aliases to that host before generating any state or cookies.
        const canonicalOrigin = new URL(settings.redirectUri).origin;
        if (url.origin !== canonicalOrigin) {
            return redirect(canonicalOrigin + (callback ? "/?auth=failed" : url.pathname));
        }
        if (!callback) {
            const raw = random(), state = random(), verifier = random();
            await db.prepare("DELETE FROM oauth_states WHERE expires<?").bind(Date.now()).run();
            await db.prepare("INSERT INTO oauth_states(token,state,provider,expires,verifier) VALUES(?,?,?,?,?)").bind(await hash(raw), state, provider, Date.now() + 600000, verifier).run();
            const target = new URL(provider === "google" ? getGoogleAuthUrl(settings, state) : getGitHubAuthUrl(settings, state));
            const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
            target.searchParams.set("code_challenge", btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_"));
            target.searchParams.set("code_challenge_method", "S256");
            return redirect(target.href, [cookie(request, "bq_oauth", raw, 600)]);
        }
        const browser = readCookie(request, "bq_oauth");
        const clear = cookie(request, "bq_oauth", "", 0);
        const state = browser ? await db.prepare("DELETE FROM oauth_states WHERE token=? AND state=? AND provider=? AND expires>? RETURNING *").bind(await hash(browser), url.searchParams.get("state") || "", provider, Date.now()).first<any>() : null;
        if (!state || url.searchParams.has("error") || !url.searchParams.get("code"))
            return redirect("/?auth=failed", [clear]);
        try {
            const code = url.searchParams.get("code")!;
            const access = provider === "google" ? await getGoogleToken(settings, code, state.verifier) : await getGitHubToken(settings, code, state.verifier);
            const profile = provider === "google" ? await getGoogleUser(access) : await getGitHubUser(access);
            if (!profile.providerId)
                throw Error("Missing provider identity");
            let user = await db.prepare("SELECT * FROM players WHERE oauth_provider=? AND oauth_id=?").bind(provider, profile.providerId).first<any>();
            // Provider IDs are authoritative. Never merge accounts by email.
            if (!user) {
                const username = provider + "_" + random().slice(0, 24);
                await db.prepare("INSERT INTO players(username,display_name,salt,password_hash,email,oauth_provider,oauth_id,avatar) VALUES(?,?,?, ?,?,?,?,?) ON CONFLICT(oauth_provider,oauth_id) DO NOTHING").bind(username, (profile.name || provider + " player").slice(0, 60), "", "", profile.email, provider, profile.providerId, profile.avatar || null).run();
                user = await db.prepare("SELECT * FROM players WHERE oauth_provider=? AND oauth_id=?").bind(provider, profile.providerId).first<any>();
            }
            const response = await finishLogin(request, user, true);
            response.headers.append("Set-Cookie", clear);
            return response;
        }
        catch {
            return redirect("/?auth=failed", [clear]);
        }
    }
    if (!["GET", "POST"].includes(request.method))
        return json({ error: "Method not allowed." }, 405);
    if (!["security", "profile"].includes(action) && request.method !== "POST")
        return json({ error: "Use POST." }, 405);
    const body = request.method === "POST" ? await request.json().catch(() => ({})) as any : {};
    if (action === "mfa-cancel") {
        await db.prepare("DELETE FROM auth_challenges WHERE token=?").bind(await hash(readCookie(request, "bq_mfa"))).run();
        return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store", "Set-Cookie": cookie(request, "bq_mfa", "", 0) } });
    }
    if (action === "mfa-login") {
        const raw = readCookie(request, "bq_mfa");
        const token = await hash(raw);
        const challenge = await db.prepare("UPDATE auth_challenges SET attempts=attempts+1 WHERE token=? AND expires>? AND attempts<5 RETURNING *").bind(token, Date.now()).first<any>();
        if (!challenge)
            return json({ error: "Verification expired. Log in again." }, 401);
        const user = await db.prepare("SELECT * FROM players WHERE username=?").bind(challenge.username).first<any>();
        if (!user?.mfa_enabled || !await verifyFactor(user, String(body.code || "")))
            return json({ error: "Invalid or already used code. Try a fresh code or a backup code." }, 401);
        const claimed = await db.prepare("DELETE FROM auth_challenges WHERE token=? RETURNING token").bind(token).first();
        if (!claimed)
            return json({ error: "Verification already used. Log in again." }, 401);
        const response = Response.json({ user: { name: user.display_name, best: user.best, games: user.games, coins: user.coins } }, { headers: { "Cache-Control": "no-store" } });
        response.headers.append("Set-Cookie", await createSession(request, user));
        response.headers.append("Set-Cookie", cookie(request, "bq_mfa", "", 0));
        return response;
    }
    const token = await hash(readCookie(request, "bq_session"));
    const session = await db.prepare("SELECT * FROM sessions WHERE token=? AND expires>?").bind(token, Date.now()).first<any>();
    if (!session)
        return json({ error: "Please log in." }, 401);
    const user = await db.prepare("SELECT * FROM players WHERE username=?").bind(session.username).first<any>();
    if (action === "profile") {
        if (!user) return json({ error: "Please log in." }, 401);
        return json({ profile: {
            username: user.username, name: user.display_name, email: user.email || null,
            provider: user.oauth_provider || "password", best: user.best, coins: user.coins,
            games: user.games, mfaEnabled: !!user.mfa_enabled
        } });
    }
    if (action === "security")
        return json({ enabled: !!user.mfa_enabled, hasPassword: !!user.password_hash, provider: user.oauth_provider, backupRemaining: JSON.parse(user.mfa_backup_codes || "[]").length, available: !!env.MFA_ENCRYPTION_KEY });
    if (user.locked_until > Date.now())
        return json({ error: "Too many attempts. Wait 30 seconds." }, 429);
    if (action === "mfa-setup" || action === "mfa-disable" || action === "mfa-backup") {
        if (user.password_hash) {
            if (!await attempt(user) || !equal(await password(String(body.password || ""), user.salt), user.password_hash))
                return json({ error: "Password is incorrect." }, 401);
        }
        else if (action === "mfa-setup" && session.expires - 604800000 < Date.now() - 600000)
            return json({ error: "Log out and sign in again before enabling MFA." }, 401);
    }
    if (action === "mfa-setup") {
        if (user.mfa_enabled)
            return json({ error: "MFA is already enabled." }, 409);
        if (!env.MFA_ENCRYPTION_KEY)
            return json({ error: "MFA is awaiting server encryption-key configuration." }, 503);
        const secret = await generateTOTPSecret();
        await db.prepare("INSERT INTO mfa_setups(token,username,secret,expires,attempts) VALUES(?,?,?,?,0) ON CONFLICT(token) DO UPDATE SET secret=excluded.secret,expires=excluded.expires,attempts=0").bind(token, user.username, await seal(secret), Date.now() + 600000).run();
        return json({ secret, uri: getTOTPUri(secret, user.username) });
    }
    if (action === "mfa-enable") {
        const setup = await db.prepare("UPDATE mfa_setups SET attempts=attempts+1 WHERE token=? AND username=? AND expires>? AND attempts<5 RETURNING *").bind(token, user.username, Date.now()).first<any>();
        if (!setup || user.mfa_enabled)
            return json({ error: "Setup expired. Start again." }, 400);
        const step = await totpStep(await unseal(setup.secret), String(body.code || ""));
        if (step < 0)
            return json({ error: "Incorrect code. Try the current authenticator code." }, 400);
        const codes = generateBackupCodes(), digests = await Promise.all(codes.map(hash));
        const updated = await db.prepare("UPDATE players SET mfa_secret=?,mfa_enabled=1,mfa_last_step=?,mfa_backup_codes=?,failures=0,locked_until=0 WHERE username=? AND mfa_enabled=0").bind(setup.secret, step, JSON.stringify(digests), user.username).run();
        if (!updated.meta.changes)
            return json({ error: "MFA is already enabled." }, 409);
        await db.batch([db.prepare("DELETE FROM mfa_setups WHERE username=?").bind(user.username), db.prepare("DELETE FROM sessions WHERE username=? AND token<>?").bind(user.username, token), db.prepare("DELETE FROM auth_challenges WHERE username=?").bind(user.username)]);
        return json({ enabled: true, backupCodes: codes });
    }
    if (!user.mfa_enabled || !await verifyFactor(user, String(body.code || "")))
        return json({ error: "Enter a fresh authenticator code or an unused backup code." }, 401);
    if (action === "mfa-disable") {
        await db.prepare("UPDATE players SET mfa_enabled=0,mfa_secret=NULL,mfa_backup_codes=NULL,mfa_last_step=-1 WHERE username=?").bind(user.username).run();
        await db.batch([db.prepare("DELETE FROM auth_challenges WHERE username=?").bind(user.username), db.prepare("DELETE FROM sessions WHERE username=? AND token<>?").bind(user.username, token)]);
        return json({ enabled: false });
    }
    const codes = generateBackupCodes();
    await db.prepare("UPDATE players SET mfa_backup_codes=? WHERE username=? AND mfa_enabled=1").bind(JSON.stringify(await Promise.all(codes.map(hash))), user.username).run();
    return json({ backupCodes: codes });
}
