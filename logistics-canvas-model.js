/* P0 logistics canvas: pure immutable-friendly list mutations; no storage writes. */
(function (host) {
  'use strict';
  function reorder(list,from,to){
    if(!Array.isArray(list)||!Number.isInteger(from)||!Number.isInteger(to)||from<0||from>=list.length||to<0||to>=list.length||from===to)return false;
    const [item]=list.splice(from,1);
    list.splice(to,0,item);
    return true;
  }
  function moveModule(document,sourceId,targetId,after=false){
    const list=document?.modules;
    if(!Array.isArray(list)||sourceId===targetId)return false;
    const from=list.findIndex(item=>item.id===sourceId),onto=list.findIndex(item=>item.id===targetId);
    if(from<0||onto<0)return false;
    const [item]=list.splice(from,1);
    const at=list.findIndex(m=>m.id===targetId);
    list.splice(at+(after?1:0),0,item);
    return true;
  }
  function reorderNode(document,moduleId,nodeId,step){
    const m=document?.modules?.find(m=>m.id===moduleId);
    if(!m||!Array.isArray(m.nodes))return false;
    const from=m.nodes.findIndex(n=>n.id===nodeId);
    return reorder(m.nodes,from,from+step);
  }
  function moveNode(document,fromId,nodeId,toId,beforeId=null){
    const modules=document?.modules;
    if(!Array.isArray(modules))return false;
    const source=modules.find(m=>m.id===fromId),target=modules.find(m=>m.id===toId);
    if(!source||!target||!target.enabled||!Array.isArray(source.nodes)||!Array.isArray(target.nodes))return false;
    const from=source.nodes.findIndex(n=>n.id===nodeId);
    if(from<0)return false;
    if(beforeId===nodeId&&fromId===toId)return false;
    if(beforeId!==null&&!target.nodes.some(n=>n.id===beforeId))return false;
    if(fromId!==toId&&target.nodes.some(n=>n.id===nodeId))return false; // never silently duplicate IDs
    const [item]=source.nodes.splice(from,1);
    let index=beforeId===null?target.nodes.length:target.nodes.findIndex(n=>n.id===beforeId);
    if(index<0){source.nodes.splice(from,0,item);return false;}
    target.nodes.splice(index,0,item);
    return true;
  }
  host.LambertLogisticsMoves=Object.freeze({reorder,moveModule,reorderNode,moveNode});
})(typeof window!=='undefined'?window:globalThis);
