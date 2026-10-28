/* Lambert Logistics: optional sub-stage operations, compatible with schema:1. */
(function(host){
  'use strict';
  const LEGACY='general';
  const stages=module=>Array.isArray(module?.stages)&&module.stages.length
    ?module.stages:[{id:LEGACY,name:'操作流程',collapsed:false,virtual:true}];
  const stageFor=(module,operation)=>{
    const all=stages(module),id=operation?.stageId;
    return all.some(s=>s.id===id)?id:all[0]?.id||LEGACY;
  };
  const unique=(list,id)=>!list.some(s=>s.id===id);
  function moveStage(document,moduleId,fromId,toId,after=false){
    const m=document?.modules?.find(x=>x.id===moduleId);
    if(!m||!Array.isArray(m.stages)||fromId===toId)return false;
    const from=m.stages.findIndex(x=>x.id===fromId),to=m.stages.findIndex(x=>x.id===toId);
    if(from<0||to<0||(after&&from===to+1)||(!after&&from===to-1))return false;
    const [s]=m.stages.splice(from,1);
    const at=m.stages.findIndex(x=>x.id===toId);
    m.stages.splice(at+(after?1:0),0,s);
    return true;
  }
  function reorderStage(document,moduleId,stageId,step){
    const m=document?.modules?.find(x=>x.id===moduleId);
    if(!m||!Array.isArray(m.stages))return false;
    const at=m.stages.findIndex(x=>x.id===stageId),dest=at+step;
    if(at<0||dest<0||dest>=m.stages.length)return false;
    const [s]=m.stages.splice(at,1);m.stages.splice(dest,0,s);return true;
  }
  function addStage(document,moduleId,stage){
    const m=document?.modules?.find(x=>x.id===moduleId);
    if(!m||!m.enabled||!stage||typeof stage.id!=='string'||!stage.id||!stage.name?.trim())return false;
    if(!Array.isArray(m.stages)||!m.stages.length){
      m.stages=[{id:LEGACY,name:'原有操作',collapsed:false}];
      // Existing node.stageId are left untouched: they map to the initial stage.
    }
    if(!unique(m.stages,stage.id))return false;
    m.stages.push({id:stage.id,name:stage.name.trim(),collapsed:false});
    return true;
  }
  function moveToStage(document,fromId,nodeId,toId,toStageId,beforeId=null,moves){
    const source=document?.modules?.find(m=>m.id===fromId);
    const target=document?.modules?.find(m=>m.id===toId);
    if(!source?.enabled||!target?.enabled||!moves?.moveNode)return false;
    const sourceNode=source.nodes?.find(n=>n.id===nodeId);
    if(!sourceNode||!stages(target).some(x=>x.id===toStageId))return false;
    const before=beforeId===null?null:target.nodes?.find(n=>n.id===beforeId);
    if(beforeId!==null&&(!before||stageFor(target,before)!==toStageId))return false;
    if(fromId===toId&&beforeId===nodeId)return false;
    const oldStage=stageFor(source,sourceNode);
    const stageChanged=fromId!==toId||oldStage!==toStageId;
    const moved=moves.moveNode(document,fromId,nodeId,toId,beforeId);
    if(fromId!==toId&&!moved)return false;
    if(!moved&&!stageChanged)return false;
    // Same-module stage change can be valid when the operation is already
    // last in the flattened array. This is a stage edit, not a reorder.
    const updated=target.nodes.find(n=>n.id===nodeId);
    if(!updated)return false;
    updated.stageId=toStageId===LEGACY?'':toStageId;
    return true;
  }
  function reorderWithinStage(document,moduleId,nodeId,step,moves){
    const m=document?.modules?.find(x=>x.id===moduleId);
    if(!m?.enabled||!moves?.moveNode)return false;
    const item=m.nodes?.find(n=>n.id===nodeId);
    if(!item)return false;
    const group=stageFor(m,item),members=m.nodes.filter(n=>stageFor(m,n)===group);
    const index=members.findIndex(n=>n.id===nodeId),to=index+step;
    if(index<0||to<0||to>=members.length||![-1,1].includes(step))return false;
    const before=step<0?members[to].id:members[index+2]?.id||null;
    return moves.moveNode(document,moduleId,nodeId,moduleId,before);
  }
  host.LambertLogisticsStages=Object.freeze({LEGACY,stages,stageFor,moveStage,reorderStage,addStage,moveToStage,reorderWithinStage});
})(typeof window!=='undefined'?window:globalThis);
