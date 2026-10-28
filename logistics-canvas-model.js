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
    // Dropping next to the block where it already sits is a no-op.
    if(after&&from===onto+1||!after&&from===onto-1)return false;
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
    if(!source||!target||!source.enabled||!target.enabled||!Array.isArray(source.nodes)||!Array.isArray(target.nodes))return false;
    const from=source.nodes.findIndex(n=>n.id===nodeId);
    if(from<0)return false;
    if(beforeId===nodeId&&fromId===toId)return false;
    const targetIndex=beforeId===null?target.nodes.length:target.nodes.findIndex(n=>n.id===beforeId);
    if(targetIndex<0)return false;
    if(fromId!==toId&&target.nodes.some(n=>n.id===nodeId))return false; // never silently duplicate IDs
    // Moving an endpoint while leaving its edges in the source module makes
    // those branches disappear from the canvas. Reject instead of orphaning.
    if(fromId!==toId&&Array.isArray(source.branches)&&source.branches.some(e=>
      e&&(e.from===nodeId||e.to===nodeId)))return false;
    // Prevent an old unresolved target edge from suddenly becoming active
    // when the same node ID arrives from another module.
    if(fromId!==toId&&Array.isArray(target.branches)&&target.branches.some(e=>
      e&&(e.from===nodeId||e.to===nodeId)))return false;
    // Find final position before touching either array, so a rejected move
    // does not remove records or silently save an unchanged layout.
    const index=fromId===toId&&from<targetIndex?targetIndex-1:targetIndex;
    if(fromId===toId&&index===from)return false;
    const [item]=source.nodes.splice(from,1);
    target.nodes.splice(index,0,item);
    return true;
  }
  host.LambertLogisticsMoves=Object.freeze({reorder,moveModule,reorderNode,moveNode});
})(typeof window!=='undefined'?window:globalThis);
