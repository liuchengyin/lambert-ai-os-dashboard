/* Lambert Logistics V3 — atomically saved release, draft and rollback history.
 * Does not mutate the V1 storage key. Owner-scoped storage is injected.
 */
(function(host){
 'use strict';
 const KEY='lambert_logistics_versions_v1';
 const clone=x=>JSON.parse(JSON.stringify(x));
 const validData=x=>Boolean(x&&x.schema===1&&Array.isArray(x.modules)&&x.modules.every(m=>m&&typeof m.id==='string'&&typeof m.name==='string'&&typeof m.enabled==='boolean'&&Array.isArray(m.nodes)));
 const validRelease=x=>Boolean(x&&Number.isSafeInteger(x.number)&&x.number>=0&&validData(x.data));
 function load(store,legacy){
   if(!validData(legacy))return {error:'原物流知识数据无效，已禁止编辑'};
   let raw;try{raw=store.getItem(KEY);}catch{return {error:'版本记录读取失败，已禁止编辑'};}
   if(raw===null)return {record:{schema:1,published:{number:0,time:'',data:clone(legacy)},draft:null,history:[]},persisted:false};
   try{
     const record=JSON.parse(raw);
     if(record?.schema!==1||!validRelease(record.published)||!Array.isArray(record.history)||record.history.some(v=>!validRelease(v))||record.draft!==null&&(!record.draft||!validData(record.draft.data)))throw Error('invalid');
     return {record,persisted:true};
   }catch{return {error:'已有版本记录无法读取，已锁定以防覆盖。请先检查原始数据'};}
 }
 function save(store,record){
   if(record?.schema!==1||!validRelease(record.published)||!Array.isArray(record.history))return false;
   try{store.setItem(KEY,JSON.stringify(record));return true;}catch{return false;}
 }
 function saveDraft(store,record,data){
   if(!validData(data))return null;
   const next=clone(record);
   next.draft={data:clone(data),time:new Date().toISOString()};
   return save(store,next)?next:null;
 }
 function publish(store,record){
   if(!record.draft||!validData(record.draft.data))return null;
   const next=clone(record);
   next.history.push(clone(next.published));
   next.published={number:next.published.number+1,time:new Date().toISOString(),data:clone(next.draft.data)};
   next.draft=null;
   return save(store,next)?next:null;
 }
 function rollback(store,record,historyIndex){
   if(!Number.isInteger(historyIndex)||historyIndex<0||historyIndex>=record.history.length)return null;
   const old=record.history[historyIndex];
   if(!validRelease(old))return null;
   const next=clone(record);
   next.history.push(clone(next.published));
   next.published={number:next.published.number+1,time:new Date().toISOString(),data:clone(old.data),restoredFrom:old.number};
   next.draft=null;
   return save(store,next)?next:null;
 }
 host.LambertLogisticsVersion=Object.freeze({KEY,clone,validData,load,saveDraft,publish,rollback});
})(typeof window!=='undefined'?window:globalThis);
