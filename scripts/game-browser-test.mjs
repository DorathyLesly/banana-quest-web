import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
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
 await page.getByRole('button',{name:'Start now',exact:true}).click();
 await page.getByRole('button',{name:'Create an account',exact:true}).click();
 await page.getByLabel('Username',{exact:true}).fill(name);
 await page.getByLabel('Password',{exact:true}).fill('Jungle123!');
 await page.getByLabel('Confirm password',{exact:true}).fill('Different123!');
 await page.getByRole('button',{name:'Create my account',exact:false}).click();
 await page.getByRole('alert').filter({hasText:'don’t match'}).waitFor();
 await page.getByLabel('Confirm password',{exact:true}).fill('Jungle123!');
 await page.getByRole('button',{name:'Create my account',exact:false}).click();
 await page.getByRole('status').filter({hasText:'Account planted'}).waitFor({timeout:30000});
 await page.getByLabel('Username',{exact:true}).fill(name);
 await page.getByLabel('Password',{exact:true}).fill('Wrong123!');
 await page.getByRole('button',{name:'Log in & let’s play'}).click();
 await page.getByRole('alert').filter({hasText:'incorrect'}).waitFor();
 await page.getByLabel('Password',{exact:true}).fill('Jungle123!');
 await page.getByRole('button',{name:'Log in & let’s play'}).click();
 await page.getByRole('button',{name:'Let’s play',exact:true}).waitFor({timeout:30000});
 await page.screenshot({path:'outputs/menu-desktop.png'});
 await page.getByRole('button',{name:'Let’s play',exact:true}).click();
 await page.getByRole('button',{name:'Answer 0',exact:true}).waitFor({timeout:30000});
 await page.locator('.puzzle-board>img').evaluate(img=>img.decode());
 await page.screenshot({path:'outputs/game-desktop.png'});
 let game=(await (await context.request.get('http://localhost:5173/api/session')).json()).game;
 for(let count=0;count<3;count++){
  for(let digit=0;digit<10;digit++){
   const response=await context.request.post('http://localhost:5173/api/answer',{data:{answer:digit}});
   const data=await response.json();check(response.ok(),JSON.stringify(data));game=data.game;
   if(game.completed>count||game.status!=='playing')break;
  }
 }
 check(game.status==='stagecomplete','First stage did not complete');
 const next=await (await context.request.post('http://localhost:5173/api/continue',{data:{}})).json();
 check(next.game.level===1&&next.game.status==='playing','Stage progression failed');
 await page.reload();await page.getByRole('button',{name:'Start now',exact:true}).click();
 await page.getByRole('button',{name:'Resume adventure'}).click();
 await page.getByRole('button',{name:'Answer 0',exact:true}).waitFor();
 await page.setViewportSize({width:390,height:844});
 check(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'Mobile horizontal overflow');
 await page.screenshot({path:'outputs/game-mobile.png',fullPage:true});
 await page.getByRole('button',{name:'Back to grove',exact:true}).click();
 await page.getByRole('button',{name:'Log out',exact:true}).click();
 await page.getByRole('button',{name:'Log in & let’s play'}).waitFor();
 await page.screenshot({path:'outputs/login-mobile.png',fullPage:true});
 const denied=await context.request.post('http://localhost:5173/api/start',{data:{}});
 check(denied.status()===401,'Unauthenticated game access was accepted');
 check(errors.length===0,'Browser errors: '+errors.join('; '));
 console.log('PASS: video intro, password confirmation, registration, wrong-password rejection, login, gameplay, first-stage completion, stage progression, persisted session/resume, mobile layout, logout and unauthenticated access rejection.');
}finally{await browser.close()}