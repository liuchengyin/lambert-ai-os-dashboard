import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync('sprint1-navigation.js','utf8').split('// GLM Flash navigation draft, corrected to use the existing view router and URL.')[1];
function run(query,stored='tasks'){
 const opened=[];const location={href:'http://example.test/'+query};const listeners={};
 const storage={getItem:()=>stored,setItem:(_,v)=>{stored=v}};
 const window={openView:id=>opened.push(id),addEventListener:(k,f)=>listeners[k]=f};
 const context={window,location,URL,localStorage:storage,history:{state:null,pushState:(_,__,u)=>location.href=String(u),replaceState:(_,__,u)=>location.href=String(u)},document:{getElementById:()=>({classList:{contains:()=>true}}),querySelector:()=>({})},MutationObserver:class{observe(){}disconnect(){}}};
 vm.runInNewContext(source,context);return {opened,window,location,listeners};
}
for(const query of ['?view=home','?view=home%C2%A0','?view=%20home%20','?view=unknown','?view=']){
 const r=run(query);assert.equal(r.opened.at(-1),'home',query);assert.equal(new URL(r.location.href).searchParams.get('view'),'home');
}
assert.equal(run('').opened.at(-1),'tasks','root preserves existing last-view behavior');
const r=run('?view=home');r.window.openView(' tasks\u00a0');assert.equal(r.opened.at(-1),'tasks');r.window.openView('invalid');assert.equal(r.opened.at(-1),'home');
console.log('PASS: trimmed URL and programmatic routes; unknown routes return home; root preserves last view');
