/* V3.5 - presentation-only transport grouping and compact business branch tree.
 * Information exchanges are independent annotations; they are NOT flow edges.
 */
(function(root){
 'use strict';
 const LABELS=Object.freeze({road:'陆运',air:'空运',sea:'海运'});
 const ORDER=Object.freeze(['road','air','sea']);
 const MAX_DEPTH=7;
 const trunkModules=(modules)=>ORDER.map(mode=>({
   mode,label:LABELS[mode],
   modules:(modules||[]).filter(m=>m.category==='干'&&
     (m.transportMode===mode||(!m.transportMode&&
       (mode==='road'?/陆运|公路/.test(m.name):mode==='sea'?/海运/.test(m.name):/空运/.test(m.name)))))
 }));
 const edges=(module,from)=>{
   const ids=new Set(module?.nodes?.map(n=>n.id)||[]),seen=new Set();
   return (module?.branches||[]).filter(e=>{
      if(!e||e.from!==from||!ids.has(e.to)||!['branch','exception',undefined].includes(e.type))return false;
      const key=e.from+'\u0000'+e.to;
      if(seen.has(key))return false;
      seen.add(key);return true;
     }).map(e=>({...e,type:e.type==='branch'?'branch':e.type==='exception'?'exception':/异常|失败|错误/.test(e.label)?'exception':'branch'}));
 };
 const tree=(module,start,seen=new Set(),depth=0)=>{
   if(depth>=MAX_DEPTH)return [];
   const path=new Set(seen);path.add(start);
   return edges(module,start).map(edge=>{
     const target=module.nodes.find(n=>n.id===edge.to);
     const circular=path.has(edge.to);
     const truncated=!circular&&depth+1>=MAX_DEPTH&&edges(module,edge.to).length>0;
     return {edge,target,circular,truncated,children:circular||truncated?[]:tree(module,edge.to,path,depth+1)};
   });
 };
 function addExchange(doc,moduleId,nodeId,entry){
   const m=doc?.modules?.find(m=>m.id===moduleId),n=m?.nodes?.find(n=>n.id===nodeId);
   if(!n||!entry||typeof entry.id!=='string'||!entry.id)return false;
   const source=String(entry.source||'').trim().slice(0,90);
   const target=String(entry.target||'').trim().slice(0,90);
   const message=String(entry.message||'').trim().slice(0,300);
   if(!source||!target||!message)return false;
   // Do not replace unexpected legacy data. An explicit malformed value is
   // preserved so the user can recover/export it rather than lose information.
   if(n.exchanges!==undefined&&!Array.isArray(n.exchanges))return false;
   const items=Array.isArray(n.exchanges)?n.exchanges:[];
   if(items.some(x=>x?.id===entry.id)||items.length>=25)return false;
   const clean={id:entry.id,source,target,message,note:String(entry.note||'').trim().slice(0,500)};
   if(!Array.isArray(n.exchanges))n.exchanges=items;
   items.push(clean);
   return true;
 }
 function removeExchange(doc,moduleId,nodeId,exchangeId){
   const n=doc?.modules?.find(m=>m.id===moduleId)?.nodes?.find(n=>n.id===nodeId);
   if(!Array.isArray(n?.exchanges))return false;
   const i=n.exchanges.findIndex(x=>x.id===exchangeId);
   if(i<0)return false;
   n.exchanges.splice(i,1);return true;
 }
 root.LambertLogisticsV35=Object.freeze({LABELS,ORDER,trunkModules,edges,tree,addExchange,removeExchange});
})(typeof window!=='undefined'?window:globalThis);
