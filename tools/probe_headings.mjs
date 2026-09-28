import { JSDOM, ResourceLoader, VirtualConsole } from './node_modules/jsdom/lib/api.js';
const BASE = 'http://127.0.0.1:8000';
async function loadRoute(path) {
  const vc = new VirtualConsole();
  vc.on('jsdomError', () => {});
  class L extends ResourceLoader {
    fetch(url, options) {
      if (/fonts\.(googleapis|gstatic)|fontshare/.test(url)) return Promise.resolve(Buffer.from(''));
      return super.fetch(url, options);
    }
  }
  const html0 = await (await fetch(BASE + path)).text();
  const html = html0.replace(/<script type="module"([^>]*)src="([^"]+)"([^>]*)><\/script>/g, '<script src="$2"$3></script>');
  const dom = new JSDOM(html, {
    url: BASE + path, runScripts: 'dangerously', resources: new L(), pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(window) {
      window.matchMedia = window.matchMedia || ((q) => ({ matches:false, media:q, onchange:null, addListener(){}, removeListener(){}, addEventListener(){}, removeEventListener(){}, dispatchEvent(){return false;} }));
      window.IntersectionObserver = window.IntersectionObserver || class { constructor(cb){this.cb=cb} observe(el){ setTimeout(()=>this.cb([{target:el,isIntersecting:true}],this),0) } unobserve(){} disconnect(){} };
      window.scrollTo = () => {};
    },
  });
  await new Promise(r => setTimeout(r, 4000));
  return dom;
}
for (const p of ['/product-design-strategy/','/brand-strategy-growth/','/website-design-conversion/','/frontend-development/','/microfinance-impact-consulting/','/services/','/']) {
  const dom = await loadRoute(p);
  const doc = dom.window.document;
  const h2s = [...doc.querySelectorAll('main h2')].map(h => h.textContent.trim());
  console.log(p, '=>', JSON.stringify(h2s));
  dom.window.close();
}
