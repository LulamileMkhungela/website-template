// Verify the LulaMile portfolio changes in a real browser.
import puppeteer from './node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import chromium from './node_modules/@sparticuz/chromium/build/index.js';
import fs from 'fs';

const BASE = process.env.QA_BASE || 'http://127.0.0.1:8000';
const SHOTS = '/tmp/shots';
fs.mkdirSync(SHOTS, { recursive: true });

const exe = await chromium.executablePath();
const browser = await puppeteer.launch({
  executablePath: exe,
  headless: true,
  args: [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none'],
  defaultViewport: { width: 1440, height: 900 },
});

const results = [];
function check(name, ok, extra = '') {
  results.push({ name, ok, extra });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`);
}

async function load(page, path) {
  const errs = [];
  const reqfail = [];
  page.removeAllListeners('pageerror'); page.removeAllListeners('console'); page.removeAllListeners('requestfailed');
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 160)); });
  page.on('requestfailed', r => reqfail.push(r.url().replace(BASE, '') + ' ' + (r.failure() && r.failure().errorText)));
  try {
    await page.goto(BASE + path, { waitUntil: 'networkidle2', timeout: 30000 });
  } catch (e) { errs.push('goto: ' + e.message.slice(0, 120)); }
  await new Promise(r => setTimeout(r, 1400));
  return { errs, reqfail };
}

const page = await browser.newPage();

// ── 1. Product Design & Strategy page ──────────────────────────────────────
{
  const { errs, reqfail } = await load(page, '/product-design-strategy/');
  const d = await page.evaluate(() => ({
    text: document.body.innerText,
    cards: [...document.querySelectorAll('#pds-selected h3, section[id="pds-portfolio"] h3')].map(h => h.textContent.trim()),
    links: [...document.querySelectorAll('#pds-selected a')].map(a => a.getAttribute('href')),
  }));
  check('PD: no JS errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  check('PD: LulaGazette visible in Selected work', d.text.includes('LulaGazette'), 'cards: ' + d.cards.join(' / '));
  check('PD: TrustShield NOT on page', !/TrustShield|LulaUnifidMarket/.test(d.text));
  check('PD: no TrustShield card', !d.cards.some(t => /TrustShield/.test(t)));
  check('PD: no broken image requests', reqfail.filter(u => /projects/.test(u)).length === 0, reqfail.filter(u => /projects/.test(u)).slice(0, 3).join(' | '));
  await page.screenshot({ path: SHOTS + '/pd-full.png', fullPage: true });
}

// ── 2. Microfinance & Impact page ──────────────────────────────────────────
{
  const { errs } = await load(page, '/microfinance-impact-consulting/');
  const d = await page.evaluate(() => document.body.innerText);
  check('MFI: no JS errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  check('MFI: LulaGazette removed from page', !/LulaGazette|Lexark/.test(d));
  await page.screenshot({ path: SHOTS + '/mfi-full.png', fullPage: true });
}

// ── 3. Frontend Development page ───────────────────────────────────────────
{
  const { errs } = await load(page, '/frontend-development/');
  const d = await page.evaluate(() => document.body.innerText);
  check('FD: no JS errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  check('FD: TrustShield present (Selected builds)', /TrustShield/.test(d));
  await page.screenshot({ path: SHOTS + '/fd-full.png', fullPage: true });
}

// ── 4. Website Design & Conversion page: SNB redirect card + UX resource ──
{
  const { errs, reqfail } = await load(page, '/website-design-conversion/');
  const d = await page.evaluate(() => ({
    cards: [...document.querySelectorAll('section[id="wd-portfolio"] a')].map(a => ({
      title: (a.querySelector('h3') || {}).textContent || '',
      href: a.getAttribute('href'), target: a.getAttribute('target'),
    })),
  }));
  check('WD: no JS errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  const snb = d.cards.find(c => /SNB/.test(c.title));
  check('WD: SNB card redirects externally', !!snb && snb.href === 'https://www.snbconsultancy.co.za' && snb.target === '_blank',
    snb ? JSON.stringify(snb) : 'no SNB card');
  const ux = d.cards.find(c => /UX Resource/.test(c.title));
  check('WD: UX Resource card -> Notion URL', !!ux && (ux.href || '').includes('notion.site'),
    ux ? ux.href : 'no UX card');
  check('WD: nerdma + addmore cards still internal',
    d.cards.some(c => /Nerdma/.test(c.title) && (c.href || '').includes('/project/nerdma-website')) &&
    d.cards.some(c => /AddmoreDigital/.test(c.title) && (c.href || '').includes('/project/addmoredigital-website')));
  await page.screenshot({ path: SHOTS + '/wd-full.png', fullPage: true });
}

// ── 5. SNB direct visit redirects ──────────────────────────────────────────
{
  const p2 = await browser.newPage();
  await p2.goto(BASE + '/project/snb-website/', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 2500));
  const url = p2.url();
  check('SNB: direct visit redirects to live site', url.includes('snbconsultancy.co.za'), url);
  await p2.close();
}

// ── 6. Nerdma case study: updated process image ────────────────────────────
{
  const { errs, reqfail } = await load(page, '/project/nerdma-website/');
  const d = await page.evaluate(() => {
    const imgs = [...document.querySelectorAll('img')].map(i => i.getAttribute('src'));
    return {
      procImgs: imgs.filter(s => s && s.includes('web-process.png')),
      text: document.body.innerText,
    };
  });
  check('Nerdma: no JS errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  check('Nerdma: process image used', d.procImgs.length > 0, d.procImgs.length + 'x');
  check('Nerdma: process image loads', reqfail.filter(u => /web-process/.test(u)).length === 0,
    reqfail.filter(u => /web-process/.test(u)).join(' | '));
  check('Nerdma: intro wording updated', /discovery, structure, interface design, build, then launch/.test(d.text));
  await page.screenshot({ path: SHOTS + '/nerdma-full.png', fullPage: true });
}

// ── 7. LulaGazette case study page ─────────────────────────────────────────
{
  const { errs, reqfail } = await load(page, '/project/lula-gazette/');
  const d = await page.evaluate(() => ({
    gh: !!document.querySelector('a.ghostbtn[href*="github.com/LulamileMkhungela/LulaGazette"]'),
    glass: [...document.querySelectorAll('.card')].every(c => (getComputedStyle(c).backdropFilter || '').includes('blur')),
    imgs: [...document.querySelectorAll('figure img')].map(i => ({ s: i.getAttribute('src'), ok: i.complete && i.naturalWidth > 0 })),
  }));
  check('Gazette: no JS errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  check('Gazette: GitHub button present', d.gh);
  check('Gazette: cards are frosted glass', d.glass);
  check('Gazette: all 5 screenshots load', d.imgs.length === 5 && d.imgs.every(i => i.ok),
    d.imgs.map(i => i.s.split('/').pop() + (i.ok ? '✓' : '✗')).join(' '));
  check('Gazette: no failed asset requests', reqfail.length === 0, reqfail.slice(0, 3).join(' | '));
  await page.screenshot({ path: SHOTS + '/gazette-full.png', fullPage: true });
  await page.screenshot({ path: SHOTS + '/gazette-hero.png' });
}

// ── 8. Glassmorphism spot-checks across pages ──────────────────────────────
{
  const pages = [
    ['home', '/'],
    ['about', '/about/'],
    ['services', '/services/'],
    ['case-study', '/project/designops-design-system/'],
    ['trustshield', '/project/lula-trustshield/'],
  ];
  for (const [name, path] of pages) {
    const { errs } = await load(page, path);
    const d = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('main .bg-card, main [class*="bg-card"]')];
      const frosted = cards.filter(c => (getComputedStyle(c).backdropFilter || '').includes('blur'));
      return { n: cards.length, f: frosted.length };
    });
    check(`glass[${name}]: ${d.f}/${d.n} card surfaces frosted, no JS errors`, errs.length === 0, `${d.n} cards`);
  }
  await page.screenshot({ path: SHOTS + '/casestudy-designops.png', fullPage: true });
}

await browser.close();
const fails = results.filter(r => !r.ok);
console.log(`\n${results.length - fails.length}/${results.length} checks passed`);
process.exit(fails.length ? 1 : 0);
