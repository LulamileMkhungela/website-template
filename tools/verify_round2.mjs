// Round-2 verification: About visibility race, per-screen FAQ headings,
// external-redirect badges, limited-edition notes, process de-duplication.
import { JSDOM, ResourceLoader, VirtualConsole } from './node_modules/jsdom/lib/api.js';
const BASE = process.env.QA_BASE || 'http://127.0.0.1:8000';
let pass = 0, fail = 0;
function check(name, ok, extra = '') {
  ok ? pass++ : fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`);
}
async function loadRoute(path) {
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => { const m = String(e.message || e); if (/Could not parse CSS/.test(m) || /Not implemented/.test(m)) return; errors.push(m.slice(0, 150)); });
  vc.on('error', (...a) => errors.push('console.error: ' + a.map(String).join(' ').slice(0, 150)));
  class L extends ResourceLoader {
    fetch(url, o) { if (/fonts\.(googleapis|gstatic)|fontshare/.test(url)) return Promise.resolve(Buffer.from('')); return super.fetch(url, o); }
  }
  const html0 = await (await fetch(BASE + path)).text();
  const html = html0.replace(/<script type="module"([^>]*)src="([^"]+)"([^>]*)><\/script>/g, '<script src="$2"$3></script>');
  const dom = new JSDOM(html, {
    url: BASE + path, runScripts: 'dangerously', resources: new L(), pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) {
      w.matchMedia = w.matchMedia || ((q) => ({ matches: false, media: q, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; } }));
      w.IntersectionObserver = w.IntersectionObserver || class {
        constructor(cb) { this.cb = cb; }
        observe(el) { setTimeout(() => this.cb([{ target: el, isIntersecting: true }], this), 0); }
        unobserve() {} disconnect() {}
      };
      w.addEventListener('error', e => errors.push('window: ' + (e.message || 'error')));
      w.scrollTo = () => {};
    },
  });
  await new Promise(r => setTimeout(r, 4200));
  return { dom, doc: dom.window.document, win: dom.window, errors };
}

// ── 1. About: sections present + late-injected .lm-rv gets observed (the race fix) ──
{
  const { doc, win, errors } = await loadRoute('/about/');
  const certs = doc.getElementById('lm-about-certs');
  const people = doc.getElementById('lm-about-people');
  check('About: certs section injected', !!certs);
  check('About: people section injected', !!people);
  check('About: certs has 10 certificate cards', certs && certs.querySelectorAll('h3').length === 10, certs ? certs.querySelectorAll('h3').length + ' h3' : 'missing');
  check('About: people has 6 quotes', people && people.querySelectorAll('blockquote').length === 6, people ? people.querySelectorAll('blockquote').length + ' quotes' : 'missing');
  // The actual bug: in a real browser React commits after DOMContentLoaded, so the
  // About sections land AFTER the first animPass. Simulate a late .lm-rv element:
  const main = doc.querySelector('main');
  const late = doc.createElement('div');
  late.className = 'lm-rv'; late.id = 'lm-late-test'; late.textContent = 'late';
  main.appendChild(late);
  await new Promise(r => setTimeout(r, 900)); // MutationObserver debounce + IO tick
  check('About: late-injected .lm-rv is observed & revealed (race fix)', late.classList.contains('in'));
  check('About: certs revealed (.in)', certs && certs.classList.contains('in'));
  check('About: people revealed (.in)', people && people.classList.contains('in'));
  check('About: no script errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  win.close();
}

// ── 2. FAQ headings are screen-specific ──
{
  const { doc, win } = await loadRoute('/product-design-strategy/');
  const h2s = [...doc.querySelectorAll('main h2')].map(h => h.textContent.trim());
  check('PD: FAQ heading is founder-audience', h2s.includes('Things founders usually ask.'), h2s.join(' / '));
  win.close();
}
{
  const { doc, win } = await loadRoute('/microfinance-impact-consulting/');
  const h2s = [...doc.querySelectorAll('main h2')].map(h => h.textContent.trim());
  check('MFI: FAQ heading is organisation-audience', h2s.includes('What organisations usually ask.'));
  win.close();
}
{
  const { doc, win } = await loadRoute('/website-design-conversion/');
  const h2s = [...doc.querySelectorAll('main h2')].map(h => h.textContent.trim());
  check('WD: FAQ heading is client-audience', h2s.includes('What clients usually ask.'));
  win.close();
}
{
  const { doc, win } = await loadRoute('/frontend-development/');
  const h2s = [...doc.querySelectorAll('main h2')].map(h => h.textContent.trim());
  check('FD: FAQ heading is client-audience', h2s.includes('What clients usually ask.'));
  win.close();
}
{
  // Brand React route is jsdom-unstable (pre-existing for ALL .html routes),
  // so verify the heading at bundle level.
  const bundle = await (await fetch(BASE + '/assets/index-DL0drac2.js?v=16')).text();
  check('Brand: bundle FAQ heading is brand-owner-audience', bundle.includes('T5="Things brand owners usually ask."') && !bundle.includes('Things founders and sellers usually ask'));
}

// ── 3. External-redirect badges ──
{
  const TARGETS = new Set(['https://www.toyota.co.za/kinto-personal','https://play.google.com/store/apps/details?id=za.co.toyota.toyotaremote&hl=en_ZA&pli=1','https://play.google.com/store/apps/details?id=com.eliance.toyotamobile&hl=en_ZA','https://wandies.vercel.app/','https://skautos.vercel.app/','https://www.snbconsultancy.co.za']);
  async function badgeAudit(path) {
    const { doc, win } = await loadRoute(path);
    const links = [...doc.querySelectorAll('a[href]')].filter(a => TARGETS.has(a.getAttribute('href')));
    const badged = links.filter(a => a.querySelector('.lm-ext-badge') && /Live product/.test(a.querySelector('.lm-ext-badge').textContent) && a.getAttribute('target') === '_blank');
    win.close();
    return { total: links.length, badged: badged.length };
  }
  const mfi = await badgeAudit('/microfinance-impact-consulting/');
  check('MFI: every external-redirect card is badged (wandisplace, sk-finds)', mfi.total === 2 && mfi.badged === 2, `${mfi.badged}/${mfi.total}`);
  const svc = await badgeAudit('/services/');
  check('Services: external-redirect card is badged (SnB)', svc.total === 1 && svc.badged === 1, `${svc.badged}/${svc.total}`);
}

// ── 4. Limited-edition note under Selected work headings ──
async function hasNote(path, heading) {
  const { doc, win } = await loadRoute(path);
  const hs = [...doc.querySelectorAll('h2')].filter(h => h.textContent.trim() === heading);
  const ok = hs.length > 0 && hs.every(h => {
    const n = h.nextElementSibling;
    return n && n.classList.contains('lm-limited-note') && /Limited edition only/.test(n.textContent);
  });
  win.close();
  return ok;
}
check('Home: note under "Selected Work"', await hasNote('/', 'Selected Work'));
check('PD: note under "Selected work"', await hasNote('/product-design-strategy/', 'Selected work'));
check('WD: note under "Selected works"', await hasNote('/website-design-conversion/', 'Selected works'));
check('FD: note under "Selected builds"', await hasNote('/frontend-development/', 'Selected builds'));
check('MFI: note under "Selected work"', await hasNote('/microfinance-impact-consulting/', 'Selected work'));

// ── 5. Live-app case study: bundle route renders the de-duplicated process ──
{
  const { doc, win, errors } = await loadRoute('/project/foodiezone-pwa.html');
  const text = doc.body.textContent;
  check('FZ(.html): new process step 1', text.includes('A trading week on the phone'));
  check('FZ(.html): new process step 2', text.includes('Eight categories, four screens'));
  check('FZ(.html): new process step 3', text.includes('A shell that survives bad signal'));
  check('FZ(.html): new process step 4', text.includes('Let the numbers steer'));
  check('FZ(.html): old step titles gone', !text.includes('Discovery — how orders actually arrive') && !text.includes('Launch, measure, iterate'));
  check('FZ(.html): no script errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  win.close();
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
