/* V3.3 - independent trigger records with no inferred EDI mappings.
 * All functions are pure; old node fields are deliberately left intact.
 */
(function(root){
 'use strict';
 const clean=s=>typeof s==='string'?s.trim():'';
 function triggers(n){
   if(!Array.isArray(n?.triggers))return [];
   return n.triggers.filter(t=>t&&typeof t.id==='string'&&typeof t.description==='string')
     .map(t=>({id:t.id,description:t.description}));
 }
 function normalize(rows){
   if(!Array.isArray(rows))return null;
   if(rows.length>25)return null;
   const result=[],seen=new Set();
   for(const item of rows){
     const id=clean(item?.id),description=clean(item?.description).slice(0,500);
     if(!id||seen.has(id)||!description)return null;
     result.push({id,description});seen.add(id);
   }
   return result;
 }
 function updateNode(doc,moduleId,nodeId,fields,rows){
   const m=doc?.modules?.find(x=>x.id===moduleId),n=m?.nodes?.find(x=>x.id===nodeId);
   if(!n)return false;
   const prepared=normalize(rows);
   if(!prepared)return false;
   const title=clean(fields?.title).slice(0,70);
   if(!title)return false;
   n.title=title;
   n.action=clean(fields.action).slice(0,1500);
   n.note=clean(fields.note).slice(0,2500);
   if(Array.isArray(fields.tags))n.tags=[...fields.tags];
   if(fields.color===null)delete n.color;
   else if(/^#[0-9A-F]{6}$/i.test(fields.color||''))n.color=fields.color.toUpperCase();
   n.triggers=prepared;
   // Preserve original kind, information, data, confidence, evidence, legacy
   // operationCodes, branchOnly, eventRefs and all graph IDs unchanged.
   return true;
 }
 function addNode(doc,moduleId,stageId,id,fields,rows){
   const m=doc?.modules?.find(x=>x.id===moduleId);
   const validStage=Array.isArray(m?.stages)&&m.stages.length
     ?m.stages.some(s=>s.id===stageId)
     :stageId==='general';
   if(!m?.enabled||typeof id!=='string'||!id||!validStage||m.nodes.some(n=>n.id===id))return false;
   const prepared=normalize(rows);
   if(!prepared?.length)return false;
   const title=clean(fields?.title).slice(0,70);
   if(!title)return false;
   const n={id,title,kind:'业务操作',action:clean(fields.action).slice(0,1500),
      note:clean(fields.note).slice(0,2500),tags:Array.isArray(fields.tags)?[...fields.tags]:[],
      triggers:prepared,eventRefs:[],stageId:stageId||'',information:'',data:'',evidence:'',confidence:'待核实'};
   if(/^#[0-9A-F]{6}$/i.test(fields.color||''))n.color=fields.color.toUpperCase();
   m.nodes.push(n);return true;
 }
 root.LambertLogisticsTriggerV33=Object.freeze({triggers,normalize,updateNode,addNode});
})(typeof window!=='undefined'?window:globalThis);
