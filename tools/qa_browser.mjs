// Real-browser QA: viewport sweep (desktop / tablet / phone) with overflow + console-error checks.
import puppeteer from '/home/user/new/tools/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import chromium from '/home/user/new/tools/node_modules/@sparticuz/chromium/build/index.js';
import fs from 'fs';

const BASE = process.env.QA_BASE || 'http://127.0.0.1:8000';
const ROUTES = process.argv.slice(2).length ? process.argv.slice(2)
  : ['/', '/about', '/contact', '/services', '/frontend-development', '/website-design-conversion',
     '/product-design-strategy', '/brand-strategy-and-growth', '/microfinance-impact-consulting',
     '/project/employee-engagement-app-redesign', '/project/foodiezone-pwa', '/project/africa-cuisine-pwa',
     '/project/brand-strategy-programme', '/project/lexark-legal-search', '/project/snb-website',
     '/project/nerdma-website', '/project/addmoredigital-website', '/project/designops-design-system',
     '/project/lula-trustshield',
     '/project/kinto-one', '/project/toyota-remote', '/project/toyota-app',
     '/project/wandisplace-pwa', '/project/sk-finds-pwa',
     '/graphic/kinto-one', '/graphic/toyota-remote'];
const VIEWPORTS = [ {name:'desktop', w:1440, h:900}, {name:'laptop', w:1280, h:800},
                    {name:'tablet', w:768, h:1024}, {name:'phone', w:390, h:844} ];

const exe = await chromium.executablePath();
const browser = await puppeteer.launch({
  executablePath: exe, headless: true,
  args: [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none'],
  defaultViewport: null,
});
const report = [];
for (const vp of VIEWPORTS) {
  for (const route of ROUTES) {
    const page = await browser.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 160)); });
    page.on('requestfailed', r => errs.push('reqfail: ' + r.url().replace(BASE, '') + ' ' + (r.failure() && r.failure().errorText)));
    // plain desktop rendering at a narrow width: media queries are width based, and this
    // keeps window.innerWidth exact so real overflow is measurable
    await page.setViewport({ width: vp.w, height: vp.h, deviceScaleFactor: 1 });
    try {
      await page.goto(BASE + route, { waitUntil: 'networkidle2', timeout: 25000 });
    } catch (e) { errs.push('goto: ' + e.message.slice(0, 120)); }
    await new Promise(r => setTimeout(r, 900));
    const m = await page.evaluate(() => {
      const de = document.documentElement, body = document.body;
      const vw = window.innerWidth;
      const offenders = [];
      const inOverlay = (el) => {
        // off-canvas menus / modals live in a fixed or transformed ancestor and are
        // positioned off-screen on purpose - they are not layout overflow.
        for (let p = el; p && p !== document.body; p = p.parentElement) {
          const cs = getComputedStyle(p);
          if (cs.position === 'fixed') return true;
          if (cs.transform && cs.transform !== 'none') return true;
          if (cs.overflowX === 'hidden' || cs.overflowX === 'clip') return true;
        }
        return false;
      };
      document.querySelectorAll('body *').forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return;
        if (r.right > vw + 1.5 || r.left < -1.5) {
          if (inOverlay(el)) return;
          offenders.push({ sel: el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''), left: Math.round(r.left), right: Math.round(r.right) });
        }
      });
      const uniq = []; const seen = new Set();
      for (const o of offenders) { if (seen.has(o.sel)) continue; seen.add(o.sel); uniq.push(o); }
      const toggle = document.querySelector('button[aria-label*="menu" i], button[aria-label*="Menu" i], button[class*="menu" i]');
      const tRect = toggle ? toggle.getBoundingClientRect() : null;
      return {
        docScrollW: de.scrollWidth, bodyScrollW: body.scrollWidth, vw,
        horizontalOverflow: Math.max(de.scrollWidth, body.scrollWidth) > vw + 1.5,
        offenderCount: uniq.length, offenders: uniq.slice(0, 6),
        mobileToggleVisible: !!(tRect && tRect.width > 0 && tRect.height > 0),
        textLen: (document.body.innerText || '').trim().length,
        h1: (document.querySelector('h1') || {}).textContent?.trim().slice(0, 60) || '',
        imgs: [...document.images].length,
        brokenImgs: [...document.images].filter(i => i.complete && i.naturalWidth === 0).map(i => i.getAttribute('src')).slice(0, 5),
      };
    }).catch(e => ({ err: e.message }));
    // anything that failed to load from our own server is a real defect; external CDNs
    // (fonts) are reported separately because this sandbox has no internet egress.
    const ownErrors = errs.filter(e => !/fonts\.googleapis|fontshare|googletagmanager|ERR_CONNECTION_CLOSED|Failed to load resource: net::ERR/.test(e));
    report.push({ vp: vp.name, w: vp.w, route, ...m, errors: [...new Set(ownErrors)].slice(0, 4), extBlocked: errs.length - ownErrors.length });
    await page.close();
  }
}
await browser.close();
fs.writeFileSync('/tmp/qa_report.json', JSON.stringify(report, null, 1));
const bad = report.filter(r => r.horizontalOverflow || (r.errors && r.errors.length) || (r.brokenImgs && r.brokenImgs.length) || r.textLen < 200);
console.log('checked', report.length, 'route/viewport combos; problem combos:', bad.length);
for (const r of bad) {
  console.log(`--- ${r.vp}(${r.w}) ${r.route}: overflow=${r.horizontalOverflow} scrollW=${r.docScrollW} textLen=${r.textLen} offenders=${r.offenderCount}`);
  if (r.errors?.length) console.log('    errors:', r.errors.join(' | '));
  if (r.brokenImgs?.length) console.log('    brokenImgs:', r.brokenImgs.join(' '));
  if (r.offenders?.length) console.log('    offenders:', r.offenders.map(o => `${o.sel}[${o.left}..${o.right}]`).join(' '));
}
