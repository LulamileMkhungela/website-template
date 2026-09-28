import { JSDOM, ResourceLoader, VirtualConsole } from './node_modules/jsdom/lib/api.js';
const BASE = 'http://127.0.0.1:8000';
const PATH = process.argv[2] || '/brand-strategy-and-growth.html';
const errs = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => { const m = String(e.message||e); if (!/CSS|Not implemented/.test(m)) errs.push('jsdomError: ' + m.slice(0,200)); });
vc.on('error', (...a) => errs.push('console.error: ' + a.map(String).join(' ').slice(0,200)));
class L extends ResourceLoader {
  fetch(url, o) { if (/fonts\.(googleapis|gstatic)|fontshare/.test(url)) return Promise.resolve(Buffer.from('')); return Promise.race([super.fetch(url,o), new Promise((_,rej)=>setTimeout(()=>rej(new Error('t')),15000))]); }
}
const html0 = await (await fetch(BASE + PATH, { signal: AbortSignal.timeout(20000) })).text();
const html = html0.replace(/<script type="module"([^>]*)src="([^"]+)"([^>]*)><\/script>/g, '<script src="$2"$3></script>');
const dom = new JSDOM(html, { url: BASE+PATH, runScripts:'dangerously', resources:new L(), pretendToBeVisual:true, virtualConsole:vc,
  beforeParse(w){ w.matchMedia=w.matchMedia||((q)=>({matches:false,media:q,onchange:null,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){},dispatchEvent(){return false;}}));
    w.IntersectionObserver=w.IntersectionObserver||class{constructor(cb){this.cb=cb}observe(el){setTimeout(()=>this.cb([{target:el,isIntersecting:true}],this),0)}unobserve(){}disconnect(){}};
    w.addEventListener('error', e => errs.push('window: ' + (e.message||'error') + ' @' + (e.filename||'').split('/').pop() + ':' + e.lineno));
    w.scrollTo=()=>{}; } });
await new Promise(r=>setTimeout(r,5000));
const doc = dom.window.document;
console.log('body length:', doc.body.innerHTML.length);
console.log('h2s:', [...doc.querySelectorAll('h2')].map(h=>h.textContent.trim()).join(' | '));
console.log('errors:', errs.slice(0,6)); console.log('BODY:', doc.body.innerHTML.slice(0,800));
dom.window.close();
