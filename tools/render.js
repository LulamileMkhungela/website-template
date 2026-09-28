// usage: node render.js <site_dir> <route> <wait_ms> [html]
const fs=require('fs'),path=require('path');const {JSDOM,VirtualConsole}=require('jsdom');
const SITE=process.argv[2],ROUTE=process.argv[3]||'/';const WAIT=parseInt(process.argv[4]||'2200',10);
const SHOW=process.argv[5]==='html';
const html=fs.readFileSync(path.join(SITE,'index.html'),'utf8');
const bundle=fs.readFileSync(path.join(SITE,'assets/index-DL0drac2.js'),'utf8');
const ep=path.join(SITE,'lulamile/edits.js');const edits=fs.existsSync(ep)?fs.readFileSync(ep,'utf8'):'';
const pp=path.join(SITE,'lulamile/patch.js');const patch=fs.existsSync(pp)?fs.readFileSync(pp,'utf8'):'';
const vc=new VirtualConsole();const errors=[];
vc.on('jsdomError',e=>errors.push('JSDOM: '+(e.detail?e.detail.stack||e.detail:e.message)));
vc.on('error',(...a)=>errors.push('ERR: '+a.map(String).join(' ')));vc.on('warn',()=>{});vc.on('log',()=>{});
const dom=new JSDOM(html.replace(/<script[^>]*src=[^>]*><\/script>/g,''),{url:'http://localhost:8000'+ROUTE,runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc});
const {window}=dom;window.requestAnimationFrame=window.requestAnimationFrame||(cb=>setTimeout(()=>cb(Date.now()),16));
window.matchMedia=window.matchMedia||(()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}}));
class IO{constructor(cb){this.cb=cb}observe(el){this.cb([{isIntersecting:true,target:el,intersectionRatio:1}],this)}unobserve(){}disconnect(){}takeRecords(){return[]}}
window.IntersectionObserver=IO;class RO{constructor(cb){this.cb=cb}observe(el){this.cb([{target:el,contentRect:{width:1200,height:800}}],this)}unobserve(){}disconnect(){}}
window.ResizeObserver=RO;window.scrollTo=()=>{};window.HTMLCanvasElement.prototype.getContext=()=>null;
setTimeout(()=>{try{window.eval(bundle);if(edits)window.eval(edits);if(patch)window.eval(patch);}catch(e){errors.push('BUNDLE THROW: '+e.stack);}
setTimeout(()=>{const root=window.document.getElementById('root');const text=root?(root.innerText||root.textContent):'(no root)';
console.log('=== ROUTE: '+ROUTE+' ===');console.log('=== TEXT ===');console.log(text.replace(/\n{3,}/g,'\n\n').slice(0,9000));
console.log('\n=== IMAGES ===');console.log([...new Set([...window.document.querySelectorAll('img')].map(i=>i.getAttribute('src')))].join('\n'));
console.log('\n=== LINKS ===');const links=[...window.document.querySelectorAll('a')].map(a=>a.getAttribute('href')).filter(Boolean);
console.log([...new Set(links)].join('\n'));
if(SHOW&&root){console.log('\n=== HTML ===');console.log(root.innerHTML.slice(0,6000));}
console.log(errors.length?('\n=== ERRORS ===\n'+errors.slice(0,10).join('\n')):'\n=== NO ERRORS ===');process.exit(0);},WAIT);},50);
