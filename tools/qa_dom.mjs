// DOM inspector: dump headings, section labels, forms, linkedin links per route.
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

setTimeout(() => {
  w.eval(bundle); w.eval(edits); w.eval(patch);
  setTimeout(() => {
    console.log('##### ROUTE', ROUTE);
    console.log('--- headings ---');
    d.querySelectorAll('h1,h2,h3').forEach((h) => console.log(` ${h.tagName}: ${h.textContent.trim().slice(0, 90)}`));
    console.log('--- small labels (uppercase eyebrows) ---');
    d.querySelectorAll('p,span').forEach((el) => {
      const t = el.textContent.trim();
      if (t && t.length < 40 && /uppercase/.test(el.className)) console.log(`  * ${t}`);
    });
    console.log('--- forms ---');
    d.querySelectorAll('form').forEach((f, i) => {
      console.log(` form#${i} action=${f.getAttribute('action')} fields=` + [...f.querySelectorAll('input,textarea,select')].map((x) => x.getAttribute('name') || x.type).join(','));
    });
    console.log('--- linkedin links ---');
    d.querySelectorAll('a[href*="linkedin"]').forEach((a) => console.log(`  <a> "${a.textContent.trim().slice(0, 40)}" aria=${a.getAttribute('aria-label')} class=${String(a.className).slice(0, 40)}`));
    console.log('--- buttons mentioning linkedin ---');
    d.querySelectorAll('button').forEach((b) => { if (/linkedin/i.test(b.textContent + (b.getAttribute('aria-label') || ''))) console.log(`  <button> "${b.textContent.trim().slice(0, 40)}"`); });
    console.log('--- filter/tag chips ---');
    d.querySelectorAll('button').forEach((b) => { const t = b.textContent.trim(); if (t && t.length < 22 && /^(all|design|build|web|pwa|brand|crm|ai|frontend|engineering|strategy)/i.test(t)) console.log(`  chip: ${t}`); });
    process.exit(0);
  }, 3200);
}, 60);
