import assert from "node:assert/strict";
import {chromium} from "@playwright/test";
import {readFileSync,mkdirSync} from "node:fs";
import {spawnSync} from "node:child_process";
import ts from "typescript";
const source=ts.transpileModule(readFileSync("lib/totp.ts","utf8"),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {generateTOTP}=await import("data:text/javascript;base64,"+Buffer.from(source).toString("base64"));
const browser=await chromium.launch({executablePath:"C:/Program Files/Google/Chrome/Application/chrome.exe",headless:true});
const context=await browser.newContext({viewport:{width:1440,height:960}}),page=await context.newPage(),errors=[];page.on("pageerror",e=>errors.push(e.message));
const username="mfatest_"+Date.now().toString().slice(-10),password="MfaTest123!";mkdirSync("outputs",{recursive:true});
try{
 assert.ok((await context.request.post("http://localhost:5173/api/register",{data:{username,password}})).ok());
 await page.goto("http://localhost:5173",{waitUntil:"networkidle"});await page.getByRole("button",{name:"Start now",exact:true}).click();
 await page.getByLabel("Username",{exact:true}).fill(username);await page.getByLabel("Password",{exact:true}).fill(password);
 await page.getByRole("checkbox",{name:"Set up two-step verification after login"}).check();await page.getByRole("button",{name:"Log in",exact:true}).click();
 await page.getByRole("dialog",{name:"ACCOUNT SECURITY"}).waitFor();
 await page.getByLabel("Current password").fill(password);await page.getByRole("button",{name:"Set up authenticator",exact:true}).click();await page.locator(".setup-key").waitFor();const secret=await page.locator(".setup-key").innerText();assert.match(secret,/^[A-Z2-7]{32}$/);
 await page.addScriptTag({path:"node_modules/jsqr/dist/jsQR.js"});const qr=page.getByAltText("Authenticator setup QR code");await qr.waitFor();assert.ok(await qr.evaluate(img=>img.complete&&img.naturalWidth>0));
 const decoded=await qr.evaluate(async img=>{await img.decode();const canvas=document.createElement("canvas");canvas.width=canvas.height=800;const ctx=canvas.getContext("2d");ctx.imageSmoothingEnabled=false;ctx.drawImage(img,0,0,800,800);return window.jsQR(ctx.getImageData(0,0,800,800).data,800,800)?.data});assert.ok(decoded,"Setup QR must decode");assert.equal(new URL(decoded).searchParams.get("secret"),secret);
 await page.getByLabel("Authenticator or recovery code").fill(await generateTOTP(secret));await page.getByRole("button",{name:"Confirm and enable MFA",exact:true}).click();await page.locator(".recovery-codes").waitFor();const codes=await page.locator(".recovery-codes code").allTextContents();assert.equal(codes.length,8);
 const downloadPromise=page.waitForEvent("download");await page.getByRole("button",{name:"Download recovery codes"}).click();assert.equal((await downloadPromise).suggestedFilename(),"jungle-digits-recovery-codes.txt");
 await page.screenshot({path:"outputs/mfa-enabled-desktop.png"});await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:"outputs/mfa-enabled-mobile.png"});
 await page.getByRole("button",{name:"I saved my codes"}).click();await page.getByRole("button",{name:"Close security settings"}).click();await page.getByRole("link",{name:"View profile",exact:true}).click();await page.waitForURL("**/profile");await page.getByRole("heading",{name:"My profile",exact:true}).waitFor();await page.getByRole("heading",{name:username,exact:true}).waitFor();assert.equal(await page.locator(".profile-badge").innerText(),"Enabled");assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.reload({waitUntil:"networkidle"});await page.getByRole("heading",{name:username,exact:true}).waitFor();await page.getByRole("link",{name:"Continue to game",exact:true}).click();await page.getByRole("button",{name:"Play",exact:true}).waitFor();await page.getByRole("button",{name:"Log out",exact:true}).click();await page.getByLabel("Username",{exact:true}).fill(username);await page.getByLabel("Password",{exact:true}).fill(password);await page.getByRole("button",{name:"Log in",exact:true}).click();await page.getByLabel("Verification code").waitFor();assert.equal((await context.request.get("http://localhost:5173/api/session")).status(),401);
 await page.reload({waitUntil:"networkidle"});await page.getByLabel("Verification code").waitFor();await page.getByRole("button",{name:"Use a recovery code",exact:true}).click();await page.getByLabel("Recovery code",{exact:true}).fill(codes[0]);await page.getByRole("button",{name:"Verify and log in"}).click();await page.getByRole("button",{name:"Account security"}).waitFor();
 await page.getByRole("button",{name:"Play",exact:true}).click();await page.locator(".keypad").waitFor();let answers=0;page.on("request",r=>{if(r.url().endsWith("/api/answer"))answers++});await page.getByRole("button",{name:"Account security"}).click();await page.getByLabel("Current password").pressSequentially(password);assert.equal(answers,0,"Security input must not trigger game answers");await page.getByLabel("Authenticator or recovery code").fill(codes[1]);await page.getByRole("button",{name:"Disable MFA",exact:true}).click();await page.getByText("Multifactor authentication disabled.",{exact:true}).waitFor();assert.equal((await(await context.request.get("http://localhost:5173/api/security")).json()).enabled,false);
 assert.deepEqual(errors,[]);console.log("PASS: browser login-page MFA setup, refresh recovery, QR decoding, recovery-code download, desktop/mobile layout, login challenge, recovery login, and disabling MFA.");
}finally{
 await browser.close();const cleanup=spawnSync("python",["-c",`from pathlib import Path
import sqlite3,sys
name=sys.argv[1]
assert name.startswith('mfatest_')
for p in Path('.wrangler/state/v3/d1/miniflare-D1DatabaseObject').glob('*.sqlite'):
 d=sqlite3.connect(p)
 if d.execute("SELECT name FROM sqlite_master WHERE name='players'").fetchone():
  for table in ['game_events','sessions','auth_challenges','mfa_setups']:d.execute('DELETE FROM '+table+' WHERE username=?',(name,))
  d.execute('DELETE FROM players WHERE username=?',(name,));d.commit()
 d.close()`,username],{encoding:"utf8"});if(cleanup.status)throw Error(cleanup.stderr);
}
