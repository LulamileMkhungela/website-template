import { JSDOM, ResourceLoader, VirtualConsole } from './node_modules/jsdom/lib/api.js';
const BASE = 'http://127.0.0.1:8000';
async function loadRoute(path) {
  const vc = new VirtualConsole(); vc.on('jsdomError', () => {});
  class L extends ResourceLoader { fetch(url, o){ if (/fonts\.(googleapis|gstatic)|fontshare/.test(url)) return Promise.resolve(Buffer.from('')); return super.fetch(url,o);} }
  const html0 = await (await fetch(BASE + path)).text();
  const html = html0.replace(/<script type="module"([^>]*)src="([^"]+)"([^>]*)><\/script>/g, '<script src="$2"$3></script>');
  const dom = new JSDOM(html, { url: BASE+path, runScripts:'dangerously', resources:new L(), pretendToBeVisual:true, virtualConsole:vc,
    beforeParse(w){ w.matchMedia=w.matchMedia||((q)=>({matches:false,media:q,onchange:null,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){},dispatchEvent(){return false;}}));
      w.IntersectionObserver=w.IntersectionObserver||class{constructor(cb){this.cb=cb}observe(el){setTimeout(()=>this.cb([{target:el,isIntersecting:true}],this),0)}unobserve(){}disconnect(){}};
      w.scrollTo=()=>{}; } });
  await new Promise(r=>setTimeout(r,4500));
  return dom.window.document;
}
for (const p of ['/','/services/','/product-design-strategy/','/brand-strategy-and-growth/','/microfinance-impact-consulting/']) {
  const doc = await loadRoute(p);
  const hits = [...doc.querySelectorAll('h2,h3')].filter(h=>/usually ask/i.test(h.textContent)).map(h=>h.tagName+': '+h.textContent.trim());
  console.log(p, '=>', JSON.stringify(hits));
}
