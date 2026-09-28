// Copy-protection probe: same load order as the real page (bundle -> edits.js -> patch.js)
const fs=require('fs'),path=require('path');
const {JSDOM,VirtualConsole}=require('jsdom');
const SITE=process.argv[2]||path.join(__dirname,'..');
const ROUTE=process.argv[3]||'/';
const html=fs.readFileSync(path.join(SITE,'index.html'),'utf8');
const bundle=fs.readFileSync(path.join(SITE,'assets/index-DL0drac2.js'),'utf8');
const edits=fs.readFileSync(path.join(SITE,'lulamile/edits.js'),'utf8');
const patch=fs.readFileSync(path.join(SITE,'lulamile/patch.js'),'utf8');
const vc=new VirtualConsole();
const dom=new JSDOM(html.replace(/<script[^>]*src=[^>]*><\/script>/g,''),{url:'http://localhost:8000'+ROUTE,runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc});
const w=dom.window,d=w.document;
w.matchMedia=w.matchMedia||(()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}}));
class IO{constructor(cb){this.cb=cb}observe(el){this.cb([{isIntersecting:true,target:el,intersectionRatio:1}],this)}unobserve(){}disconnect(){}takeRecords(){return[]}}
w.IntersectionObserver=IO;class RO{constructor(cb){this.cb=cb}observe(el){this.cb([{target:el,contentRect:{width:1200,height:800}}],this)}unobserve(){}disconnect(){}}
w.ResizeObserver=RO;w.scrollTo=()=>{};w.HTMLCanvasElement.prototype.getContext=()=>null;
setTimeout(()=>{
  w.eval(bundle); w.eval(edits); w.eval(patch);
  setTimeout(()=>{
    const style=d.getElementById('lm-protect-style');
    console.log('page:', ROUTE);
    console.log('protection style injected :', !!style);
    if(style) console.log('  user-select:none present :', /user-select\s*:\s*none/.test(style.textContent));
    const fire=(t,el)=>{const e=new w.Event(t,{bubbles:true,cancelable:true});(el||d.body).dispatchEvent(e);return e.defaultPrevented;};
    console.log('copy blocked             :', fire('copy'));
    console.log('cut blocked              :', fire('cut'));
    console.log('contextmenu blocked      :', fire('contextmenu'));
    console.log('selectstart blocked      :', fire('selectstart', d.querySelector('p')||d.body));
    const kc=(k,el)=>{const e=new w.KeyboardEvent('keydown',{key:k,ctrlKey:true,bubbles:true,cancelable:true});(el||d.body).dispatchEvent(e);return e.defaultPrevented;};
    console.log('Ctrl+C blocked           :', kc('c'));
    console.log('Ctrl+X blocked           :', kc('x'));
    console.log('Ctrl+A blocked           :', kc('a'));
    const img=d.querySelector('img');
    if(img) console.log('image dragstart blocked  :', fire('dragstart', img));
    const inp=d.createElement('input'); d.body.appendChild(inp);
    console.log('typing in inputs exempt  :', !fire('copy', inp) && !kc('c', inp));
    const tst=d.getElementById('lm-protect-toast');console.log('toast shown on attempt   :', !!tst, tst?JSON.stringify(tst.textContent):'', tst?('opacity='+tst.style.opacity):'');
    const cc=(w.LM_EDITS&&w.LM_EDITS.settings&&w.LM_EDITS.settings.copyProtection);
    console.log('LM_EDITS.loaded          :', !!w.LM_EDITS, '| copyProtection flag:', cc);
    process.exit(0);
  },2600);
},50);
