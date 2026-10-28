/* Lambert Logistics V2.3: flow arrows, optional condition branches, nested lanes.
 * The underlying operation objects remain untouched by rendering.
 */
(function(host){
  'use strict';
  const stagesAPI=host.LambertLogisticsStages,flow=host.LambertLogisticsFlow,setup=host.LambertLogisticsSetupV34;
  if(!stagesAPI||!flow)return;
  const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
  const btn=(label,action,moduleId,stageId,disabled=false)=>{
    const n=el('button','lk-stage-control',label);n.type='button';
    n.dataset.action=action;n.dataset.module=moduleId;n.dataset.stage=stageId;n.disabled=disabled;return n;
  };
  const arrow=label=>{
    const a=el('span','lk-flow-arrow','→');a.setAttribute('aria-label',label||'下一操作');a.title=label||'操作顺序';return a;
  };
  function picker(m,stage,blocked){
    const label=el('label','lk-stage-color');
    label.title='更换「'+stage.name+'」的颜色';
    const txt=el('span','','颜色');
    const input=document.createElement('input');input.type='color';input.value=flow.stageColor(m,stage);
    input.dataset.colorModule=m.id;input.dataset.colorStage=stage.id;
    input.disabled=blocked||stage.virtual;
    input.setAttribute('aria-label','设置'+stage.name+'子环节颜色');
    const reset=btn('默认色','color-reset-stage',m.id,stage.id,blocked||stage.virtual||!stage.color);
    label.append(txt,input);return {label,reset};
  }
  function renderStageLane(hostEl,state,blocked){
    for(const module of state.modules){
      const block=[...hostEl.querySelectorAll('.lk-canvas-block')].find(b=>b.dataset.module===module.id);
      if(!block)continue;
      block.style.setProperty('--lk-module-accent',module.color?flow.moduleColor(module):'#B49AD2');
      const main=block.querySelector('.lk-module-main');
      if(main)main.title=(module.category||'业务')+' / '+module.name;
      const lane=block.querySelector('.lk-canvas-lane');if(!lane)continue;
      const steps=[...lane.querySelectorAll('.lk-step')];
      const byId=new Map(steps.map(x=>[x.dataset.dragNode,x]));
      const subStages=stagesAPI.stages(module),edges=flow.activeBranches(module);
      lane.replaceChildren();lane.classList.add('lk-stage-board');
      subStages.forEach((stage,index)=>{
        const card=el('section','lk-substage');
        card.dataset.stageId=stage.id;card.dataset.module=module.id;
        const softAccents=['#A989CB','#84A8D1','#84B4A0','#D6B28B'];
        card.style.setProperty('--lk-stage-accent',stage.color||module.color?flow.stageColor(module,stage):softAccents[index%softAccents.length]);
        const head=el('header','lk-substage-head');
        head.draggable=!blocked&&!stage.virtual;
        head.dataset.dragStage=stage.id;head.dataset.module=module.id;head.title='拖动子环节标题区调整顺序';
        const grip=btn('⠿','noop',module.id,stage.id,blocked||!!stage.virtual);
        grip.classList.add('lk-stage-grip');grip.draggable=false;
        grip.title='按住标题区拖动子环节';
        const name=btn(stage.name,'select-stage',module.id,stage.id);
        name.classList.add('lk-stage-title');
        const actions=el('div','lk-stage-actions');
        const {label:colorLabel,reset}=picker(module,stage,blocked);
        actions.append(colorLabel,reset,
          btn(stage.collapsed?'展开':'收起','stage-collapse',module.id,stage.id,blocked||!!stage.virtual),
          btn('改名','stage-rename',module.id,stage.id,blocked||!!stage.virtual),
          btn('前置配置','setup-stage',module.id,stage.id,blocked||!!stage.virtual),
          btn('＋ 操作','stage-add-node',module.id,stage.id,blocked||!module.enabled),
          btn('＋ 分支 / 异常','stage-branch',module.id,stage.id,blocked||!module.enabled||!module.nodes.some(n=>stagesAPI.stageFor(module,n)===stage.id)),
          btn('删除','stage-delete',module.id,stage.id,blocked||!!stage.virtual)
        );
        head.append(grip,name,actions);card.append(head);
        const prereqs=setup?.list(stage)||[];
        if(prereqs.length){
          const details=el('details','lk-setup-summary lk-setup-stage-summary');
          details.append(el('summary','', '前置配置 · '+prereqs.filter(x=>x.role==='prerequisite').length+' 项'));
          const badges=el('div','lk-setup-badges');
          prereqs.forEach(item=>badges.append(el('span','lk-setup-badge',(item.role==='reference'?'记录：':'')+item.name+' · '+(item.value||'待配置'))));
          details.append(badges);card.append(details);
        }
        const ops=el('div','lk-substage-body');
        ops.dataset.dropModule=module.id;ops.dataset.dropStage=stage.id;
        const members=module.nodes.filter(n=>stagesAPI.stageFor(module,n)===stage.id);
        const mainMembers=members.filter(n=>!flow.isBranchOnly(module,n.id));
        if(!stage.collapsed){
          const mainline=el('div','lk-flow-main');
          mainline.dataset.dropModule=module.id;mainline.dataset.dropStage=stage.id;
          mainMembers.forEach((op,i)=>{
            const cardSlot=el('div','lk-flow-item');
            const step=byId.get(op.id);if(!step)return;
            step.dataset.stageId=stage.id;
            const button=step.querySelector('button[data-action="select-node"]');
            if(button)button.dataset.stage=stage.id;
            const actions=step.querySelector('.lk-step-actions');if(actions)actions.remove();
            if(op.color)step.style.setProperty('--lk-node-accent',flow.color(op.color,'#222222'));
            if(op.note||op.tags?.length||op.operationCodes?.length){
              const meta=el('div','lk-op-meta');
              if(op.note)meta.append(el('span','lk-op-note',op.note.slice(0,70)));
              if(op.tags?.length)meta.append(el('span','lk-op-tags',op.tags.slice(0,3).map(x=>'#'+x).join(' ')));
              if(op.operationCodes?.length)meta.append(el('span','lk-op-codes','操作码 '+op.operationCodes.slice(0,2).join(', ')));
              cardSlot.append(meta);
            }
            cardSlot.prepend(step);
            const outgoing=edges.filter(e=>e.from===op.id);
            if(outgoing.length){
              const div=el('div','lk-flow-branches');
              outgoing.forEach(edge=>{
                const target=module.nodes.find(n=>n.id===edge.to);
                const branch=el('div','lk-branch-edge '+(edge.type==='branch'?'lk-branch-normal':'lk-branch-exception'));
                const connector=el('span','lk-branch-connector','↳');
                connector.title='从 '+op.title+' 分支';
                const tag=el('span','lk-branch-condition',edge.label);
                const diagonal=el('span','lk-branch-arrow','⟶');
                const sameStage=target&&stagesAPI.stageFor(module,target)===stage.id;
                const actual=target&&sameStage&&flow.isBranchOnly(module,target.id)?byId.get(target.id):null;
                if(actual&&actual.parentElement===null){
                  actual.classList.add('lk-branch-node');
                  actual.dataset.stageId=stage.id;
                  const link=actual.querySelector('button[data-action="select-node"]');
                  if(link)link.dataset.stage=stage.id;
                  actual.querySelector('.lk-step-actions')?.remove();
                  if(target.color)actual.style.setProperty('--lk-node-accent',flow.color(target.color,'#222222'));
                  branch.classList.add(edge.type==='branch'?'lk-branch-normal':'lk-branch-exception');
                  branch.append(connector,tag,diagonal,actual);
                }else{
                  const targetLink=btn(target?.title||'未知目标','select-node',module.id,stage.id);
                  targetLink.classList.add('lk-branch-target');targetLink.dataset.id=edge.to;
                  branch.append(connector,tag,diagonal,targetLink);
                }
                div.append(branch);
              });
              cardSlot.append(div);
            }
            mainline.append(cardSlot);
            if(i<mainMembers.length-1)mainline.append(arrow(op.title+' 后续操作'));
          });
          if(!mainMembers.length)mainline.append(el('p','lk-substage-folded','暂无主线操作，可添加或移动操作。'));
          ops.append(mainline);
          const drop=el('div','lk-drop-end','拖动操作到这里追加');
          drop.dataset.dropModule=module.id;drop.dataset.dropStage=stage.id;ops.append(drop);
        }else{
          ops.append(el('p','lk-substage-folded',members.length+' 个操作已折叠'));
        }
        card.append(ops);lane.append(card);
      });
      const add=el('button','lk-substage-create','＋ 添加子环节');
      add.type='button';add.dataset.action='stage-add';add.dataset.module=module.id;add.disabled=blocked||!module.enabled;lane.append(add);
    }
  }
  host.LambertLogisticsStageView=Object.freeze({renderStageLane});
})(typeof window!=='undefined'?window:globalThis);
