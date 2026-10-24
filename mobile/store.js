// GLM Flash draft, integrated and corrected against the desktop data contract.
(function(){'use strict';
const KEYS=['tasks','projects','daily_reviews_v2'],Q='mobile_pending_v1';
const valid=(k,v)=>k==='daily_reviews_v2'?v&&typeof v==='object'&&!Array.isArray(v):Array.isArray(v);
function parse(k,raw){if(raw===null)return k===Q?[]:k==='daily_reviews_v2'?{}:[];const v=JSON.parse(raw);if(k===Q?!Array.isArray(v):!valid(k,v))throw Error('本地数据格式异常，请先备份');return v}
function read(k,f){if(window.LambertData&&KEYS.includes(k))return window.LambertData.read(k,f);try{const raw=localStorage.getItem(k);return raw===null?f:parse(k,raw)}catch{return f}}
function write(k,v){if(!KEYS.includes(k)||!valid(k,v))throw Error('不支持的数据格式');if(window.LambertData&&window.LambertData.active){window.LambertData.write(k,v);window.dispatchEvent(new CustomEvent('mobile-change',{detail:{key:k}}));return;}const old=localStorage.getItem(k),oq=localStorage.getItem(Q);parse(k,old);const q=parse(Q,oq),now=new Date().toISOString();const next=q.filter(x=>x.key!==k).concat({id:k,key:k,updatedAt:now});const raw=JSON.stringify(v);if(raw===undefined)throw Error('数据不可保存');try{localStorage.setItem(Q,JSON.stringify(next));localStorage.setItem(k,raw)}catch(e){try{oq===null?localStorage.removeItem(Q):localStorage.setItem(Q,oq);old===null?localStorage.removeItem(k):localStorage.setItem(k,old)}catch{}throw e}window.dispatchEvent(new CustomEvent('mobile-change',{detail:{key:k}}))}
window.MobileStore={read,write,pending:()=>read(Q,[]),date:(value)=>{const d=value||new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}};
})();
