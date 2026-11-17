import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {DatabaseSync} from "node:sqlite";
import {SourceTextModule,SyntheticModule} from "node:vm";
import ts from "typescript";
const sqlite=new DatabaseSync(":memory:");
for(const file of ["0000_fixed_captain_britain","0001_fat_the_renegades","0002_account_security"])sqlite.exec(readFileSync(`drizzle/${file}.sql`,"utf8"));
const env={MFA_ENCRYPTION_KEY:"a".repeat(64),AUTH_ORIGIN:"https://game.test",GOOGLE_CLIENT_ID:"test-google",GOOGLE_CLIENT_SECRET:"secret",GITHUB_CLIENT_ID:"test-github",GITHUB_CLIENT_SECRET:"secret"};
function prepare(sql){let values=[];return {bind(...args){values=args;return this},async first(){return sqlite.prepare(sql).get(...values)||null},async all(){return {results:sqlite.prepare(sql).all(...values)}},async run(){const result=sqlite.prepare(sql).run(...values);return {meta:{changes:Number(result.changes)}}}}}
env.DB={prepare,async batch(statements){sqlite.exec("BEGIN");try{const results=[];for(const s of statements)results.push(await s.run());sqlite.exec("COMMIT");return results}catch(e){sqlite.exec("ROLLBACK");throw e}}};
const modules=new Map();const envModule=new SyntheticModule(["env"],function(){this.setExport("env",env)});
async function load(name){if(modules.has(name))return modules.get(name);const file=name==="route"?"app/api/[action]/route.ts":`lib/${name}.ts`;const code=ts.transpileModule(readFileSync(file,"utf8"),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;const mod=new SourceTextModule(code,{identifier:name});modules.set(name,mod);await mod.link(async spec=>spec==="cloudflare:workers"?envModule:load(spec.replace(/^@\/lib\//,"").replace(/^\.\//,"")));return mod}
const authMod=await load("auth"),totpMod=await load("totp"),route=await load("route");await authMod.evaluate();await totpMod.evaluate();await route.evaluate();const auth=authMod.namespace,totp=totpMod.namespace;
let now=1800000000000;Date.now=()=>now;const jar=new Map();
async function request(action,body,origin="https://game.test"){const method=body===undefined?"GET":"POST";const r=new Request("https://game.test/api/"+action,{method,headers:{Cookie:[...jar].map(([k,v])=>`${k}=${v}`).join("; "),Origin:origin,...(body===undefined?{}:{"Content-Type":"application/json"})},body:body===undefined?undefined:JSON.stringify(body)});const response=await route.namespace[method](r);for(const value of response.headers.getSetCookie()){const [pair]=value.split(";");const n=pair.indexOf("=");jar.set(pair.slice(0,n),pair.slice(n+1))}return {response,data:response.headers.get("content-type")?.includes("json")?await response.json():null}}
assert.equal((await request("mfa-status",{})).response.status,405);
assert.equal((await request("auth-config",{})).response.status,405);
assert.equal((await request("mfa-status")).data.mfaPending,false);
const credentials={username:"security_test",password:"Test123!"};
assert.equal(await totp.generateTOTP("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ",59),"287082");
assert.equal((await request("register",credentials)).response.status,200);
assert.equal((await request("login",credentials)).response.status,200);
assert.equal((await request("mfa-setup",credentials,"https://evil.test")).response.status,403);
const setup=(await request("mfa-setup",credentials)).data;assert.ok(setup.secret&&setup.uri.startsWith("otpauth://"));
assert.equal((await request("mfa-enable",{code:"bad"})).response.status,400);
const enabled=(await request("mfa-enable",{code:await totp.generateTOTP(setup.secret)})).data;assert.equal(enabled.backupCodes.length,8);
const player=sqlite.prepare("SELECT * FROM players WHERE username=?").get(credentials.username);assert.ok(!player.mfa_secret.includes(setup.secret));assert.ok(!player.mfa_backup_codes.includes(enabled.backupCodes[0]));assert.equal(await auth.unseal(player.mfa_secret),setup.secret);
await request("logout",{});assert.equal((await request("login",credentials)).data.mfaRequired,true);assert.equal((await request("session")).response.status,401);assert.equal((await request("mfa-status")).data.mfaPending,true);
assert.equal((await request("mfa-login",{code:await totp.generateTOTP(setup.secret)})).response.status,401,"setup code replay rejected");
now+=30000;assert.equal((await request("mfa-login",{code:await totp.generateTOTP(setup.secret)})).response.status,200);
await request("logout",{});await request("login",credentials);assert.equal((await request("mfa-login",{code:enabled.backupCodes[0]})).response.status,200);
await request("logout",{});await request("login",credentials);assert.equal((await request("mfa-login",{code:enabled.backupCodes[0]})).response.status,401,"backup replay rejected");
for(let i=0;i<4;i++)await request("mfa-login",{code:"bad"});assert.equal((await request("mfa-login",{code:enabled.backupCodes[1]})).response.status,401,"challenge attempt limit");
now+=31000;await request("login",credentials);now+=300001;assert.equal((await request("mfa-login",{code:enabled.backupCodes[1]})).response.status,401,"expired challenge rejected");assert.equal((await request("mfa-status")).data.mfaPending,false);
await request("login",credentials);await request("mfa-login",{code:enabled.backupCodes[1]});
const regenerated=(await request("mfa-backup",{password:credentials.password,code:enabled.backupCodes[2]})).data;assert.equal(regenerated.backupCodes.length,8);
assert.equal((await request("mfa-disable",{password:"wrong",code:regenerated.backupCodes[0]})).response.status,401);
assert.equal((await request("mfa-disable",{password:credentials.password,code:regenerated.backupCodes[0]})).response.status,200);assert.equal((await request("security")).data.enabled,false);
let seenVerifier=false;
globalThis.fetch=async(input,init)=>{const url=String(input);if(url.includes("/token")||url.includes("access_token")){seenVerifier=String(init.body).includes("code_verifier");return Response.json({access_token:"test-token"})}if(url.includes("googleapis.com"))return Response.json({id:"google-person",email:"verified@example.test",verified_email:true,name:"Google Player"});if(url.endsWith("/user/emails"))return Response.json([{email:"github@example.test",primary:true,verified:true}]);return Response.json({id:123,name:"GitHub Player",login:"githubplayer"})};
async function oauth(provider){const start=await request("oauth/"+provider);assert.equal(start.response.status,303);const target=new URL(start.response.headers.get("Location"));assert.ok(target.searchParams.get("code_challenge"));return {state:target.searchParams.get("state"),browser:jar.get("bq_oauth")}}
for(const provider of ["google","github"]){
 const {state,browser}=await oauth(provider);
 assert.equal((await request(`oauth/${provider}/callback?state=wrong&code=test`)).response.headers.get("Location"),"/?auth=failed");jar.set("bq_oauth",browser);
 assert.equal((await request(`oauth/${provider}/callback?state=${state}&code=test`)).response.headers.get("Location"),"/?auth=success");assert.ok(seenVerifier);assert.equal((await request("session")).response.status,200);
 jar.set("bq_oauth",browser);assert.equal((await request(`oauth/${provider}/callback?state=${state}&code=test`)).response.headers.get("Location"),"/?auth=failed","OAuth replay rejected");
 await request("logout",{});const second=await oauth(provider);await request(`oauth/${provider}/callback?state=${second.state}&code=test`);assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM players WHERE oauth_provider=?").get(provider).count,1);
}
const oauthUser=sqlite.prepare("SELECT * FROM players WHERE oauth_provider='google'").get();sqlite.prepare("UPDATE players SET mfa_enabled=1,mfa_secret=?,mfa_backup_codes=? WHERE username=?").run(await auth.seal(setup.secret),JSON.stringify([await auth.hash("ABCDEFGH")]),oauthUser.username);
const {state}=await oauth("google");assert.equal((await request(`oauth/google/callback?state=${state}&code=test`)).response.headers.get("Location"),"/?auth=mfa");assert.equal((await request("session")).response.status,401);assert.equal((await request("mfa-login",{code:"ABCDEFGH"})).response.status,200);
// Local preview prints 127.0.0.1, while Google registers localhost callbacks.
const previousOrigin=env.AUTH_ORIGIN;env.AUTH_ORIGIN="http://localhost:5173";
const aliasConfig=await auth.authHandler(new Request("http://127.0.0.1:5173/api/auth-config"));
assert.equal((await aliasConfig.json()).google,true);
const beforeStates=sqlite.prepare("SELECT COUNT(*) AS n FROM oauth_states").get().n;
const canonical=await auth.authHandler(new Request("http://127.0.0.1:5173/api/oauth/google"));
assert.equal(canonical.status,303);assert.equal(canonical.headers.get("Location"),"http://localhost:5173/api/oauth/google");
assert.equal(canonical.headers.get("Set-Cookie"),null,"Do not bind state to the alias host");
assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM oauth_states").get().n,beforeStates);
for(const origin of ["http://localhost:9999","http://evil.test:5173","http://localhost.evil.test:5173"]){
 const result=await auth.authHandler(new Request(origin+"/api/auth-config"));assert.equal((await result.json()).google,false);
}
env.AUTH_ORIGIN=previousOrigin;
console.log("PASS: RFC TOTP vector, local login, MFA enrollment, encrypted secrets, hashed recovery codes, replay protection, attempt limits, challenge expiry, recovery regeneration, disable, CSRF, Google/GitHub OAuth PKCE and state, repeat sign-in, OAuth MFA enforcement.");sqlite.close();
