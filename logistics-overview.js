/* Read-only logistics release overview. Macro / full-route modes share one snapshot. */
(function(host){
 'use strict';
 const stages=host.LambertLogisticsStages,flow=host.LambertLogisticsFlow;
 const el=(tag,cls,txt)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(txt!==undefined)e.textContent=txt;return e;};
 function button(label,m,n,open){
   const b=el('button','lk-ov-link',label);b.type='button';b.title='查看模块操作详情';
   b.addEventListener('click',()=>open(m?.id,n?.id||null));return b;
 }
 function render(container,release,mode,open){
   const data=release?.data;
   container.replaceChildren();
   if(!data?.modules){container.append(el('p','lk-empty','没有可展示的已发布物流线路'));return;}
   const modules=data.modules.filter(m=>m.enabled!==false);
   const head=el('div','lk-ov-intro');
   head.append(el('strong','',data.route||'物流业务链路'),el('p','',mode==='macro'?'宏观：按模块展示完整线路，点击可定位详情。':'完整：展开每个模块的业务子环节、操作顺序及条件分支。'));
   container.append(head);
   const line=el('div','lk-overview-chain '+(mode==='detail'?'lk-ov-detail-mode':'lk-ov-macro-mode'));
   if(!modules.length){container.append(el('p','lk-empty','当前已发布线路没有启用模块'));return;}
   modules.forEach((m,index)=>{
     const section=el('section','lk-ov-module');
     section.style.setProperty('--lk-ov-color',flow.moduleColor(m));
     const title=el('header','lk-ov-module-head');
     title.append(el('span','lk-ov-category',m.category||'业务'),button(m.name,m,null,open));
     title.append(el('small','',m.nodes.length+' 个操作'));
     section.append(title);
     const groups=stages.stages(m);
     if(mode==='macro'){
       section.append(el('p','lk-ov-summary',groups.map(s=>s.name).join(' → ')));
     }else{
       const lanes=el('div','lk-ov-substages');
       const edges=flow.activeBranches(m);
       groups.forEach((stage,si)=>{
         const group=el('section','lk-ov-stage');group.style.setProperty('--lk-ov-stage-color',flow.stageColor(m,stage));
         group.append(el('h4','',stage.name));
         const ops=el('div','lk-ov-ops');
         const members=m.nodes.filter(n=>stages.stageFor(m,n)===stage.id);
         const main=members.filter(n=>!flow.isBranchOnly(m,n.id));
         main.forEach((n,ni)=>{
           const entry=el('div','lk-ov-op');
           entry.append(button(n.title,m,n,open));
           edges.filter(e=>e.from===n.id).forEach(e=>{
             const target=m.nodes.find(t=>t.id===e.to);
             if(!target)return;
             const exception=(e.type==='exception'||!e.type&&/异常|报错|失败/.test(e.label));
             const b=el('div','lk-ov-edge '+(exception?'lk-ov-exception':'lk-ov-branch'));
             b.append(el('span','',exception?'异常 ↳ ':'分支 ↳ '),el('span','lk-ov-edge-label',e.label),el('span','',' → '),button(target.title,m,target,open));
             entry.append(b);
           });
           ops.append(entry);
           if(ni<main.length-1)ops.append(el('span','lk-ov-step-arrow','→'));
         });
         if(!main.length)ops.append(el('span','lk-ov-noops','暂无主流程操作'));
         group.append(ops);lanes.append(group);
         if(si<groups.length-1)lanes.append(el('span','lk-ov-stage-arrow','→'));
       });
       section.append(lanes);
     }
     line.append(section);
     if(index<modules.length-1)line.append(el('div','lk-ov-module-arrow','↓'));
   });
   container.append(line);
   container.append(el('p','lk-ov-disclaimer','仅展示已发布版本；模块编辑与草稿变更不会立即影响本页。流程数据需与真实业务 SOP 核实。'));
 }
 host.LambertLogisticsOverview=Object.freeze({render});
})(typeof window!=='undefined'?window:globalThis);
