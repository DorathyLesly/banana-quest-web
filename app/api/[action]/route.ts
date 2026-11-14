// Server migration assisted by OpenAI Codex; see MIGRATION.md.
import { LEVELS } from "@/lib/game";
import { env } from "cloudflare:workers";
export const dynamic = "force-dynamic";
const json=(value:unknown,status=200,headers:Record<string,string>={})=>Response.json(value,{status,headers:{"Cache-Control":"no-store",...headers}});
const hex=(b:ArrayBuffer|Uint8Array)=>Array.from(new Uint8Array(b instanceof Uint8Array?b.buffer:b),x=>x.toString(16).padStart(2,"0")).join("");
const random=()=>hex(crypto.getRandomValues(new Uint8Array(32)));
async function hash(value:string){return hex(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value)))}
async function password(value:string,salt:string){const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(value),"PBKDF2",false,["deriveBits"]);return hex(await crypto.subtle.deriveBits({name:"PBKDF2",salt:new TextEncoder().encode(salt),iterations:100000,hash:"SHA-256"},key,256))}
function equal(a:string,b:string){let diff=a.length^b.length;for(let i=0;i<Math.max(a.length,b.length);i++)diff|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return diff===0}
async function puzzle(){
 const configuredTimeout=Number(env.BANANA_API_TIMEOUT_MS||6500);
 const timeout=Number.isFinite(configuredTimeout)&&configuredTimeout>=100&&configuredTimeout<=30000?Math.floor(configuredTimeout):6500;
 try {
  const response=await fetch(env.BANANA_API_URL||"https://marcconrad.com/uob/banana/api.php?out=json",{signal:AbortSignal.timeout(timeout),headers:{Accept:"application/json"}});
  if(!response.ok)throw Error("API unavailable");
  const data=await response.json() as any; const solution=Number(data.solution); const url=new URL(data.question);
  if(!Number.isInteger(solution)||solution<0||solution>9||!["www.sanfoh.com","sanfoh.com","marcconrad.com"].includes(url.hostname)||!url.pathname.includes("/banana/"))throw Error("Invalid puzzle");
  url.protocol="https:";
  const imageResponse=await fetch(url.href,{signal:AbortSignal.timeout(timeout)});
  if(!imageResponse.ok)throw Error("Puzzle image unavailable");
  const type=imageResponse.headers.get("content-type")?.split(";")[0]||"image/png";
  if(!["image/png","image/jpeg","image/webp","image/gif"].includes(type))throw Error("Unsupported puzzle image");
  const bytes=new Uint8Array(await imageResponse.arrayBuffer());
  if(bytes.length>2000000)throw Error("Puzzle image too large");
  let binary="";for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
  return {image:`data:${type};base64,${btoa(binary)}`,solution,source:"Banana API"};
 } catch {
  const solution=crypto.getRandomValues(new Uint8Array(1))[0]%10; const a=2+crypto.getRandomValues(new Uint8Array(1))[0]%9;
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="360"><rect width="800" height="360" rx="24" fill="#fffdf2"/><text x="400" y="85" text-anchor="middle" font-family="sans-serif" font-size="22" fill="#53704a">BANANA BRAIN TEASER</text><text x="400" y="205" text-anchor="middle" font-family="sans-serif" font-size="64" fill="#20412d">${a} + 🍌 = ${a+solution}</text><text x="400" y="295" text-anchor="middle" font-family="sans-serif" font-size="22" fill="#53704a">Which digit is hiding behind the banana?</text></svg>`;
  return {image:"data:image/svg+xml;charset=utf-8,"+encodeURIComponent(svg),solution,source:"Offline puzzle"};
 }
}
function publicGame(game:any){if(!game)return null; const {solution,...current}=game.puzzle||{};return {...game,puzzle:game.puzzle?current:null,serverNow:Date.now(),config:LEVELS[game.level]}}
async function handler(request:Request){
 const db=env.DB!; if(!db)return json({error:"Account storage is unavailable. Please try again later."},503);
 const action=new URL(request.url).pathname.split("/").pop();
 if(request.method==="POST"&&request.headers.get("origin")&&request.headers.get("origin")!==new URL(request.url).origin)return json({error:"Invalid request origin."},403);
 if(request.method!=="POST"&&!["session","leaderboard"].includes(action||""))return json({error:"Use POST for this action."},405);
 const body=request.method==="POST"?await request.json().catch(()=>({})) as any:{};
 const cookie=request.headers.get("cookie")?.match(/(?:^|;\s*)bq_session=([a-f0-9]{64})(?:;|$)/)?.[1];
 const token=cookie?await hash(cookie):"";
 const session:any=token?await db.prepare("SELECT * FROM sessions WHERE token=? AND expires>?").bind(token,Date.now()).first():null;
 if(action==="register"||action==="login"){
  const display=String(body.username||"").trim(), username=display.toLowerCase(), pass=String(body.password||"");
  if(!/^[a-z0-9_]{3,20}$/.test(username)||pass.length>128)return json({error:"Use a username of 3–20 letters, numbers or underscores."},400);
  const user:any=await db.prepare("SELECT * FROM players WHERE username=?").bind(username).first();
  if(action==="register"){
   if(pass.length<6||!/[a-z]/i.test(pass)||!/[0-9]/.test(pass))return json({error:"Password needs at least 6 characters, a letter and a number."},400);
   if(user)return json({error:"That username is already taken."},409);
   const salt=random(); const digest=await password(pass,salt);
   try{await db.prepare("INSERT INTO players(username,display_name,salt,password_hash) VALUES(?,?,?,?)").bind(username,display,salt,digest).run()}catch{return json({error:"That username is already taken."},409)}
   return json({ok:true});
  }
  if(user?.locked_until>Date.now())return json({error:"Too many attempts. Please wait 30 seconds."},429);
  const valid=equal(await password(pass,user?.salt||"unknown-player"),user?.password_hash||"");
  if(!user||!valid){if(user)await db.prepare("UPDATE players SET failures=?,locked_until=? WHERE username=?").bind((user.failures+1)%5,user.failures>=4?Date.now()+30000:0,username).run();return json({error:"Username or password is incorrect."},401)}
  await db.prepare("UPDATE players SET failures=0,locked_until=0 WHERE username=?").bind(username).run();
  const raw=random(); await db.prepare("INSERT INTO sessions(token,username,expires) VALUES(?,?,?)").bind(await hash(raw),username,Date.now()+7*86400000).run();
  return json({user:{name:user.display_name,best:user.best,games:user.games,coins:user.coins}},200,{"Set-Cookie":`bq_session=${raw}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${new URL(request.url).protocol==="https:"?"; Secure":""}`});
 }
 if(!session)return json({error:"Please log in to play."},401);
 const user:any=await db.prepare("SELECT display_name,best,games,coins FROM players WHERE username=?").bind(session.username).first();
 if(action==="session")return json({user:{name:user.display_name,best:user.best,games:user.games,coins:user.coins},game:publicGame(session.game?JSON.parse(session.game):null)});
 if(action==="logout"){await db.prepare("DELETE FROM sessions WHERE token=?").bind(token).run();return json({ok:true},200,{"Set-Cookie":"bq_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0"})}
 if(action==="leaderboard"){
  const byCoins=new URL(request.url).searchParams.get("sort")==="coins";
  const first=byCoins?"coins":"best",second=byCoins?"best":"coins";
  const result=await db.prepare(`SELECT username,display_name AS name,best,games,coins FROM players WHERE best>0 OR coins>0 ORDER BY ${first} DESC,${second} DESC,username ASC LIMIT 10`).all();
  const rows=result.results.map((row:any)=>({name:row.name,best:row.best,games:row.games,coins:row.coins,isYou:row.username===session.username}));
  const mine:any=await db.prepare(`SELECT COUNT(*)+1 AS rank FROM players WHERE (best>0 OR coins>0) AND (${first}>? OR (${first}=? AND ${second}>?) OR (${first}=? AND ${second}=? AND username<?))`).bind(user[first],user[first],user[second],user[first],user[second],session.username).first();
  return json({players:rows,current:{name:user.display_name,best:user.best,games:user.games,coins:user.coins,rank:mine.rank,isYou:true}});
 }
 let game:any=session.game?JSON.parse(session.game):null;
 let reward=0;
 if(action==="start"){game={level:0,completed:0,score:0,coinsEarned:0,streak:0,strikes:0,status:"playing",puzzle:await puzzle()};game.deadline=Date.now()+LEVELS[0].time*1000}
 else if(action==="continue"&&game?.status==="stagecomplete"){game.level++;game.completed=0;game.strikes=0;game.status="playing";game.puzzle=await puzzle();game.deadline=Date.now()+LEVELS[game.level].time*1000}
 else if(action==="answer"&&game?.status==="playing"){
  const now=Date.now(),remaining=Math.max(0,Math.ceil((game.deadline-now)/1000));
  const timedOut=now>=game.deadline; const correct=!timedOut&&Number.isInteger(body.answer)&&body.answer===game.puzzle.solution;
  if(!timedOut&&(!Number.isInteger(body.answer)||body.answer<0||body.answer>9))return json({error:"Choose a digit from 0 to 9."},400);
  if(timedOut){game.status="gameover";game.feedback="Time up."}
  else if(correct){
   game.streak++; const config=LEVELS[game.level];
   game.score+=Math.round((100*config.multiplier+remaining*5)*(game.level>0?1+.1*game.streak:1));
   game.completed++; reward=10; game.feedback="Correct!";
   if(game.completed>=config.count){game.status=game.level===2?"victory":"stagecomplete";reward+=25*(game.level+1)+(game.level===2?100:0);game.puzzle=null}
   else {game.puzzle=await puzzle();game.deadline=Date.now()+config.time*1000}
  } else {game.streak=0;game.feedback="Try again.";if(game.level===2){game.strikes++;game.score=Math.max(0,game.score-25);if(game.strikes>=3){game.status="gameover";game.feedback="Three strikes."}}}
 } else return json({error:"This round has changed. Refresh the game."},409);
 game.coinsEarned=(Number(game.coinsEarned)||0)+reward;
 const serialized=JSON.stringify(game);
 const finished=["victory","gameover"].includes(game.status)?1:0;
 // D1 batch is transactional. A unique event and the optimistic session revision
 // prevent retries or concurrent answers from granting the same coins twice.
 const results=await db.batch([
  db.prepare("UPDATE sessions SET game=?,revision=revision+1 WHERE token=? AND revision=?").bind(serialized,token,session.revision),
  db.prepare("INSERT INTO game_events(id,username,coins) SELECT ?,?,? WHERE EXISTS (SELECT 1 FROM sessions WHERE token=? AND revision=? AND game=?) ON CONFLICT(id) DO NOTHING").bind(token+":"+session.revision,session.username,reward,token,session.revision+1,serialized),
  db.prepare("UPDATE players SET coins=coins+?,best=MAX(best,?),games=games+? WHERE username=? AND changes()=1").bind(reward,game.score,finished,session.username)
 ]);
 if(!results[0].meta.changes)return json({error:"This round has changed. Please reload."},409);
 const updated:any=await db.prepare("SELECT display_name,best,games,coins FROM players WHERE username=?").bind(session.username).first();
 return json({game:publicGame(game),reward,user:{name:updated.display_name,best:updated.best,games:updated.games,coins:updated.coins}});

}
export async function GET(request:Request){try{return await handler(request)}catch(e){console.error(e);return json({error:"Something went wrong. Please try again."},500)}}
export async function POST(request:Request){try{return await handler(request)}catch(e){console.error(e);return json({error:"Something went wrong. Please try again."},500)}}
