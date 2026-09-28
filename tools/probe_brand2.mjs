import { JSDOM, ResourceLoader, VirtualConsole } from './node_modules/jsdom/lib/api.js';
const BASE = 'http://127.0.0.1:8000';
const vc = new VirtualConsole();
const errs = [];
vc.on('jsdomError', e => { const m=String(e.message||e); if(!/CSS/.test(m)) errs.push('jsdomError: '+m.slice(0,200)); });
vc.on('error', (...a) => errs.push('console.error: ' + a.map(String).join(' ').slice(0,300)));
class L extends ResourceLoader {
  fetch(url, options) {
    if (/fonts\.(googleapis|gstatic)|fontshare/.test(url)) return Promise.resolve(Buffer.from(''));
    return super.fetch(url, options);
  }
}
const html0 = await (await fetch(BASE + '/brand-strategy-and-growth/')).text();
const html = html0.replace(/<script type="module"([^>]*)src="([^"]+)"([^>]*)><\/script>/g, '<script src="$2"$3></script>');
const dom = new JSDOM(html, {
  url: BASE + '/brand-strategy-and-growth/', runScripts: 'dangerously', resources: new L(), pretendToBeVisual: true, virtualConsole: vc,
  beforeParse(window) {
    window.matchMedia = window.matchMedia || ((q) => ({ matches:false, media:q, onchange:null, addListener(){}, removeListener(){}, addEventListener(){}, removeEventListener(){}, dispatchEvent(){return false;} }));
    window.IntersectionObserver = window.IntersectionObserver || class { constructor(cb){this.cb=cb} observe(el){ setTimeout(()=>this.cb([{target:el,isIntersecting:true}],this),0) } unobserve(){} disconnect(){} };
    window.addEventListener('error', e => errs.push('window error: ' + (e.message||'error')));
    window.scrollTo = () => {};
  },
});
await new Promise(r => setTimeout(r, 6000));
const doc = dom.window.document;
console.log('all h2:', [...doc.querySelectorAll('h2')].map(h=>h.textContent.trim()).join(' | '));
console.log('section ids:', [...doc.querySelectorAll('[id]')].map(e=>e.id).filter(i=>i && i.length<40).slice(0,40).join(' '));
console.log('has bsa-portfolio:', !!doc.getElementById('bsa-portfolio'));
console.log('has bsa-faq:', !!doc.getElementById('bsa-faq'));
console.log('errors:', errs.slice(0,6));
dom.window.close();
