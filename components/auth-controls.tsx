"use client";
import { useEffect, useState } from "react";
import type { User } from "@/lib/game";
import { LockKeyhole } from "lucide-react";
import { generateQRSvg } from "@/lib/qr";
async function call(action: string, body?: unknown) { const response = await fetch("/api/" + action, { method: body === undefined ? "GET" : "POST", headers: body === undefined ? {} : { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) }); const data = await response.json() as any; if (!response.ok)
    throw Error(data.error || "Please try again."); return data; }
export function SocialLogin({setupMfa=false}:{setupMfa?:boolean}) {
    const [available, setAvailable] = useState<boolean | null>(null);
    useEffect(() => {
        let mounted = true;
        call("auth-config").then(config => { if (mounted) setAvailable(!!config.google); })
            .catch(() => { if (mounted) setAvailable(false); });
        return () => { mounted = false; };
    }, []);
    return <div className="social-login">
        <p>Or sign in with Google</p>
        {available ? <a className="secondary" href="/api/oauth/google" target="_top" onClick={()=>{try{if(setupMfa)sessionStorage.setItem("bq-setup-mfa","yes");else sessionStorage.removeItem("bq-setup-mfa")}catch{}}}>Continue with Google</a>
            : <button className="secondary" disabled>{available === null ? "Loading Google sign-in..." : "Google sign-in unavailable"}</button>}
    </div>;
}
export function MfaLogin({ onSuccess, onCancel }: {
    onSuccess: (user: User) => void;
    onCancel: () => void;
}) {
    const [code, setCode] = useState("");
    const [recovery, setRecovery] = useState(false);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    return <div className="auth-card mfa-login-card">
        <div className="card-sprout"><LockKeyhole size={23}/></div>
        <p className="mfa-step">STEP 2 OF 2</p>
        <h2>TWO-STEP VERIFICATION</h2>
        <p className="mfa-description">{recovery ? "Enter one of the recovery codes you saved when setting up MFA." : "Open your authenticator app and enter its current 6-digit code."}</p>
        <form onSubmit={async e => {
            e.preventDefault(); setBusy(true); setError("");
            try { const data = await call("mfa-login", { code }); onSuccess(data.user); }
            catch (e) { setError((e as Error).message); }
            finally { setBusy(false); }
        }}>
            <label>{recovery ? "Recovery code" : "Verification code"}
                <input key={String(recovery)} className="mfa-code-input" autoFocus autoComplete="one-time-code" name="code"
                    inputMode={recovery ? "text" : "numeric"} value={code}
                    onChange={e => setCode(recovery ? e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") : e.target.value.replace(/[^0-9]/g, ""))}
                    minLength={recovery ? 8 : 6} maxLength={recovery ? 8 : 6} required disabled={busy}/>
            </label>
            {error && <p role="alert" className="alert">{error}</p>}
            <button className="primary full" disabled={busy}>{busy ? "Verifying..." : "Verify and log in"}</button>
            <button className="back-link" type="button" disabled={busy} onClick={()=>{setRecovery(!recovery);setCode("");setError("")}}>{recovery ? "Use an authenticator code" : "Use a recovery code"}</button>
            <button className="back-link" type="button" disabled={busy} onClick={async()=>{
                setBusy(true);try{await call("mfa-cancel",{});onCancel()}catch(e){setError((e as Error).message)}finally{setBusy(false)}
            }}>Back to login</button>
        </form>
        <p className="field-hint">For your security, verification expires after 5 minutes.</p>
    </div>;
}
export function SecurityPanel({ onClose }: {
    onClose: () => void;
}) {
    const [status, setStatus] = useState<{
        enabled: boolean;
        hasPassword: boolean;
        backupRemaining: number;
        available: boolean;
        provider: string;
    } | null>(null), [setup, setSetup] = useState<{
        secret: string;
        uri: string;
    } | null>(null), [codes, setCodes] = useState<string[]>([]), [password, setPassword] = useState(""), [code, setCode] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
    const refresh = () => call("security").then(setStatus);
    useEffect(() => { refresh().catch(e => setError(e.message)); }, []);
    async function run(action: string) { setBusy(true); setError(""); setNotice(""); try {
        const data = await call(action, { password, code });
        if (data.secret)
            setSetup(data);
        if (data.backupCodes) {
            setCodes(data.backupCodes);
            setSetup(null);
            setNotice("Save these recovery codes now. Each code works once.");
        }
        if (action === "mfa-disable") {
            setSetup(null);
            setCodes([]);
            setNotice("Multifactor authentication disabled.");
        }
        if (action === "mfa-enable")
            setNotice("Multifactor authentication enabled. Save your recovery codes now; each works once. Other sessions have been signed out.");
        setCode("");
        setPassword("");
        await refresh();
    }
    catch (e) {
        setError((e as Error).message);
    }
    finally {
        setBusy(false);
    } }
    return <div className="modal-backdrop"><section className="modal security-panel" role="dialog" aria-modal="true" aria-labelledby="security-title"><button className="modal-close" aria-label="Close security settings" onClick={onClose}>&#215;</button><h2 id="security-title">ACCOUNT SECURITY</h2>{!status ? <p role="status">Loading...</p> : <><p>Multifactor authentication: <strong>{status.enabled ? "Enabled" : "Disabled"}</strong></p>{status.enabled && <p>{status.backupRemaining} recovery codes remaining.</p>}{!status.available && <p className="alert">Server encryption-key configuration is required before MFA can be enabled.</p>}{codes.length > 0 ? <><p role="status">{notice}</p><div className="recovery-codes">{codes.map(value => <code key={value}>{value}</code>)}</div><button className="secondary" onClick={() => { const url = URL.createObjectURL(new Blob(["Jungle Digits recovery codes ? keep private\n\n" + codes.join("\n")], { type: "text/plain" })); const link = document.createElement("a"); link.href = url; link.download = "jungle-digits-recovery-codes.txt"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }}>Download recovery codes</button><button className="primary full" onClick={() => { setCodes([]); setNotice(""); onClose(); }}>I saved my codes</button></> : <form onSubmit={e => { e.preventDefault(); run(setup ? "mfa-enable" : status.enabled ? "mfa-backup" : "mfa-setup"); }}>{setup ? <><p>Scan this QR code using your authenticator app, or enter the setup key manually.</p><img className="mfa-qr" alt="Authenticator setup QR code" src={"data:image/svg+xml;charset=utf-8," + encodeURIComponent(generateQRSvg(setup.uri, 220))}/><p>Setup key: <code className="setup-key">{setup.secret}</code></p><p>Setup expires after 10 minutes.</p></> : status.hasPassword ? <label>Current password<input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required disabled={busy}/></label> : <p>{status.enabled ? "Use your authenticator or an unused recovery code to change MFA settings." : "Enable MFA within 10 minutes of signing in."}</p>}{(setup || status.enabled) && <label>Authenticator or recovery code<input autoComplete="one-time-code" value={code} onChange={e => setCode(e.target.value)} maxLength={8} required disabled={busy}/></label>}<button className="primary full" disabled={busy || !status.available}>{busy ? "Saving..." : setup ? "Confirm and enable MFA" : status.enabled ? "Generate new recovery codes" : "Set up authenticator"}</button>{setup && <button type="button" className="back-link" disabled={busy} onClick={() => { setSetup(null); setCode(""); }}>Cancel setup</button>}{status.enabled && <button className="secondary full" type="button" disabled={busy || !code || status.hasPassword && !password} onClick={() => run("mfa-disable")}>Disable MFA</button>}</form>}</>}{error && <p className="alert" role="alert">{error}</p>}{notice && !codes.length && <p role="status">{notice}</p>}<button className="primary full" onClick={onClose}>{status?.enabled ? "Continue to game" : "Close"}</button></section></div>;
}
