import {stable} from './journal.mjs';
const documentNames={reading_workspace_v2:'阅读笔记',reading_standalone_notes_v1:'独立笔记',knowledge_link_library_v1:'常用书签',knowledge_link_personal_v1:'个人书签'};
const names={value:'笔记或书签内容',title:'任务名称',name:'名称',status:'状态',due:'截止日期',start:'开始日期',project:'关联项目',projectId:'项目编号',note:'备注',notes:'备注',steps:'分解步骤',labels:'标签',category:'分类',priority:'优先级',matrix:'优先级',repeat:'重复',goal:'目标',gap:'差距',reason:'原因',restart:'重启计划',taskIds:'目标任务',updatedAt:'修改时间',createdAt:'创建时间',deletedAt:'删除时间',archived:'归档',standard:'完成标准',deliverable:'预期产出',delivery:'实际结果'};
const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
function value(v){if(v===undefined||v===null||v==='')return '未填写';if(typeof v==='boolean')return v?'是':'否';if(Array.isArray(v))return v.length?v.map(x=>x&&typeof x==='object'?(x.done?'✓ ':'○ ')+(x.title||x.text||x.name||JSON.stringify(x)):String(x)).join('\n'):'无';return typeof v==='object'?JSON.stringify(v,null,2):String(v);}
export function conflictCard(op,local,onChoose){
 const box=node('section',undefined,'lambert-conflict');const title=node('div',undefined,'lambert-conflict-title');
 const mark=node('span','!','lambert-conflict-mark');mark.setAttribute('aria-hidden','true');title.append(mark,node('strong',local.payload.title||local.payload.name||documentNames[op.itemId]||op.itemId));
 box.append(title,node('p','两端都有修改，请对照后选择要保留的版本。'));
 const details=node('details',undefined,'lambert-conflict-compare');details.append(node('summary','查看两份内容'));
 const remote=op.conflict||{},left=local.payload||{},right=remote.payload||{};
 const keys=[...new Set([...Object.keys(left),...Object.keys(right)])].filter(k=>stable(left[k]??null)!==stable(right[k]??null));
 const columns=node('div',undefined,'lambert-conflict-versions');
 for(const [label,payload,deleted] of [['本地版本',left,local.deleted],['云端版本',right,remote.deleted_at]]){
  const column=node('div',undefined,'lambert-conflict-version');column.append(node('h3',label));if(deleted)column.append(node('p','此版本已删除该记录。'));
  if(!keys.length)column.append(node('p','字段内容一致，版本不同。'));
  const list=node('dl');for(const key of keys)list.append(node('dt',names[key]||key),node('dd',value(payload[key])));column.append(list);columns.append(column);
 }
 details.append(columns);box.append(details);
 const actions=node('div',undefined,'lambert-conflict-actions');
 for(const [label,choice] of [['保留云端','remote'],['使用本地','local']]){const b=node('button',label);b.type='button';b.onclick=()=>onChoose(choice);actions.append(b);}
 box.append(actions);return box;
}
