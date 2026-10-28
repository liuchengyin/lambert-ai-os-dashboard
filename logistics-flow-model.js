/* Lambert Logistics V2.3: additive flow edges and module palettes.
 * Pure helpers; do not read/write global storage.
 */
(function(host){
 'use strict';
 const DEFAULTS=Object.freeze({'仓':'#477DBD','干':'#7962BE','关':'#C08C36','配':'#389482','头程':'#477DBD','干线':'#7962BE','关务':'#C08C36','尾程':'#389482'});
 const color=(value,fallback='#7962BE')=>typeof value==='string'&&/^#[0-9a-fA-F]{6}$/.test(value)?value.toUpperCase():fallback;
 const moduleColor=m=>color(m?.color,DEFAULTS[m?.category]||'#7962BE');
 const stageColor=(m,s)=>color(s?.color,moduleColor(m));
 const branches=m=>Array.isArray(m?.branches)?m.branches.filter(x=>x&&typeof x.from==='string'&&typeof x.to==='string'&&typeof x.id==='string'&&x.from!==x.to):[];
 const nodeIn=m=>new Set((m?.nodes||[]).map(n=>n?.id));
 const activeBranches=m=>{const ids=nodeIn(m);return branches(m).filter(e=>ids.has(e.from)&&ids.has(e.to));};
 const isBranchOnly=(m,nodeId)=>Boolean(m?.nodes?.find(n=>n.id===nodeId)?.branchOnly&&activeBranches(m).some(e=>e.to===nodeId));
 function upsertBranch(doc,moduleId,edge){
   const m=doc?.modules?.find(m=>m.id===moduleId);
   if(!m?.enabled||!edge||!edge.from||!edge.to||edge.from===edge.to)return false;
   const ids=nodeIn(m);
   if(!ids.has(edge.from)||!ids.has(edge.to))return false;
   const label=String(edge.label||'条件分支').trim().slice(0,40);
   if(!label)return false;
   const list=Array.isArray(m.branches)?m.branches:(m.branches=[]);
   if(list.some(b=>b.from===edge.from&&b.to===edge.to))return false;
   const id=String(edge.id||'');
   if(!id||list.some(b=>b.id===id))return false;
   list.push({id,from:edge.from,to:edge.to,label});
   if(edge.branchOnly===true){
     const n=m.nodes.find(n=>n.id===edge.to);
     n.branchOnly=true;
   }
   return true;
 }
 function removeBranch(doc,moduleId,id){
   const m=doc?.modules?.find(m=>m.id===moduleId);
   if(!m||!Array.isArray(m.branches))return false;
   const i=m.branches.findIndex(b=>b.id===id);
   if(i<0)return false;
   const [removed]=m.branches.splice(i,1);
   // Clear the optional presentation flag only when no active branch still
   // targets this operation. Never delete the operation or its evidence.
   if(!activeBranches(m).some(edge=>edge.to===removed.to)){
     const target=m.nodes?.find(n=>n.id===removed.to);
     if(target?.branchOnly===true)delete target.branchOnly;
   }
   return true;
 }
 function setColor(doc,moduleId,value,stageId=null){
   const m=doc?.modules?.find(x=>x.id===moduleId);
   if(!m||typeof value!=='string'||!/^#[0-9a-fA-F]{6}$/.test(value))return false;
   const target=stageId===null?m:m.stages?.find(x=>x.id===stageId);
   if(!target)return false;
   if(target.color===value.toUpperCase())return false;
   target.color=value.toUpperCase();return true;
 }
 function resetColor(doc,moduleId,stageId=null){
   const m=doc?.modules?.find(x=>x.id===moduleId),target=stageId===null?m:m?.stages?.find(x=>x.id===stageId);
   if(!target||!Object.prototype.hasOwnProperty.call(target,'color'))return false;
   delete target.color;return true;
 }
 host.LambertLogisticsFlow=Object.freeze({color,moduleColor,stageColor,branches,activeBranches,isBranchOnly,upsertBranch,removeBranch,setColor,resetColor});
})(typeof window!=='undefined'?window:globalThis);
