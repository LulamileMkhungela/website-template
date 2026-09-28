import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { JSDOM, VirtualConsole } from 'jsdom';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SITE = process.argv[2]; const ROUTE = process.argv[3]; const RE = new RegExp(process.argv[4], 'i');
const html = fs.readFileSync(path.join(SITE,'index.html'),'utf8');
const bundle = fs.readFileSync(path.join(SITE,'assets/index-DL0drac2.js'),'utf8');
const edits = fs.readFileSync(path.join(SITE,'lulamile/edits.js'),'utf8');
const patch = fs.readFileSync(path.join(SITE,'lulamile/patch.js'),'utf8');
const vc = new VirtualConsole();
const dom = new JSDOM(html.replace(/<script[^>]*src=[^>]*><\/script>/g,''),{url:'http://localhost:8000'+ROUTE,runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc});
const w = dom.window, d = w.document;
w.matchMedia = w.matchMedia || (()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}}));
class IO{constructor(cb){this.cb=cb}observe(el){this.cb([{isIntersecting:true,target:el,intersectionRatio:1}],this)}unobserve(){}disconnect(){}takeRecords(){return[]}}
w.IntersectionObserver=IO; class RO{constructor(cb){this.cb=cb}observe(el){this.cb([{target:el,contentRect:{width:1200,height:800}}],this)}unobserve(){}disconnect(){}}
w.ResizeObserver=RO; w.scrollTo=()=>{}; w.HTMLCanvasElement.prototype.getContext=()=>null;
setTimeout(()=>{ w.eval(bundle); w.eval(edits); w.eval(patch);
  setTimeout(()=>{
    const seen=new Set();
    d.querySelectorAll('h1,h2,h3,h4,p,span,div,li,a').forEach(el=>{
      if (el.children.length) return;
      const t=(el.textContent||'').trim();
      if (t && RE.test(t) && !seen.has(t)) { seen.add(t); console.log(`<${el.tagName.toLowerCase()} class="${String(el.className).slice(0,30)}"> ${t.slice(0,220)}`); }
    });
    process.exit(0);
  },3200);
},60);
