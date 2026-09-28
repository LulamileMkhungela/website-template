// Feature QA: services industries section, back-to-top button, greeting voice,
// ambient music autoplay. Same load order as the real page (bundle -> edits.js -> patch.js).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM, VirtualConsole } from 'jsdom';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SITE = process.argv[2] || path.join(__dirname, '..');
const ROUTE = process.argv[3] || '/services/';

const html = fs.readFileSync(path.join(SITE, 'index.html'), 'utf8');
const bundle = fs.readFileSync(path.join(SITE, 'assets/index-DL0drac2.js'), 'utf8');
const edits = fs.readFileSync(path.join(SITE, 'lulamile/edits.js'), 'utf8');
const patch = fs.readFileSync(path.join(SITE, 'lulamile/patch.js'), 'utf8');

const vc = new VirtualConsole();
const dom = new JSDOM(html.replace(/<script[^>]*src=[^>]*><\/script>/g, ''), {
  url: 'http://localhost:8000' + ROUTE,
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  virtualConsole: vc,
});
const w = dom.window;
const d = w.document;

w.matchMedia = w.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
class IO { constructor(cb) { this.cb = cb; } observe(el) { this.cb([{ isIntersecting: true, target: el, intersectionRatio: 1 }], this); } unobserve() {} disconnect() {} takeRecords() { return []; } }
w.IntersectionObserver = IO;
class RO { constructor(cb) { this.cb = cb; } observe(el) { this.cb([{ target: el, contentRect: { width: 1200, height: 800 } }], this); } unobserve() {} disconnect() {} }
w.ResizeObserver = RO;
w.scrollTo = () => {};
w.HTMLCanvasElement.prototype.getContext = () => null;

// --- instrument speech + audio so we can see whether anything plays on load ---
const spoken = [];
const audioEvents = [];
w.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
w.speechSynthesis = {
  getVoices: () => [{ lang: 'en-ZA', name: 'test' }],
  speak: (u) => spoken.push(u && u.text),
  resume() {}, cancel() {},
  set onvoiceschanged(_f) {}, get onvoiceschanged() { return null; },
};
const RealAudio = w.Audio;
w.Audio = class extends RealAudio {
  constructor(src) { super(src); audioEvents.push('Audio created' + (src ? ' with src ' + src : ' (no src)')); }
  play() { audioEvents.push('play() called src=' + (this.src || '(none)')); return Promise.resolve(); }
  load() { audioEvents.push('load() called'); }
};

setTimeout(() => {
  w.eval(bundle); w.eval(edits); w.eval(patch);
  setTimeout(() => {
    console.log('route                          :', ROUTE);

    // 1. services industries
    const sec = d.getElementById('lm-services-industries');
    console.log('\n[1] SERVICES INDUSTRIES SECTION');
    console.log('  rendered                     :', !!sec);
    if (sec) {
      const cards = [...sec.querySelectorAll('h3')].map((h) => h.textContent.trim());
      const proof = [...sec.querySelectorAll('div.text-xs')].map((h) => h.textContent.trim());
      console.log('  card count                   :', cards.length);
      cards.forEach((c, i) => console.log(`   ${String(i + 1).padStart(2)}. ${c}  ->  ${proof[i] || ''}`));
    }

    // 2. back to top
    const btt = d.getElementById('lm-back-to-top');
    console.log('\n[2] BACK-TO-TOP BUTTON');
    console.log('  rendered                     :', !!btt);
    if (btt) {
      console.log('  position (desktop)           : right=' + btt.style.right + ' bottom=' + btt.style.bottom + ' size=' + btt.style.width + 'x' + btt.style.height + ' z=' + btt.style.zIndex);
      const st = d.getElementById('lm-btt-style');
      console.log('  mobile override              :', st ? /bottom:\s*144px/.test(st.textContent) : false);
      console.log('  aria-label                   :', btt.getAttribute('aria-label'));
      console.log('  appended to body             :', btt.parentElement === d.body);
    }
    const music = d.querySelector('[aria-label="Ambient music player"]');
    const musicWrap = music ? music.closest('div.fixed') : null;
    console.log('  music player present         :', !!music);
    if (musicWrap) console.log('  music wrapper classes        :', musicWrap.className);

    // 3. sound on load
    console.log('\n[3] SOUND ON FIRST LOAD');
    console.log('  speech attempts (greeting)   :', spoken.length, JSON.stringify(spoken));
    console.log('  audio element activity       :', audioEvents.length ? audioEvents.join(' | ') : 'none (no autoplay)');

    // 4. copy protection
    console.log('\n[4] COPY PROTECTION');
    console.log('  style injected               :', !!d.getElementById('lm-protect-style'));

    process.exit(0);
  }, 3000);
}, 60);
