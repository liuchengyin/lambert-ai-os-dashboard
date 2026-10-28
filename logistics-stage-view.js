/* Presentation-only stage grouping. Reuses existing operation cards and IDs. */
(function(host){
  'use strict';
  const helper=host.LambertLogisticsStages;
  if(!helper)return;
  const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
  const btn=(name,action,moduleId,stageId,disabled=false)=>{
    const e=el('button','lk-stage-control',name);e.type='button';
    e.dataset.action=action;e.dataset.module=moduleId;e.dataset.stage=stageId;e.disabled=disabled;return e;
  };
  function renderStageLane(hostEl,state,blocked){
    for(const module of state.modules){
      const block=[...hostEl.querySelectorAll('.lk-canvas-block')].find(b=>b.dataset.module===module.id);
      if(!block)continue;
      const main=block.querySelector('.lk-module-main');
      // The top-level stable category is warehouse / linehaul / customs / delivery;
      // instances such as 国内中心仓 are reusable modules within that type.
      if(main)main.title=(module.category||'业务')+' / '+module.name;
      const lane=block.querySelector('.lk-canvas-lane');if(!lane)continue;
      const steps=[...lane.querySelectorAll('.lk-step')];
      const byId=new Map(steps.map(x=>[x.dataset.dragNode,x]));
      const stages=helper.stages(module);
      lane.replaceChildren();
      lane.classList.add('lk-stage-board');
      stages.forEach((stage,i)=>{
        const card=el('section','lk-substage');card.dataset.stageId=stage.id;card.dataset.module=module.id;
        const head=el('header','lk-substage-head');
        head.draggable=!blocked&&!stage.virtual;
        head.dataset.dragStage=stage.id;head.dataset.module=module.id;
        head.title='拖动子环节标题区调整顺序';
        const grip=btn('⠿','noop',module.id,stage.id,blocked||!!stage.virtual);
        grip.classList.add('lk-stage-grip');grip.draggable=false;
        grip.title='按住此标题区并拖动子环节';
        const name=btn(stage.name,'select-stage',module.id,stage.id);
        name.classList.add('lk-stage-title');name.title='选择'+stage.name+'环节';
        const actions=el('div','lk-stage-actions');
        actions.append(
          btn('←','stage-left',module.id,stage.id,blocked||!!stage.virtual||i===0),
          btn('→','stage-right',module.id,stage.id,blocked||!!stage.virtual||i===stages.length-1),
          btn(stage.collapsed?'展开':'收起','stage-collapse',module.id,stage.id,blocked||!!stage.virtual),
          btn('改名','stage-rename',module.id,stage.id,blocked||!!stage.virtual),
          btn('＋ 操作','stage-add-node',module.id,stage.id,blocked||!module.enabled)
        );
        head.append(grip,name,actions);card.append(head);
        const ops=el('div','lk-substage-body');
        ops.dataset.dropModule=module.id;ops.dataset.dropStage=stage.id;
        const matching=module.nodes.filter(n=>helper.stageFor(module,n)===stage.id);
        if(!stage.collapsed){
          matching.forEach(op=>{
            const step=byId.get(op.id);if(!step)return;
            step.dataset.stageId=stage.id;
            const button=step.querySelector('button[data-action="select-node"]');
            if(button)button.dataset.stage=stage.id;
            const arrows=step.querySelectorAll('button[data-action="node-left"],button[data-action="node-right"]');
            arrows.forEach(arrow=>{
              const j=matching.findIndex(x=>x.id===op.id);
              arrow.disabled=blocked||(arrow.dataset.action==='node-left'?j===0:j===matching.length-1);
            });
            ops.append(step);
          });
          const drop=el('div','lk-drop-end','拖动操作到这里');
          drop.dataset.dropModule=module.id;drop.dataset.dropStage=stage.id;ops.append(drop);
        }else{
          ops.append(el('p','lk-substage-folded',matching.length+' 个操作已折叠'));
        }
        card.append(ops);lane.append(card);
      });
      const add=el('button','lk-substage-create','＋ 添加子环节');
      add.type='button';add.dataset.action='stage-add';add.dataset.module=module.id;add.disabled=blocked||!module.enabled;
      lane.append(add);
    }
  }
  host.LambertLogisticsStageView=Object.freeze({renderStageLane});
})(typeof window!=='undefined'?window:globalThis);
