import { JSDOM, ResourceLoader, VirtualConsole } from './node_modules/jsdom/lib/api.js';
const BASE = 'http://127.0.0.1:8000';
const vc = new VirtualConsole(); vc.on('jsdomError', () => {});
class L extends ResourceLoader {
  fetch(url, o) { if (/fonts\.(googleapis|gstatic)|fontshare/.test(url)) return Promise.resolve(Buffer.from('')); return Promise.race([super.fetch(url,o), new Promise((_,rej)=>setTimeout(()=>rej(new Error('t')),15000))]); }
}
const html0 = await (await fetch(BASE + '/about/', { signal: AbortSignal.timeout(20000) })).text();
const html = html0.replace(/<script type="module"([^>]*)src="([^"]+)"([^>]*)><\/script>/g, '<script src="$2"$3></script>');
const dom = new JSDOM(html, { url: BASE+'/about/', runScripts:'dangerously', resources:new L(), pretendToBeVisual:true, virtualConsole:vc,
  beforeParse(w){ w.matchMedia=w.matchMedia||((q)=>({matches:false,media:q,onchange:null,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){},dispatchEvent(){return false;}}));
    w.IntersectionObserver=w.IntersectionObserver||class{constructor(cb){this.cb=cb}observe(el){setTimeout(()=>this.cb([{target:el,isIntersecting:true}],this),0)}unobserve(){}disconnect(){}};
    w.scrollTo=()=>{}; } });
await new Promise(r=>setTimeout(r,4500));
const doc = dom.window.document;
const main = doc.querySelector('main');
console.log('main children (top-level):');
[...main.children].forEach(c => {
  const label = c.id ? '#'+c.id : c.tagName.toLowerCase() + (c.className ? '.' + String(c.className).split(' ').slice(0,2).join('.') : '');
  const h2 = c.querySelector('h2');
  console.log('  ', label, h2 ? '→ "' + h2.textContent.trim().slice(0,40) + '"' : '', c.classList.contains('lm-rv') ? '[lm-rv' + (c.classList.contains('in') ? ' in' : '') + ']' : '');
});
const linked = doc.querySelector('section[aria-label="LinkedIn Recommendations"]');
console.log('LinkedIn marquee hidden:', linked && linked.style.display === 'none');
dom.window.close();
