// Visual capture: a few key pages at phone / tablet / desktop widths.
import puppeteer from '/home/user/new/tools/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import chromium from '/home/user/new/tools/node_modules/@sparticuz/chromium/build/index.js';
import fs from 'fs';
const BASE='http://127.0.0.1:8000';
const OUT='/tmp/shots'; fs.mkdirSync(OUT,{recursive:true});
const targets=[['home','/'],['about','/about'],['frontend','/frontend-development'],['engage','/project/employee-engagement-app-redesign']];
const vps=[['phone',390,844],['tablet',768,1024],['desktop',1440,900]];
const browser=await puppeteer.launch({executablePath: await chromium.executablePath(), headless:true, args:[...chromium.args,'--no-sandbox'], defaultViewport:null});
for (const [vname,w,h] of vps) {
  for (const [tname,route] of targets) {
    const page=await browser.newPage();
    await page.setViewport({width:w,height:h});
    await page.goto(BASE+route,{waitUntil:'networkidle2'});
    await new Promise(r=>setTimeout(r,1200));
    const f=`${OUT}/${tname}-${vname}.png`;
    await page.screenshot({path:f, fullPage: vname!=='phone' ? false : false});
    console.log('shot', f);
    if (tname==='home' && vname==='phone') {
      // also capture the footer area to check stacking
      await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));
      await new Promise(r=>setTimeout(r,800));
      await page.screenshot({path:`${OUT}/home-phone-footer.png`});
      console.log('shot', `${OUT}/home-phone-footer.png`);
    }
    await page.close();
  }
}
await browser.close();
