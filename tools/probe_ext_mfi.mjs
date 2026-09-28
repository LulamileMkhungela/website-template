import { JSDOM, ResourceLoader, VirtualConsole } from './node_modules/jsdom/lib/api.js';
const BASE = 'http://127.0.0.1:8000';
class L extends ResourceLoader {
  fetch(url, o) { if (/fonts\.(googleapis|gstatic)|fontshare/.test(url)) return Promise.resolve(Buffer.from('')); return Promise.race([super.fetch(url,o), new Promise((_,rej)=>setTimeout(()=>rej(new Error('res-timeout: '+url)), 15000))]); }
}
async function loadRoute(path) {
  const vc = new VirtualConsole(); vc.on('jsdomError', () => {});
  const html0 = await (await fetch(BASE + path, { signal: AbortSignal.timeout(20000) })).text();
  const html = html0.replace(/<script type="module"([^>]*)src="([^"]+)"([^>]*)><\/script>/g, '<script src="$2"$3></script>');
  const dom = new JSDOM(html, { url: BASE+path, runScripts:'dangerously', resources:new L(), pretendToBeVisual:true, virtualConsole:vc,
    beforeParse(w){ w.matchMedia=w.matchMedia||((q)=>({matches:false,media:q,onchange:null,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){},dispatchEvent(){return false;}}));
      w.IntersectionObserver=w.IntersectionObserver||class{constructor(cb){this.cb=cb}observe(el){setTimeout(()=>this.cb([{target:el,isIntersecting:true}],this),0)}unobserve(){}disconnect(){}};
      w.scrollTo=()=>{}; } });
  await new Promise(r=>setTimeout(r,4000));
  return dom;
}
const TARGETS = new Set(['https://www.toyota.co.za/kinto-personal','https://play.google.com/store/apps/details?id=za.co.toyota.toyotaremote&hl=en_ZA&pli=1','https://play.google.com/store/apps/details?id=com.eliance.toyotamobile&hl=en_ZA','https://wandies.vercel.app/','https://skautos.vercel.app/','https://www.snbconsultancy.co.za']);
const t0 = Date.now();
const dom = await loadRoute('/microfinance-impact-consulting/');
const doc = dom.window.document;
const links = [...doc.querySelectorAll('a[href]')].filter(a => TARGETS.has(a.getAttribute('href')));
console.log('MFI external-redirect links:', links.length, '(' + (Date.now()-t0) + 'ms)'));
links.forEach(a => console.log('  ', a.getAttribute('href').slice(0,60), '| badge:', !!a.querySelector('.lm-ext-badge'), '| target:', a.getAttribute('target')));
dom.window.close();
