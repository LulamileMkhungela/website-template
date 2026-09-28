import puppeteer from '/home/user/new/tools/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import chromium from '/home/user/new/tools/node_modules/@sparticuz/chromium/build/index.js';
const BASE='http://127.0.0.1:8000';
const route=process.argv[2]||'/';
const w=parseInt(process.argv[3]||'390',10);
const browser=await puppeteer.launch({executablePath: await chromium.executablePath(), headless:true, args:[...chromium.args,'--no-sandbox','--disable-setuid-sandbox'], defaultViewport:null});
const page=await browser.newPage();
await page.setViewport({width:w,height:844,isMobile:w<768,hasTouch:w<768});
page.on('pageerror', e=>console.log('PAGEERROR:', e.message, '\n  stack:', (e.stack||'').split('\n').slice(0,4).join('\n  ')));
page.on('response', async r=>{
  const u=r.url(); const ct=r.headers()['content-type']||'';
  if(u.startsWith(BASE) && (r.status()>=400 || (/\.(js|json|css|webp|png|jpe?g|svg|woff2?)$/.test(u.split('?')[0]) && !/javascript|css|image|font|json/.test(ct)))) {
    console.log('RESP', r.status(), ct, u.replace(BASE,''));
  }
});
await page.goto(BASE+route,{waitUntil:'networkidle2',timeout:30000});
await new Promise(r=>setTimeout(r,1200));
const info=await page.evaluate(()=>{
  const de=document.documentElement;
  const vw=window.innerWidth;
  const over=[];
  document.querySelectorAll('body *').forEach(el=>{
    const r=el.getBoundingClientRect();
    if(r.width===0||r.height===0) return;
    let off=false; for(let p=el;p&&p!==document.body;p=p.parentElement){const cs=getComputedStyle(p); if(cs.position==='fixed'||(cs.transform&&cs.transform!=='none')||cs.overflowX==='hidden'||cs.overflowX==='clip'){off=true;break;}}
    if(off) return;
    if(r.right>vw+1.5) over.push({sel:el.tagName.toLowerCase()+'.'+String(el.className||'').split(/\s+/).slice(0,3).join('.'), right:Math.round(r.right), w:Math.round(r.width), scrollW:el.scrollWidth, txt:(el.textContent||'').trim().slice(0,40)});
  });
  return {vw, docScrollW:de.scrollWidth, bodyScrollW:document.body.scrollWidth, over:over.slice(0,12), textLen:document.body.innerText.trim().length};
});
console.log(JSON.stringify(info,null,1));
await browser.close();
