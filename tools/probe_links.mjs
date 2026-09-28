import { JSDOM, ResourceLoader, VirtualConsole } from './node_modules/jsdom/lib/api.js';
const BASE = 'http://127.0.0.1:8000';
const PATH = process.argv[2];
class L extends ResourceLoader {
  fetch(url, o) { if (/fonts\.(googleapis|gstatic)|fontshare/.test(url)) return Promise.resolve(Buffer.from('')); return Promise.race([super.fetch(url,o), new Promise((_,rej)=>setTimeout(()=>rej(new Error('t')),15000))]); }
}
const vc = new VirtualConsole(); vc.on('jsdomError', () => {});
const html0 = await (await fetch(BASE + PATH, { signal: AbortSignal.timeout(20000) })).text();
const html = html0.replace(/<script type="module"([^>]*)src="([^"]+)"([^>]*)><\/script>/g, '<script src="$2"$3></script>');
const dom = new JSDOM(html, { url: BASE+PATH, runScripts:'dangerously', resources:new L(), pretendToBeVisual:true, virtualConsole:vc,
  beforeParse(w){ w.matchMedia=w.matchMedia||((q)=>({matches:false,media:q,onchange:null,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){},dispatchEvent(){return false;}}));
    w.IntersectionObserver=w.IntersectionObserver||class{constructor(cb){this.cb=cb}observe(el){setTimeout(()=>this.cb([{target:el,isIntersecting:true}],this),0)}unobserve(){}disconnect(){}};
    w.scrollTo=()=>{}; } });
await new Promise(r=>setTimeout(r,4000));
const doc = dom.window.document;
[...doc.querySelectorAll('main a[href*="/project/"], main a[href*="/graphic/"]')].forEach(a => {
  console.log(' ', a.getAttribute('href'), '|', (a.textContent||'').trim().slice(0,50));
});
dom.window.close();
