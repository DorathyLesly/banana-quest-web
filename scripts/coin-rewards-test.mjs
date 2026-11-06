import { request } from '@playwright/test';
import { spawnSync } from 'node:child_process';
const name='coincheck_'+Date.now().toString().slice(-9);
const base='http://localhost:5173';
const context=await request.newContext({baseURL:base});
const check=(ok,message)=>{if(!ok)throw Error(message)};
// Only this uniquely named local test player is edited; no real accounts are touched.
function fixture(operation,game){
 const python=String.raw`import json,sqlite3,sys
from pathlib import Path
payload=json.load(sys.stdin)
username=payload['username']
assert username.startswith('coincheck_') and username[10:].isdigit()
for path in Path('.wrangler/state/v3/d1/miniflare-D1DatabaseObject').glob('*.sqlite'):
 db=sqlite3.connect(path,timeout=15)
 if not db.execute("SELECT name FROM sqlite_master WHERE name='players'").fetchone():
  db.close();continue
 if not db.execute('SELECT 1 FROM players WHERE username=?',(username,)).fetchone():
  db.close();continue
 if payload['operation']=='set':
  db.execute('UPDATE sessions SET game=? WHERE username=?',(json.dumps(payload['game'],separators=(',',':')),username))
  db.commit();print('{}')
 elif payload['operation']=='audit':
  amount,count=db.execute('SELECT COALESCE(SUM(coins),0),COUNT(*) FROM game_events WHERE username=?',(username,)).fetchone()
  print(json.dumps({'coins':amount,'events':count}))
 else:
  db.execute('DELETE FROM game_events WHERE username=?',(username,))
  db.execute('DELETE FROM sessions WHERE username=?',(username,))
  db.execute('DELETE FROM players WHERE username=?',(username,))
  db.commit();print('{}')
 db.close();break
else:
 raise RuntimeError('Local test account database not found')`;
 const result=spawnSync('python',['-c',python],{input:JSON.stringify({username:name,operation,game}),encoding:'utf8',cwd:process.cwd()});
 if(result.status!==0)throw Error(result.stderr||result.stdout);
 return JSON.parse(result.stdout);
}
function game(level=0,completed=0,extra={}){return{level,completed,score:200,coinsEarned:0,streak:0,strikes:0,status:'playing',deadline:Date.now()+20000,puzzle:{image:'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>',solution:7,source:'Test fixture'},...extra}}
async function answer(value){const response=await context.post('/api/answer',{data:{answer:value}});return{response,data:await response.json()}}
async function user(){return(await(await context.get('/api/session')).json()).user}
let registered=false;
try{
 check((await context.post('/api/register',{data:{username:name,password:'CoinTest123!'}})).ok(),'Registration failed');registered=true;
 check((await context.post('/api/login',{data:{username:name,password:'CoinTest123!'}})).ok(),'Login failed');
 check((await user()).coins===0,'New player should start with zero coins');
 fixture('set',game());let result=await answer(6);check(result.data.reward===0&&(await user()).coins===0,'Wrong answer awarded coins');
 fixture('set',game());result=await answer(7);check(result.data.reward===10&&(await user()).coins===10,'Correct answer should award exactly 10 coins');
 fixture('set',game(0,2,{coinsEarned:20}));result=await answer(7);check(result.data.reward===35&&result.data.game.coinsEarned===55&&(await user()).coins===45,'Stage 1 bonus is wrong');
 const replay=await answer(7);check(replay.response.status()===409&&(await user()).coins===45,'Replayed completion awarded duplicate coins');
 fixture('set',game(1,4,{coinsEarned:40}));result=await answer(7);check(result.data.reward===60&&(await user()).coins===105,'Stage 2 bonus is wrong');
 fixture('set',game(2,6,{coinsEarned:60}));
 const concurrent=await Promise.all([answer(7),answer(7)]);
 check(concurrent.filter(r=>r.response.ok()).length===1,'Concurrent completion accepted more than once');
 const success=concurrent.find(r=>r.response.ok()).data;
 check(success.reward===185&&success.game.coinsEarned===245,'Victory and stage 3 bonus are wrong');
 check((await user()).coins===290&&(await user()).games===1,'Concurrent completion duplicated wallet or game count');
 fixture('set',game(2,0,{strikes:2}));result=await answer(6);check(result.data.game.status==='gameover'&&result.data.reward===0&&(await user()).coins===290,'Three-strike loss changed wallet');
 fixture('set',game(0,0,{deadline:Date.now()-1000}));result=await answer(-1);check(result.data.reward===0&&(await user()).coins===290,'Timeout awarded coins');
 const audit=fixture('audit');check(audit.coins===290&&audit.events===7,'Reward ledger differs from the wallet');
 for(const sort of ['scores','coins']){
  const board=await(await context.get('/api/leaderboard?sort='+sort)).json();
  check(board.current.coins===290&&Number.isInteger(board.current.rank),'Own leaderboard rank or coins missing');
  const field=sort==='coins'?'coins':'best';check(board.players.every((p,i)=>i===0||board.players[i-1][field]>=p[field]),'Leaderboard sort is wrong');
 }
 await context.post('/api/logout',{data:{}});
 await context.post('/api/login',{data:{username:name,password:'CoinTest123!'}});
 check((await user()).coins===290,'Coin balance did not persist across login');
 console.log('PASS: exact answer/stage/victory rewards, zero rewards for wrong answers or timeouts, concurrent/replayed reward protection, ledger consistency, leaderboard sorting/rank and wallet persistence.');
}finally{await context.dispose();if(registered)fixture('cleanup')}