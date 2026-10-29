/* Lambert Logistics V2.3: flow arrows, optional condition branches, nested lanes.
 * The underlying operation objects remain untouched by rendering.
 */
(function(host){
  'use strict';
  const stagesAPI=host.LambertLogisticsStages,flow=host.LambertLogisticsFlow,setup=host.LambertLogisticsSetupV34,mini=host.LambertLogisticsV35,wiring=host.LambertLogisticsWiringV36;
  if(!stagesAPI||!flow)return;
  const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
  const btn=(label,action,moduleId,stageId,disabled=false)=>{
    const n=el('button','lk-stage-control',label);n.type='button';
    n.dataset.action=action;n.dataset.module=moduleId;n.dataset.stage=stageId;n.disabled=disabled;return n;
  };
  const arrow=label=>{
    const a=el('span','lk-flow-arrow','→');a.setAttribute('aria-label',label||'下一操作');a.title='当前画布排列顺序（非已核实的真实触发关系）';return a;
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
  function miniMenu(module,operation,stageId,blocked){
    const menu=el('details','lk-mini-add');
    const summary=el('summary','', '＋');
    summary.title='为「'+operation.title+'」添加业务分支或异常流程';
    summary.setAttribute('aria-label','为'+operation.title+'添加子流程');
    if(blocked||module.enabled===false){
      summary.setAttribute('aria-disabled','true');menu.classList.add('is-disabled');
    }else{
      const choices=el('div','lk-mini-choices');
      [['branch','分支流程'],['exception','异常流程']].forEach(([type,label])=>{
        const b=btn(label,'branch-quick-choice',module.id,stageId);
        b.dataset.id=operation.id;b.dataset.branchType=type;choices.append(b);
      });
      menu.append(summary,choices);return menu;
    }
    menu.append(summary);return menu;
  }
  function miniChildren(module,operation,stageId,blocked,depth=0,seen=new Set()){
    const children=mini.tree(module,operation.id,seen,depth);
    if(!children.length)return null;
    const wrap=el('div','lk-mini-children');
    children.forEach(({edge,target,circular,truncated,children:grandchildren})=>{
      if(!target)return;
      const row=el('div','lk-mini-path '+(edge.type==='exception'?'lk-mini-exception':'lk-mini-branch'));
      const condition=el('span','lk-mini-condition',edge.label||'条件');
      condition.title='触发条件：'+(edge.label||'');
      const card=btn(target.title,'select-node',module.id,stageId);
      card.dataset.id=target.id;card.classList.add('lk-mini-card');
      card.title='点击查看详情：'+target.title;
      row.append(condition,card,miniMenu(module,target,stageId,blocked));
      if(circular)row.append(el('span','lk-mini-circular','↺'));
      if(truncated)row.append(el('span','lk-mini-condition','还有更深层分支（未展开）'));
      if(grandchildren.length){
        const recursive=el('div','lk-mini-descendants');
        function draw(items,parent){
          items.forEach(child=>{
            if(!child.target)return;
            const next=el('div','lk-mini-path '+(child.edge.type==='exception'?'lk-mini-exception':'lk-mini-branch'));
            const label=el('span','lk-mini-condition',child.edge.label);
            const button=btn(child.target.title,'select-node',module.id,stageId);
            button.dataset.id=child.target.id;button.classList.add('lk-mini-card');
            next.append(label,button,miniMenu(module,child.target,stageId,blocked));
            if(child.circular)next.append(el('span','lk-mini-circular','↺'));
            if(child.truncated)next.append(el('span','lk-mini-condition','还有更深层分支（未展开）'));
            if(child.children.length){const nested=el('div','lk-mini-descendants');draw(child.children,nested);next.append(nested);}
            parent.append(next);
          });
        }
        draw(grandchildren,recursive);row.append(recursive);
      }
      wrap.append(row);
    });
    return wrap;
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
          btn('＋ 操作','stage-add-node',module.id,stage.id,blocked||!module.enabled),
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
            if(button){
              button.dataset.stage=stage.id;
              const progress=wiring?.progress(op);
              if(progress){
                const status=el('span','lk-wiring-indicator'+(progress.count?' is-ready':''),progress.invalid?'信息层待检查':('信息层 '+progress.count+'/'+progress.total));
                status.title='查看操作信息流、日志、表、SLA 和任务配置';
                button.append(status);
              }
            }
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
            // One compact + per operation; subflow nodes are half-size and
            // attach below their source without entering the mainline order.
            cardSlot.append(miniMenu(module,op,stage.id,blocked));
            const children=miniChildren(module,op,stage.id,blocked);
            if(children)cardSlot.append(children);
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
