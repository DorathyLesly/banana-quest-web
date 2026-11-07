import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:960}});
const page=await context.newPage();
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const check=(ok,message)=>{if(!ok)throw Error(message)};
await mkdir('outputs',{recursive:true});
const name='webtest_'+Date.now().toString().slice(-10);
try{
 await page.goto('http://localhost:5173',{waitUntil:'networkidle'});
 await page.getByRole('button',{name:'Start now',exact:true}).waitFor();
 check(await page.locator('video').evaluate(v=>v.currentSrc.endsWith('/intro.mp4')),'Intro video missing');
 await page.screenshot({path:'outputs/intro-desktop.png'});
 check(!await page.getByText('Crack the puzzles. Collect the points.',{exact:false}).count(),'Removed intro slogan is still visible');
 check(!await page.locator('.intro-footer').count(),'Intro footer should be removed');
 await page.getByRole('button',{name:'Start now',exact:true}).click();
 await page.locator('.auth-card').waitFor();
 await page.waitForTimeout(650);
 await page.screenshot({path:'outputs/login-desktop.png'});
 await page.getByRole('button',{name:'Register',exact:true}).click();
 await page.getByLabel('Username',{exact:true}).fill(name);
 await page.getByLabel('Password',{exact:true}).fill('Jungle123!');
 await page.getByLabel('Confirm password',{exact:true}).fill('Different123!');
 await page.getByRole('button',{name:'Create account',exact:false}).click();
 await page.getByRole('alert').filter({hasText:'don’t match'}).waitFor();
 await page.getByLabel('Confirm password',{exact:true}).fill('Jungle123!');
 await page.getByRole('button',{name:'Create account',exact:false}).click();
 await page.getByRole('status').filter({hasText:'Account created'}).waitFor({timeout:30000});
 await page.getByLabel('Username',{exact:true}).fill(name);
 await page.getByLabel('Password',{exact:true}).fill('Wrong123!');
 await page.getByRole('button',{name:'Log in'}).click();
 await page.getByRole('alert').filter({hasText:'incorrect'}).waitFor();
 await page.getByLabel('Password',{exact:true}).fill('Jungle123!');
 await page.getByRole('button',{name:'Log in'}).click();
 await page.getByRole('button',{name:'Play',exact:true}).waitFor({timeout:30000});
 await page.waitForTimeout(750);
 await page.screenshot({path:'outputs/menu-desktop.png'});
 check(await page.locator('.stage-card.locked').count()===2,'Stage map locked states missing');
 check(!/[A-Za-z]/.test(await page.locator('.monkey-map').innerText()),'Monkey stage map should have no visible word labels');
 check((await page.locator('.monkey-stage-number').allTextContents()).join('')==='123','Stage number badges are missing');
 check(await page.getByRole('button',{name:/^Stage 2:/}).isDisabled(),'Locked monkey stage accepted input');
 check(await page.locator('.world-atmosphere .firefly').count()===14,'Animated jungle atmosphere missing');
 await page.setViewportSize({width:390,height:844});
 check(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'Mobile menu horizontal overflow');
 await page.screenshot({path:'outputs/menu-mobile.png',fullPage:true});
 await page.setViewportSize({width:1440,height:960});
 await page.getByRole('button',{name:/^Stage 1:/}).click();
 await page.getByRole('button',{name:'Answer 0',exact:true}).waitFor({timeout:30000});
 await page.locator('.wallet').waitFor();
 await page.locator('.puzzle-board>img').evaluate(img=>img.decode());
 await page.screenshot({path:'outputs/game-desktop.png'});
 await page.getByRole('button',{name:'Enable game sounds',exact:true}).click();
 const answerResponse=page.waitForResponse(r=>r.url().endsWith('/api/answer')&&r.request().method()==='POST');
 await page.getByRole('button',{name:'Answer 0',exact:true}).click();
 let game=(await (await answerResponse).json()).game;
 await page.locator('.answer-effect').waitFor();
 check(await page.getByRole('button',{name:'Mute game sounds',exact:true}).count()===1,'Sound toggle did not activate');
 for(let count=game.completed;count<3;count++){
  for(let digit=0;digit<10;digit++){
   const pendingAnswer=page.waitForResponse(r=>r.url().endsWith('/api/answer')&&r.request().method()==='POST');
   await page.getByRole('button',{name:`Answer ${digit}`,exact:true}).click();
   const response=await pendingAnswer;
   const data=await response.json();check(response.ok(),JSON.stringify(data));game=data.game;
   if(game.completed>count||game.status!=='playing')break;
  }
 }
 check(game.status==='stagecomplete','First stage did not complete');
 const coins=(await (await context.request.get('http://localhost:5173/api/session')).json()).user.coins;
 check(coins===55,'Expected 30 answer coins plus 25 stage bonus, got '+coins);
 check(game.coinsEarned===55,'Run coin total is wrong');
 await page.locator('.wallet').filter({hasText:'55'}).waitFor();
 await page.locator('.leaderboard-shortcut').click();
 await page.getByRole('dialog').getByText(name,{exact:false}).waitFor();
 await page.getByRole('tab',{name:'Coins',exact:true}).click();
 await page.getByRole('tab',{name:'Coins',exact:true}).filter({has:page.locator('svg')}).waitFor();
 await page.waitForTimeout(300);
 await page.screenshot({path:'outputs/leaderboard-desktop.png'});
 await page.getByRole('button',{name:'Close',exact:true}).click();
 await page.locator('.game-heading').getByRole('button',{name:'Menu',exact:true}).click();
 check(await page.getByRole('button',{name:/^Stage 2:/}).isEnabled(),'Clearing a stage did not unlock its monkey button');
 const nextResponse=page.waitForResponse(r=>r.url().endsWith('/api/continue')&&r.request().method()==='POST');
 await page.getByRole('button',{name:/^Stage 2:/}).click();
 const next=await(await nextResponse).json();
 check(next.game.level===1&&next.game.status==='playing','Stage progression failed');
 await page.reload();await page.getByRole('button',{name:'Start now',exact:true}).click();
 await page.getByRole('button',{name:'Resume'}).click();
 await page.getByRole('button',{name:'Answer 0',exact:true}).waitFor();
 await page.setViewportSize({width:390,height:844});
 check(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'Mobile horizontal overflow');
 await page.screenshot({path:'outputs/game-mobile.png',fullPage:true});
 await page.locator('.leaderboard-shortcut').click();
 await page.getByRole('dialog').getByText(name,{exact:false}).waitFor();
 check(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'Mobile leaderboard horizontal overflow');
 await page.screenshot({path:'outputs/leaderboard-mobile.png',fullPage:true});
 await page.getByRole('button',{name:'Close',exact:true}).click();
 await page.locator('.game-heading').getByRole('button',{name:'Menu',exact:true}).click();
 await page.getByRole('button',{name:'Log out',exact:true}).click();
 await page.getByRole('button',{name:'Log in'}).waitFor();
 await page.screenshot({path:'outputs/login-mobile.png',fullPage:true});
 const denied=await context.request.post('http://localhost:5173/api/start',{data:{}});
 check(denied.status()===401,'Unauthenticated game access was accepted');
 await page.getByLabel('Username',{exact:true}).fill(name);
 await page.getByLabel('Password',{exact:true}).fill('Jungle123!');
 await page.getByRole('button',{name:'Log in',exact:true}).click();
 await page.getByRole('button',{name:'Play',exact:true}).waitFor();
 await page.locator('.wallet').filter({hasText:'55'}).waitFor();
 check(errors.length===0,'Browser errors: '+errors.join('; '));
 console.log('PASS: video intro, password confirmation, registration, wrong-password rejection, login, gameplay, first-stage completion, stage progression, persisted session/resume, mobile menu/game layouts, text-free monkey stage buttons, stage unlock/navigation, sound toggle, answer animations, coin rewards, score/coin leaderboard, wallet persistence, logout and unauthenticated access rejection.');
 }finally{
 await browser.close();
 const cleanup=String.raw`import sqlite3,sys,re
from pathlib import Path
username=sys.argv[1]
assert re.fullmatch(r'webtest_[0-9]{10}',username)
for path in Path('.wrangler/state/v3/d1/miniflare-D1DatabaseObject').glob('*.sqlite'):
 db=sqlite3.connect(path,timeout=15)
 if db.execute("SELECT name FROM sqlite_master WHERE name='players'").fetchone():
  if db.execute("SELECT name FROM sqlite_master WHERE name='game_events'").fetchone():
   db.execute('DELETE FROM game_events WHERE username=?',(username,))
  db.execute('DELETE FROM sessions WHERE username=?',(username,))
  db.execute('DELETE FROM players WHERE username=?',(username,))
  db.commit()
 db.close()`;
 const result=spawnSync('python',['-c',cleanup,name],{encoding:'utf8'});
 if(result.status!==0)throw Error('Local test account cleanup failed: '+result.stderr);
}