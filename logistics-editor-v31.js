/* Logistics V3.1 business editor: reversible removal, searchable labels and event-code placeholders. */
(function(host){
 'use strict';
 const clone=x=>JSON.parse(JSON.stringify(x));
 const text=s=>typeof s==='string'?s.trim():'';
 const name=s=>text(s).slice(0,70);
 const validId=x=>typeof x==='string'&&x.length>0;
 const labels=value=>[...new Set((Array.isArray(value)?value:typeof value==='string'?value.split(/[,，\n#]+/):[]).map(text).filter(Boolean).map(s=>s.slice(0,36)))].slice(0,15);
 const codes=value=>[...new Set((Array.isArray(value)?value:typeof value==='string'?value.split(/[,，\n\s]+/):[]).map(text).filter(Boolean).map(s=>s.slice(0,60)))].slice(0,20);
 const tags=(d,query)=>{const q=text(query).toLocaleLowerCase();const rows=[];
   (d?.modules||[]).forEach(m=>(m.nodes||[]).forEach(n=>{
     const keys=[m.name,n.title,n.note||'',...(n.tags||[]),...(n.operationCodes||[])];
     if(!q||keys.some(x=>String(x).toLocaleLowerCase().includes(q)))rows.push({moduleId:m.id,nodeId:n.id,title:n.title,tags:n.tags||[],module:m.name});
   }));return rows;
 };
 const getModule=(d,id)=>d?.modules?.find(m=>m.id===id);
 function remove(d,type,moduleId,itemId,trashId){
   if(!d||!['module','stage','node'].includes(type)||!validId(trashId))return false;
   d.trash=Array.isArray(d.trash)?d.trash:[];
   if(d.trash.some(t=>t.id===trashId))return false;
   const mod=getModule(d,moduleId),mi=d.modules.findIndex(m=>m.id===moduleId);
   if(!mod)return false;
   const entry={id:trashId,type,moduleId,time:new Date().toISOString(),index:-1};
   if(type==='module'){
     entry.index=mi;entry.item=clone(mod);d.modules.splice(mi,1);
   }else if(type==='stage'){
     if(!Array.isArray(mod.stages))return false;
     const index=mod.stages.findIndex(s=>s.id===itemId);
     if(index<0)return false;
     entry.index=index;entry.item=clone(mod.stages[index]);
     entry.nodes=mod.nodes.map((n,i)=>({...clone(n),_trashIndex:i})).filter(n=>(n.stageId||'general')===itemId);
     const ids=new Set(entry.nodes.map(n=>n.id));
     entry.branches=(mod.branches||[]).filter(e=>ids.has(e.from)||ids.has(e.to)).map(clone);
     mod.stages.splice(index,1);mod.nodes=mod.nodes.filter(n=>!ids.has(n.id));
     mod.branches=(mod.branches||[]).filter(e=>!ids.has(e.from)&&!ids.has(e.to));
   }else{
     const index=mod.nodes.findIndex(n=>n.id===itemId);if(index<0)return false;
     entry.index=index;entry.item=clone(mod.nodes[index]);
     entry.branches=(mod.branches||[]).filter(e=>e.from===itemId||e.to===itemId).map(clone);
     mod.nodes.splice(index,1);
     mod.branches=(mod.branches||[]).filter(e=>e.from!==itemId&&e.to!==itemId);
   }
   d.trash.push(entry);return true;
 }
 function restore(d,trashId){
   const i=d?.trash?.findIndex(t=>t.id===trashId);if(i===undefined||i<0)return false;
   const t=d.trash[i];
   if(!t||!t.item)return false;
   const mod=getModule(d,t.moduleId);
   if(t.type==='module'){
     if(mod)return false;
     d.modules.splice(Math.min(t.index,d.modules.length),0,clone(t.item));
   }else if(t.type==='stage'){
     if(!mod||!Array.isArray(mod.stages)||mod.stages.some(s=>s.id===t.item.id))return false;
     if((t.nodes||[]).some(n=>mod.nodes.some(x=>x.id===n.id)))return false;
     mod.stages.splice(Math.min(t.index,mod.stages.length),0,clone(t.item));
     (t.nodes||[]).forEach(n=>{const at=n._trashIndex;const item=clone(n);delete item._trashIndex;mod.nodes.splice(Math.min(at,mod.nodes.length),0,item);});
     const ids=new Set(mod.nodes.map(n=>n.id)),edges=new Set((mod.branches||[]).map(e=>e.id));
     for(const e of t.branches||[])if(ids.has(e.from)&&ids.has(e.to)&&!edges.has(e.id)){mod.branches=mod.branches||[];mod.branches.push(clone(e));edges.add(e.id);}
   }else if(t.type==='node'){
     if(!mod||mod.nodes.some(n=>n.id===t.item.id))return false;
     if(Array.isArray(mod.stages)&&mod.stages.length&&t.item.stageId&&!mod.stages.some(s=>s.id===t.item.stageId))return false;
     mod.nodes.splice(Math.min(t.index,mod.nodes.length),0,clone(t.item));
     const ids=new Set(mod.nodes.map(n=>n.id)),edges=new Set((mod.branches||[]).map(e=>e.id));
     for(const e of t.branches||[])if(ids.has(e.from)&&ids.has(e.to)&&!edges.has(e.id)){mod.branches=mod.branches||[];mod.branches.push(clone(e));edges.add(e.id);}
   }else return false;
   d.trash.splice(i,1);return true;
 }
 function impact(d,type,moduleId,itemId,stageFor){
   const mod=getModule(d,moduleId);if(!mod)return null;
   const nodes=type==='module'?mod.nodes:type==='stage'?mod.nodes.filter(n=>stageFor(mod,n)===itemId):mod.nodes.filter(n=>n.id===itemId);
   const ids=new Set(nodes.map(n=>n.id));
   return {nodes:nodes.length,edges:(mod.branches||[]).filter(e=>ids.has(e.from)||ids.has(e.to)).length,title:type==='module'?mod.name:type==='stage'?mod.stages?.find(s=>s.id===itemId)?.name:nodes[0]?.title};
 }
 host.LambertLogisticsEditor=Object.freeze({clone,labels,codes,tags,name,remove,restore,impact});
})(typeof window!=='undefined'?window:globalThis);
