/* V3.4 linehaul modes and before-operation setup notes.
 * Pure, backwards-compatible helpers: never overwrite V1/V3 release records.
 */
(function(host){
 'use strict';
 const MODES=Object.freeze({road:'陆运',sea:'海运',air:'空运'});
 const PRESETS=Object.freeze({
   air:[
     ['机场管理','核实始发及目的机场、机场代码与适用关系','prerequisite'],
     ['航司管理','核实承运航司及其系统配置','prerequisite'],
     ['航线管理','核实起讫机场、航线及路径关系','prerequisite'],
     ['航班管理','核实航班、计划日期和班期','prerequisite'],
     ['板型管理','核实装载板型或板箱类型','prerequisite'],
     ['航班日志','运行记录入口；不是发货前必需条件','reference']
   ],
   road:[
     ['运输线路','核实起讫中心与陆运线路','prerequisite'],
     ['承运车队','核实承运商、车队或合作方','prerequisite'],
     ['车辆与车次','核实车辆、车次和发车计划','prerequisite']
   ],
   sea:[
     ['港口管理','核实起运港及目的港','prerequisite'],
     ['船公司','核实承运船公司','prerequisite'],
     ['海运航线','核实起讫港航线','prerequisite'],
     ['船期或航次','核实计划船期及航次','prerequisite']
   ]
 });
 const clean=x=>typeof x==='string'?x.trim():'';
 const modes=()=>Object.entries(MODES).map(([value,label])=>({value,label}));
 const infer=m=>{
   if(MODES[m?.transportMode]&&m?.category==='干')return m.transportMode;
   const n=clean(m?.name);
   if(m?.category!=='干')return '';
   if(n.includes('空运'))return 'air';
   if(n.includes('海运'))return 'sea';
   if(n.includes('陆运')||n.includes('公路'))return 'road';
   return '';
 };
 const scope=(doc,moduleId,stageId=null)=>{
   const m=doc?.modules?.find(x=>x.id===moduleId);
   if(!m)return null;
   if(stageId===null)return m;
   if(!Array.isArray(m.stages))return null;
   return m.stages.find(x=>x.id===stageId)||null;
 };
 function list(target){
   return Array.isArray(target?.prerequisites)?
     target.prerequisites.filter(x=>x&&typeof x.id==='string'&&typeof x.name==='string')
     .map(x=>({id:x.id,name:x.name,value:clean(x.value),note:clean(x.note),role:x.role==='reference'?'reference':'prerequisite'})):[];
 }
 function normalize(rows){
   if(!Array.isArray(rows)||rows.length>40)return null;
   const ids=new Set(),result=[];
   for(const row of rows){
     const id=clean(row?.id),name=clean(row?.name).slice(0,70);
     if(!id||ids.has(id)||!name)return null;
     ids.add(id);
     result.push({id,name,value:clean(row.value).slice(0,350),note:clean(row.note).slice(0,650),
       role:row.role==='reference'?'reference':'prerequisite'});
   }
   return result;
 }
 function update(doc,moduleId,stageId,rows){
   const target=scope(doc,moduleId,stageId);
   if(!target)return false;
   const prepared=normalize(rows);if(!prepared)return false;
   target.prerequisites=prepared;return true;
 }
 function setMode(doc,moduleId,mode){
   const m=scope(doc,moduleId);
   if(!m||m.category!=='干'||!MODES[mode])return false;
   if(m.transportMode===mode)return false;
   m.transportMode=mode;return true;
 }
 function preset(mode,idFactory){
   const p=PRESETS[mode]||[];
   return p.map(([name,note,role],i)=>({id:idFactory? idFactory():mode+'_prereq_'+i,name,value:'',note,role}));
 }
 function addModeModule(doc,mode,id){
   if(!doc?.modules||!MODES[mode]||typeof id!=='string'||!id||doc.modules.some(m=>m.id===id))return false;
   doc.modules.push({id,name:MODES[mode]+'干线',category:'干',transportMode:mode,
      enabled:true,stages:[{id:'general',name:'操作流程',collapsed:false}],
      nodes:[],prerequisites:preset(mode)});
   return true;
 }
 host.LambertLogisticsSetupV34=Object.freeze({MODES,PRESETS,modes,infer,list,scope,normalize,update,setMode,preset,addModeModule});
})(typeof window!=='undefined'?window:globalThis);
