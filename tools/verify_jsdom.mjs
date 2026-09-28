// jsdom verification: executes the real bundle + edits.js + patch.js per route.
import { JSDOM, ResourceLoader, VirtualConsole } from './node_modules/jsdom/lib/api.js';

const BASE = process.env.QA_BASE || 'http://127.0.0.1:8000';
const results = [];
function check(name, ok, extra = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`);
}

async function loadRoute(path) {
  const errors = [];
  const jsdomErrors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => {
    const msg = String(e.message || e);
    if (/Not implemented/.test(msg) && !/navigation/.test(msg)) return;
    if (/Could not parse CSS stylesheet/.test(msg)) return; // jsdom limitation on the pre-existing Tailwind bundle
    jsdomErrors.push(msg.slice(0, 200));
  });
  vc.on('error', (...a) => jsdomErrors.push('console.error: ' + a.map(String).join(' ').slice(0, 200)));

  class L extends ResourceLoader {
    fetch(url, options) {
      if (/fonts\.(googleapis|gstatic)|fontshare/.test(url)) return Promise.resolve(Buffer.from(''));
      return super.fetch(url, options);
    }
  }

  const html0 = await (await fetch(BASE + path)).text();
  // jsdom cannot run ES modules — the bundle is a self-contained IIFE, so run it classic
  const html = html0.replace(/<script type="module"([^>]*)src="([^"]+)"([^>]*)><\/script>/g, '<script src="$2"$3></script>');

  const dom = new JSDOM(html, {
    url: BASE + path,
    runScripts: 'dangerously',
    resources: new L(),
    pretendToBeVisual: true,
    virtualConsole: vc,
    beforeParse(window) {
      window.matchMedia = window.matchMedia || ((q) => ({
        matches: false, media: q, onchange: null,
        addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; },
      }));
      window.IntersectionObserver = window.IntersectionObserver || class {
        constructor(cb) { this.cb = cb; }
        observe(el) { setTimeout(() => this.cb([{ target: el, isIntersecting: true }], this), 0); }
        unobserve() {} disconnect() {}
      };
      window.addEventListener('error', e => errors.push('window: ' + (e.message || 'error')));
      window.scrollTo = () => {};
    },
  });

  await new Promise(r => setTimeout(r, 4000));
  return { dom, doc: dom.window.document, win: dom.window, errors, jsdomErrors };
}

async function main() {
  // ── 1. Product Design & Strategy ──
  {
    const { doc, win, errors, jsdomErrors } = await loadRoute('/product-design-strategy/');
    const text = doc.body.textContent;
    const h3s = [...doc.querySelectorAll('#pds-selected h3')].map(h => h.textContent.trim());
    check('PD: renders content', text.length > 2000, text.length + ' chars');
    check('PD: LulaGazette in Selected work', text.includes('LulaGazette'), 'h3s: ' + h3s.join(' / '));
    check('PD: TrustShield removed from page', !/TrustShield|LulaUnifidMarket/.test(text));
    check('PD: Employee Engagement + DesignOps still listed', /Employee Engagement/i.test(text) && /DesignOps/i.test(text));
    const gh = [...doc.querySelectorAll('#pds-selected a')].map(a => a.getAttribute('href'));
    check('PD: gazette card links to lula-gazette (patch relabel)', gh.some(h => h && h.includes('lula-gazette')), gh.join(' '));
    check('PD: no script errors', errors.length === 0 && jsdomErrors.filter(e => !/navigation/.test(e)).length === 0,
      (errors.concat(jsdomErrors).slice(0, 3)).join(' | '));
    win.close();
  }

  // ── 2. Microfinance & Impact ──
  {
    const { doc, win, errors, jsdomErrors } = await loadRoute('/microfinance-impact-consulting/');
    const text = doc.body.textContent;
    check('MFI: renders', text.length > 2000);
    check('MFI: LulaGazette removed', !/LulaGazette|Lexark/.test(text));
    check('MFI: other projects intact', /FoodieZone/i.test(text) && /Africa Cuisine/i.test(text) && /Wandi/i.test(text));
    check('MFI: no script errors', errors.length === 0 && jsdomErrors.filter(e => !/navigation/.test(e)).length === 0,
      (errors.concat(jsdomErrors).slice(0, 3)).join(' | '));
    win.close();
  }

  // ── 3. Frontend Development ──
  {
    const { doc, win, errors, jsdomErrors } = await loadRoute('/frontend-development/');
    const text = doc.body.textContent;
    check('FD: renders', text.length > 2000);
    check('FD: TrustShield present', /TrustShield/.test(text));
    check('FD: DesignOps present', /DesignOps/.test(text));
    check('FD: no script errors', errors.length === 0 && jsdomErrors.filter(e => !/navigation/.test(e)).length === 0,
      (errors.concat(jsdomErrors).slice(0, 3)).join(' | '));
    win.close();
  }

  // ── 4. Website Design & Conversion ──
  {
    const { doc, win, errors, jsdomErrors } = await loadRoute('/website-design-conversion/');
    const text = doc.body.textContent;
    check('WD: renders', text.length > 2000);
    const cards = [...doc.querySelectorAll('section[id="wd-portfolio"] a')].map(a => ({
      t: (a.querySelector('h3') || { textContent: '' }).textContent.trim(),
      href: a.getAttribute('href'), target: a.getAttribute('target'),
    }));
    const snb = cards.find(c => /SNB/.test(c.t));
    check('WD: SNB card -> live site redirect', !!snb && snb.href === 'https://www.snbconsultancy.co.za' && snb.target === '_blank',
      snb ? JSON.stringify(snb) : JSON.stringify(cards.map(c => c.t)));
    const ux = cards.find(c => /UX Resource/.test(c.t));
    check('WD: UX Resource -> Notion', !!ux && (ux.href || '').includes('notion.site'), ux ? ux.href : '');
    check('WD: Nerdma + AddmoreDigital still internal case studies',
      cards.some(c => /Nerdma/.test(c.t) && (c.href || '').includes('/project/nerdma-website')) &&
      cards.some(c => /AddmoreDigital/.test(c.t) && (c.href || '').includes('/project/addmoredigital-website')));
    check('WD: no script errors', errors.length === 0 && jsdomErrors.filter(e => !/navigation/.test(e)).length === 0,
      (errors.concat(jsdomErrors).slice(0, 3)).join(' | '));
    win.close();
  }

  // ── 5. Nerdma case study (static page: canonical process numbering) ──
  {
    const { doc, win, errors, jsdomErrors } = await loadRoute('/project/nerdma-website/');
    const text = doc.body.textContent;
    check('Nerdma: renders', text.length > 2000);
    check('Nerdma: process steps 01/02/04/05',
      /01 · Discovery/.test(text) && /02 · Structure/.test(text) && /04 · Build/.test(text) && /05 · Launch/.test(text));
    check('Nerdma: no old 03/04 numbering', !/<h3>03 · Build/.test(doc.body.innerHTML) && !/<h3>04 · Launch/.test(doc.body.innerHTML));
    const css = [...doc.querySelectorAll('style')].map(x => x.textContent).join('\n');
    check('Nerdma: counter jump rule present', css.includes('counter-increment: st 2'));
    check('Nerdma: no script errors', errors.length === 0 && jsdomErrors.filter(e => !/navigation/.test(e)).length === 0,
      (errors.concat(jsdomErrors).slice(0, 3)).join(' | '));
    win.close();
  }

  // ── 5b. AddmoreDigital case study (same process wording) ──
  {
    const { doc, win, errors, jsdomErrors } = await loadRoute('/project/addmoredigital-website/');
    const text = doc.body.textContent;
    check('Addmore: renders', text.length > 2000);
    check('Addmore: process steps 01/02/04/05',
      /01 · Discovery/.test(text) && /02 · Structure/.test(text) && /04 · Build/.test(text) && /05 · Launch/.test(text));
    const css = [...doc.querySelectorAll('style')].map(x => x.textContent).join('\n');
    check('Addmore: counter jump rule present', css.includes('counter-increment: st 2'));
    win.close();
  }

  // ── 6. SNB case study redirect (patch) ──
  {
    const { doc, win, errors, jsdomErrors } = await loadRoute('/project/snb-website/');
    const redirected = jsdomErrors.some(e => /navigation/.test(e));
    check('SNB: page triggers external redirect', redirected, jsdomErrors.slice(0, 3).join(' | '));
    win.close();
  }

  // ── 7. Glassmorphism CSS injected (style tag present + rules) ──
  {
    const { doc, win, errors } = await loadRoute('/about/');
    const style = doc.getElementById('lm-glass-style');
    const css = style ? style.textContent : '';
    check('glass: style block injected', !!style);
    check('glass: bg-card frosted rule present', css.includes('main .bg-card') && css.includes('backdrop-filter:blur(14px) saturate(1.4)'));
    check('glass: form + footer rules present', css.includes('main input') && css.includes('footer{background:var(--lmg-bg)'));
    const bgc = doc.querySelectorAll('main .bg-card, main [class*="bg-card"]').length;
    check('glass: card surfaces exist on about page', bgc > 0, bgc + ' cards');
    win.close();
  }

  // ── 8. LulaGazette static page ──
  {
    const html = await (await fetch(BASE + '/project/lula-gazette/')).text();
    check('Gazette: GitHub button', /ghostbtn[^>]*github\.com\/LulamileMkhungela\/LulaGazette/.test(html));
    check('Gazette: glass CSS', (html.match(/backdrop-filter:/g) || []).length >= 6, (html.match(/backdrop-filter:/g) || []).length + ' rules');
    check('Gazette: 5 screenshots (og/twitter refs extra)', (html.match(/lulagazette-(hero|search|dashboard|admin|support)\.png/g) || []).length >= 5, (html.match(/lulagazette-(hero|search|dashboard|admin|support)\.png/g) || []).length);
    check('Gazette: meta description fixed', !/dashboard, x"/.test(html) && /Open source on GitHub/.test(html));
  }

  // ── 9. process image bytes served ──
  {
    const r = await fetch(BASE + '/projects/lulamile/web-process.png');
    const buf = Buffer.from(await r.arrayBuffer());
    check('process: image served 200 + PNG 1600x1000', r.ok && buf.length > 40000 && buf.readUInt32BE(16) === 1600 && buf.readUInt32BE(20) === 1000, buf.length + ' bytes');
  }

  const fails = results.filter(r => !r.ok);
  console.log(`\n${results.length - fails.length}/${results.length} checks passed`);
  process.exit(fails.length ? 1 : 0);
}

main().catch(e => { console.error('FATAL', e); process.exit(2); });
