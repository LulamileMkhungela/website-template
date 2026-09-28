import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM, VirtualConsole } from 'jsdom';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SITE = path.join(__dirname, '..');
const ROUTE = process.argv[2] || '/';
const html = fs.readFileSync(path.join(SITE, 'index.html'), 'utf8');
const bundle = fs.readFileSync(path.join(SITE, 'assets/index-DL0drac2.js'), 'utf8');
const edits = fs.readFileSync(path.join(SITE, 'lulamile/edits.js'), 'utf8');
const patch = fs.readFileSync(path.join(SITE, 'lulamile/patch.js'), 'utf8');

const vc = new VirtualConsole();
const errs = [];
vc.on('jsdomError', e => errs.push(String(e.message || e).slice(0, 200)));
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
w.localStorage.clear();
let fetchCalls = [];
w.fetch = (url, opts) => { fetchCalls.push({ url, method: opts && opts.method }); return Promise.resolve({ ok: true, json: () => Promise.resolve({}) }); };
let spoke = [];
w.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; this.rate = 1; this.pitch = 1; this.volume = 1; } };
// minimal speechSynthesis fake to test the greeting-once gate
w.speechSynthesis = {
  speaking: false, pending: false,
  cancel() { spoke.push('cancel'); },
  speak(u) { spoke.push('speak'); if (u && u.onstart) u.onstart(); },
  getVoices: () => [],
};
try { w.eval(bundle); } catch (e) { console.log('BUNDLE EVAL ERROR:', String(e).slice(0, 300)); }
w.eval(edits);
try { w.eval(patch); } catch (e) { console.log('PATCH EVAL ERROR:', String(e).slice(0, 500)); }

setTimeout(async () => {
  console.log('##### ROUTE', ROUTE);
  if (errs.length) console.log('jsdom errors:', errs.slice(0, 5));

  if (ROUTE === '/about') {
    const people = d.getElementById('lm-about-people');
    const certs = d.getElementById('lm-about-certs');
    console.log('testimonials section     :', !!people);
    console.log('  quote cards            :', people ? people.querySelectorAll('figure').length : 0, '(want 4)');
    console.log('  linkedin label present :', people ? /LinkedIn/i.test(people.textContent) : 'n/a', '(want false)');
    console.log('certifications section   :', !!certs);
    console.log('  cert cards             :', certs ? certs.querySelectorAll('img').length : 0, '(want 10)');
    const linked = d.querySelector('section[aria-label="LinkedIn Recommendations"]');
    console.log('old linkedin section hidden:', linked ? linked.style.display === 'none' : 'section-not-found');
  }

  if (ROUTE === '/services') {
    const sec = d.getElementById('lm-services-industries');
    console.log('industries section       :', !!sec);
    if (sec) {
      const h3 = [...sec.querySelectorAll('h3')].map(h => h.textContent.trim());
      console.log('sector cards             :', h3.join(' | '));
      const mono = sec.querySelectorAll('.text-xs.font-mono');
      console.log('company-name rows        :', mono.length, '(want 0)');
      const ict = h3.findIndex(t => t.includes('ICT Services'));
      console.log('order after ICT          :', h3.slice(ict + 1, ict + 4).join(' | '));
    }
  }

  if (ROUTE === '/contact') {
    // switch to the "Send a message" tab (default tab is "Book a call")
    const tab = [...d.querySelectorAll('button')].find(b => (b.textContent || '').includes('Send a message'));
    if (tab) { tab.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); }
    await new Promise(r => setTimeout(r, 800));
    const form = [...d.querySelectorAll('form')].find(f => {
      const b = f.querySelector('button[type="submit"], input[type="submit"]');
      return b && (b.textContent || b.value || '').includes('Send message') && f.querySelector('#captcha');
    });
    console.log('react form found         :', !!form);
    if (form) {
      form.querySelector('#name').value = 'Test Person';
      form.querySelector('#email').value = 'test@example.co.za';
      form.querySelector('#message').value = 'Hello, I need a website.';
      form.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
      await new Promise(r => setTimeout(r, 120));
      console.log('POST target              :', fetchCalls.length ? fetchCalls[0].url + ' ' + fetchCalls[0].method : 'none');
      const panel = d.getElementById('lm-cf-panel');
      console.log('success panel shown      :', panel ? panel.style.display === 'block' : false);
      console.log('success text             :', panel ? panel.textContent.slice(0, 60) : '');
      console.log('form hidden after send   :', form.style.display === 'none');
      console.log('subject appended         :', fetchCalls.length);
    }
  }

  if (ROUTE === '/' || ROUTE === '/about') {
    console.log('speak attempts (greet)   :', spoke.filter(s => s === 'speak').length);
    console.log('greet flag set           :', w.localStorage.getItem('lmGreeted') === '1');
    // a second "greeting" attempt must now be swallowed
    const before = spoke.filter(s => s === 'speak').length;
    w.speechSynthesis.speak({});
    console.log('second speak swallowed   :', spoke.filter(s => s === 'speak').length === before);
  }

  if (ROUTE.indexOf('brand-strategy-programme') > -1) {
    const t = d.body.textContent || '';
    console.log('bsg cs title present     :', t.includes('KINTO, Toyota App & Toyota Remote'));
    console.log('three expressions        :', t.includes('Three customer-facing expressions'));
    console.log('no automark              :', !t.includes('AutoMark'));
    const imgs = [...d.querySelectorAll('img')].map(i => i.getAttribute('src') || i.src);
    console.log('kinto img used           :', imgs.some(x => x && x.includes('kinto-cover')));
    console.log('toyota-app img used      :', imgs.some(x => x && x.includes('toyota-app-cover')));
    console.log('toyota-remote img used   :', imgs.some(x => x && x.includes('toyota-remote-cover')));
    console.log('process steps 01-04      :', ['01 · Strategy & positioning','02 · Identity system','03 · Application','04 · Guidelines & rollout'].map(x => t.includes(x)));
    console.log('img srcs                 :', [...d.querySelectorAll('img')].map(i => (i.getAttribute('src')||'').split('/').pop()).join(' | '));
  }

  if (ROUTE === '/brand-strategy-and-growth') {
    const t = d.body.textContent || '';
    console.log('bsg title present        :', t.includes('KINTO, Toyota App & Toyota Remote'));
    console.log('automark removed         :', !t.includes('AutoMark'));
    console.log('three expressions        :', t.includes('Three customer-facing expressions'));
    const imgs = [...d.querySelectorAll('img')].map(i => i.getAttribute('src') || i.src);
    console.log('kinto img used           :', imgs.some(x => x && x.includes('kinto-cover')));
    console.log('toyota-app img used      :', imgs.some(x => x && x.includes('toyota-app-cover')));
    console.log('toyota-remote img used   :', imgs.some(x => x && x.includes('toyota-remote-cover')));
  }

  console.log('no patch crash           :', !errs.some(e => e.includes('PATCH')));
  process.exit(0);
}, 3400);
