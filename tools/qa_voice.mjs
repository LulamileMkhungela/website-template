// Greeting-voice QA. Simulates: (A) Chrome-style autoplay block on cold load,
// then a real click -> greeting must speak exactly once.
// (B) kill switch (settings.greetingVoice = false) -> never speaks.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM, VirtualConsole } from 'jsdom';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SITE = process.argv[2] || path.join(__dirname, '..');
const SCENARIO = process.argv[3] || 'blocked-then-click';

const html = fs.readFileSync(path.join(SITE, 'index.html'), 'utf8');
const edits = fs.readFileSync(path.join(SITE, 'lulamile/edits.js'), 'utf8');
const patch = fs.readFileSync(path.join(SITE, 'lulamile/patch.js'), 'utf8');

const vc = new VirtualConsole();
const dom = new JSDOM(html.replace(/<script[^>]*src=[^>]*><\/script>/g, ''), {
  url: 'http://localhost:8000/', runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc,
});
const w = dom.window, d = w.document;
w.matchMedia = w.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
w.scrollTo = () => {};

const log = { speakCalls: [], started: [] };
let activated = SCENARIO === 'free';           // 'free' = browser allows cold speech
w.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
w.speechSynthesis = {
  getVoices: () => [{ lang: 'en-ZA', name: 'test' }],
  cancel() {}, resume() {},
  speak(u) {
    log.speakCalls.push(u.text);
    setTimeout(() => {
      if (activated) { log.started.push(u.text); u.onstart && u.onstart(); }
      else { u.onerror && u.onerror({ error: 'not-allowed' }); }
    }, 5);
  },
  set onvoiceschanged(_f) {}, get onvoiceschanged() { return null; },
};

setTimeout(() => {
  w.eval(edits);
  if (SCENARIO === 'kill') w.LM_EDITS.settings.greetingVoice = false;
  w.eval(patch);

  // cold-load window (no interaction)
  setTimeout(() => {
    const beforeGesture = log.started.length;
    if (SCENARIO !== 'kill') {
      activated = true; // visitor clicks something
      d.body.dispatchEvent(new w.Event('click', { bubbles: true }));
    }
    setTimeout(() => {
      console.log('scenario                 :', SCENARIO);
      console.log('speak() attempts (cold)  :', log.speakCalls.length, JSON.stringify(log.speakCalls));
      console.log('audible before gesture   :', beforeGesture);
      console.log('audible after gesture    :', log.started.length, JSON.stringify(log.started));
      const ok =
        SCENARIO === 'kill' ? log.started.length === 0 && log.speakCalls.length === 0 :
        SCENARIO === 'free' ? log.started.length === 1 :
        log.started.length === 1 && beforeGesture === 0;
      console.log('RESULT                   :', ok ? 'PASS' : 'FAIL');
      process.exit(ok ? 0 : 1);
    }, 700);
  }, 900);
}, 60);
