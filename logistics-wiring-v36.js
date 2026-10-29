/* V3.6 user-filled information/data infrastructure; no live data integration. */
(function(root){
 'use strict';
 const SECTIONS=Object.freeze(['trace','routing','sources','metric','task']);
 const POLICIES=Object.freeze(['unknown','internal','conditional','external']);
 const KINDS=Object.freeze(['OMS','EDI','TMS','轨迹','其他']);
 const limits={
  trace:{event:180,eventCode:100,logLocation:220,recordTable:180,recordKey:180},
  routing:{rule:500,destination:220},
  metric:{name:180,formula:500,timeField:180,slaTarget:180,dashboard:180},
  task:{board:180,condition:500,owner:180,action:360}
 };
 const isRecord=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
 const clean=(s,max)=>typeof s==='string'&&s.length<=max?s.trim():null;
 const raw=node=>isRecord(node?.infrastructure)?node.infrastructure:null;
 function read(node){
  const r=raw(node);
  if(node?.infrastructure!==undefined&&!r)return {invalid:true};
  if(r&&SECTIONS.some(k=>k!=='sources'&&r[k]!==undefined&&!isRecord(r[k])))return {invalid:true};
  if(r){
   for(const [section,fields] of Object.entries(limits)){
    if(!r[section])continue;
    for(const [key,max] of Object.entries(fields)){
     const val=r[section][key];
     if(val!==undefined&&(typeof val!=='string'||val.length>max))return {invalid:true};
    }
   }
   if(r.routing?.policy!==undefined&&!POLICIES.includes(r.routing.policy))return {invalid:true};
   if(r.sources!==undefined){
    if(!Array.isArray(r.sources))return {invalid:true};
    const ids=new Set();
    for(const source of r.sources){
     if(!isRecord(source)||typeof source.id!=='string'||!source.id.trim()||
       source.id.length>90||ids.has(source.id)||!KINDS.includes(source.kind)||
       typeof source.table!=='string'||!source.table.trim()||source.table.length>180||
       source.joinKey!==undefined&&(typeof source.joinKey!=='string'||source.joinKey.length>180)||
       source.fields!==undefined&&(typeof source.fields!=='string'||source.fields.length>500))return {invalid:true};
     ids.add(source.id);
    }
   }
  }
  return {invalid:false,trace:r?.trace||{},routing:r?.routing||{},sources:r?.sources||[],metric:r?.metric||{},task:r?.task||{}};
 }
 const filled=section=>Object.values(section||{}).some(v=>typeof v==='string'&&v.trim());
 function progress(node){
  const r=read(node);
  if(r.invalid)return {count:0,total:5,invalid:true};
  const count=Number(filled(r.trace))+Number(Boolean(r.routing.rule||r.routing.destination||(r.routing.policy&&r.routing.policy!=='unknown')))+
    Number(r.sources.length>0)+Number(filled(r.metric))+Number(filled(r.task));
  return {count,total:5,invalid:false};
 }
 function normalize(source,fields){
  if(!isRecord(source))return null;
  const result={};
  for(const [field,max] of Object.entries(fields)){
   const v=clean(source[field]??'',max);
   if(v===null)return null;
   result[field]=v;
  }
  return result;
 }
 function update(doc,moduleId,nodeId,input){
  const node=doc?.modules?.find(m=>m.id===moduleId)?.nodes?.find(n=>n.id===nodeId);
  if(!node||!isRecord(input))return false;
  const old=read(node);if(old.invalid)return false;
  const trace=normalize(input.trace,limits.trace);
  const routing=normalize(input.routing,limits.routing);
  const metric=normalize(input.metric,limits.metric);
  const task=normalize(input.task,limits.task);
  if(!trace||!routing||!metric||!task)return false;
  const policy=input.routing.policy||'unknown';
  if(!POLICIES.includes(policy)||!Array.isArray(input.sources)||input.sources.length>12)return false;
  if(old.sources.some(x=>!isRecord(x)||typeof x.id!=='string'))return false;
  const ids=new Set(),sources=[];
  for(const source of input.sources){
   if(!isRecord(source))return false;
   const id=clean(source.id,90),table=clean(source.table??'',180),
    joinKey=clean(source.joinKey??'',180),fields=clean(source.fields??'',500);
   if(!id||ids.has(id)||!KINDS.includes(source.kind)||!table||joinKey===null||fields===null)return false;
   ids.add(id);
   const previous=old.sources.find(x=>x.id===id);
   sources.push({...isRecord(previous)?previous:{},id,kind:source.kind,table,joinKey,fields});
  }
  const before=raw(node)||{};
  const next={...before,
    trace:{...before.trace,...trace},
    routing:{...before.routing,...routing,policy},
    sources,metric:{...before.metric,...metric},task:{...before.task,...task}};
  if(JSON.stringify(next)===JSON.stringify(before))return false;
  node.infrastructure=next;
  return true;
 }
 root.LambertLogisticsWiringV36=Object.freeze({SECTIONS,POLICIES,KINDS,read,progress,update});
})(typeof window!=='undefined'?window:globalThis);
