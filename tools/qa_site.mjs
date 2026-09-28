// Full-site regression QA for the LulaGazette + balance + contact-form release.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM, VirtualConsole } from 'jsdom';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SITE = process.argv[2] || path.join(__dirname, '..');
const ROUTE = process.argv[3] || '/';

const html = fs.readFileSync(path.join(SITE, 'index.html'), 'utf8');
const bundle = fs.readFileSync(path.join(SITE, 'assets/index-DL0drac2.js'), 'utf8');
const edits = fs.readFileSync(path.join(SITE, 'lulamile/edits.js'), 'utf8');
const patch = fs.readFileSync(path.join(SITE, 'lulamile/patch.js'), 'utf8');

const vc = new VirtualConsole();
const dom = new JSDOM(html.replace(/<script[^>]*src=[^>]*><\/script>/g, ''), {
  url: 'http://localhost:8000' + ROUTE, runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc,
});
const w = dom.window, d = w.document;
w.matchMedia = w.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
class IO { constructor(cb) { this.cb = cb; } observe(el) { this.cb([{ isIntersecting: true, target: el, intersectionRatio: 1 }], this); } unobserve() {} disconnect() {} takeRecords() { return []; } }
w.IntersectionObserver = IO;
class RO { constructor(cb) { this.cb = cb; } observe(el) { this.cb([{ target: el, contentRect: { width: 1200, height: 800 } }], this); } unobserve() {} disconnect() {} }
w.ResizeObserver = RO;
w.scrollTo = () => {};
w.HTMLCanvasElement.prototype.getContext = () => null;
let replacedTo = null;
try { w.Location.prototype.replace = function (u) { replacedTo = u; }; } catch (e) { try { w.location.replace = (u) => { replacedTo = u; }; } catch (e2) {} }
let fetchCalls = [];
w.fetch = (url, opts) => { fetchCalls.push({ url, method: opts && opts.method }); return Promise.resolve({ ok: true }); };

setTimeout(() => {
  w.eval(bundle); w.eval(edits); w.eval(patch);
  setTimeout(async () => {
    console.log('##### ROUTE', ROUTE);

    if (ROUTE === '/') {
      const row = d.getElementById('lm-area-frontend');
      console.log('areas row 05 injected      :', !!row, row ? '| ' + row.querySelector('h3').textContent : '');
      const prev = row && row.previousElementSibling;
      console.log('  sits after web row       :', !!prev && /website-design-conversion/.test(prev.getAttribute('href') || ''));
      console.log('work balance note          :', !!d.getElementById('lm-work-note'));
      console.log('lexark wording gone        :', !d.body.textContent.includes('Lexark'));
    }
    if (ROUTE === '/services/') {
      const e = d.getElementById('cluster-e');
      console.log('services cluster E         :', !!e);
      if (e) console.log('  cards                    :', e.querySelectorAll('h4').length, [...e.querySelectorAll('h4')].map((h) => h.textContent).join(' | '));
      const ind = d.getElementById('lm-services-industries');
      console.log('industries cards           :', ind ? ind.querySelectorAll('h3').length : 0, '| LulaGazette proof:', !!ind && ind.textContent.includes('LulaGazette'));
      console.log('lexark wording gone        :', !d.body.textContent.includes('Lexark'));
    }
    if (ROUTE === '/contact/') {
      const form = d.getElementById('lm-brief-form');
      console.log('formspree form injected    :', !!form);
      if (form) {
        console.log('  fields                   :', [...form.querySelectorAll('input,textarea')].map((x) => x.name || x.type).join(','));
        form.querySelector('[name="name"]').value = 'Test Person';
        form.querySelector('[name="email"]').value = 'test@example.co.za';
        form.querySelector('[name="message"]').value = 'Hello, I need a website.';
        form.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
        await new Promise((r) => setTimeout(r, 60));
        console.log('  POST target              :', fetchCalls.length ? fetchCalls[0].url + ' ' + fetchCalls[0].method : 'none');
        console.log('  success state shown      :', form.style.display === 'none' && !form.querySelector('.lm-form-done').hidden);
      }
      const li = [...d.querySelectorAll('a[href*="linkedin.com"]')].filter((a) => a.textContent.trim() === 'LinkedIn');
      console.log('linkedin text buttons      :', li.length, '(want 1)');
    }
    if (ROUTE.includes('lexark')) {
      console.log('lexark route redirects to  :', replacedTo);
    }

    // silent copy protection everywhere
    const copyEv = new w.Event('copy', { bubbles: true, cancelable: true });
    d.body.dispatchEvent(copyEv);
    console.log('copy blocked               :', copyEv.defaultPrevented);
    console.log('no toast shown (silent)    :', !d.getElementById('lm-protect-toast'));

    // back to top + perf
    console.log('back-to-top present        :', !!d.getElementById('lm-back-to-top'));
    const imgs = [...d.querySelectorAll('img')];
    console.log('lazy imgs / total          :', imgs.filter((i) => i.loading === 'lazy').length + '/' + imgs.length);
    console.log('preconnect hints           :', !!d.getElementById('lm-preconnect'));
    process.exit(0);
  }, 3400);
}, 60);
