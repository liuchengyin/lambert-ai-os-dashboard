/* 画master V1: X6 projection and isolated research layout.
 * Never writes lambert_logistics_knowledge_v1 or lambert_logistics_versions_v1.
 */
(function(root){
 'use strict';
 const KEY='lambert_logistics_master_v1';
 const clone=x=>JSON.parse(JSON.stringify(x));
 const object=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
 const nodeId=(moduleId,operationId)=>'op:'+encodeURIComponent(moduleId)+'/'+encodeURIComponent(operationId);
 const noteId=id=>'note:'+encodeURIComponent(id);
 const finite=v=>typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<200000;
 const position=p=>object(p)&&finite(p.x)&&finite(p.y);
 const fresh=()=>({schema:1,positions:{},notes:[],links:[],collapsed:{},sourceVersion:0});
 const isValid=data=>{
   if(!object(data)||data.schema!==1||!object(data.positions)||!Array.isArray(data.notes)||!Array.isArray(data.links)||!object(data.collapsed))return false;
   if(Object.entries(data.positions).length>2000||data.notes.length>100||data.links.length>500)return false;
   if(Object.entries(data.positions).some(([id,p])=>id.length>320||!position(p)))return false;
   if(Object.entries(data.collapsed).some(([id,v])=>id.length>160||typeof v!=='boolean'))return false;
   const notes=new Set();
   for(const n of data.notes){
     if(!object(n)||typeof n.id!=='string'||!n.id||n.id.length>100||notes.has(n.id)||
       typeof n.title!=='string'||n.title.length>100||typeof n.body!=='string'||n.body.length>2000||!position(n))return false;
     notes.add(n.id);
   }
   const links=new Set();
   for(const l of data.links){
     if(!object(l)||typeof l.id!=='string'||!l.id||l.id.length>100||links.has(l.id)||
       typeof l.from!=='string'||!l.from||l.from.length>320||typeof l.to!=='string'||!l.to||l.to.length>320||
       l.from===l.to||typeof l.label!=='string'||l.label.length>100||l.status!=='hypothesis')return false;
     links.add(l.id);
   }
   return true;
 };
 function load(store){
   try{
     const raw=store.getItem(KEY);
     if(raw===null)return {data:fresh(),persisted:false};
     const parsed=JSON.parse(raw);
     return isValid(parsed)?{data:clone(parsed),persisted:true}:{error:'画master 历史数据格式异常；已锁定，避免覆盖'};
   }catch{return {error:'画master 数据读取失败；已禁止保存，旧数据不会覆盖'};}
 }
 function save(store,data){
   if(!isValid(data))return false;
   try{store.setItem(KEY,JSON.stringify(data));return true;}catch{return false;}
 }
 function build(source,layout,scope='all'){
   if(!object(source)||source.schema!==1||!Array.isArray(source.modules)||!isValid(layout))throw Error('invalid_master_source');
   const nodes=[],edges=[],all=new Set();
   let y=96,stageIndex=0,validBranches=0;
   const moduleSelected=m=>scope==='all'||m.id===scope;
   for(const module of source.modules){
     if(!moduleSelected(module))continue;
     if(!module||typeof module.id!=='string'||!Array.isArray(module.nodes))throw Error('invalid_master_module');
     nodes.push({id:'heading:'+encodeURIComponent(module.id),kind:'heading',moduleId:module.id,
       title:(module.category||'业务')+' · '+module.name,position:{x:54,y}});
     y+=62;
     const stages=Array.isArray(module.stages)&&module.stages.length?module.stages:[{id:'general',name:'操作流程'}];
     const stageFor=n=>stages.find(s=>s.id===n.stageId)?.id||stages[0].id;
     const grouped=stages.map(s=>({stage:s,items:module.nodes.filter(n=>stageFor(n)===s.id)}));
     for(const group of grouped){
       nodes.push({id:'stage:'+encodeURIComponent(module.id)+'/'+encodeURIComponent(group.stage.id),kind:'stage',
         moduleId:module.id,title:group.stage.name,position:{x:66,y}});
       const branchOnly=new Set((module.branches||[]).filter(e=>e&&e.to).map(e=>e.to));
       let col=0,branchCol=0;
       const main=group.items.filter(n=>!n.branchOnly||!branchOnly.has(n.id));
       const branches=group.items.filter(n=>n.branchOnly&&branchOnly.has(n.id));
       const ordered=[...main,...branches];
       for(const n of ordered){
         if(!n||typeof n.id!=='string'||!n.id)continue;
         const id=nodeId(module.id,n.id);
         if(all.has(id))throw Error('duplicate_operation_id');
         all.add(id);
         const isBranch=branches.includes(n);
         const fallback={x:210+(isBranch?branchCol++:col++)*228,y:y+(isBranch?110:0)};
         nodes.push({id,kind:isBranch?'branch':'operation',moduleId:module.id,operationId:n.id,
           title:n.title||'未命名操作',position:layout.positions[id]||fallback,operation:n});
       }
       y+=branches.length?265:164;
       stageIndex++;
     }
     const nids=new Set(module.nodes.map(n=>n.id));
     for(const edge of module.branches||[]){
       if(!edge||!nids.has(edge.from)||!nids.has(edge.to)||edge.from===edge.to)continue;
       edges.push({id:'legacy:'+encodeURIComponent(module.id)+'/'+encodeURIComponent(edge.id),
         from:nodeId(module.id,edge.from),to:nodeId(module.id,edge.to),label:edge.label||'条件',
         kind:edge.type==='exception'?'exception':'branch',fixed:true});
       validBranches++;
     }
     y+=60;
   }
   for(const note of layout.notes)nodes.push({id:noteId(note.id),kind:'note',title:note.title,body:note.body,
     position:{x:note.x,y:note.y},noteId:note.id});
   const available=new Set(nodes.map(n=>n.id));
   for(const link of layout.links)if(available.has(link.from)&&available.has(link.to))
     edges.push({id:'research:'+encodeURIComponent(link.id),from:link.from,to:link.to,
       label:link.label||'待核实',kind:'hypothesis',fixed:false,linkId:link.id});
   return {nodes,edges,sourceCount:all.size,branchCount:validBranches,sourceModules:source.modules.length};
 }
 function addLink(layout,from,to,label='研究关联（待核实）',id){
   if(!isValid(layout)||!from||!to||from===to||layout.links.some(l=>l.from===from&&l.to===to))return false;
   if(typeof id!=='string'||!id||id.length>100)return false;
   const next={id,from,to,label,status:'hypothesis'};
   if(!isValid({...layout,links:[...layout.links,next]}))return false;
   layout.links.push(next);return true;
 }
 function addNote(layout,note){
   if(!isValid(layout)||!note||!object(note)||layout.notes.some(n=>n.id===note.id))return false;
   const next={...layout,notes:[...layout.notes,note]};
   if(!isValid(next))return false;
   layout.notes.push(note);return true;
 }
 root.LambertLogisticsMasterModel=Object.freeze({KEY,nodeId,noteId,fresh,isValid,load,save,build,addLink,addNote,clone});
})(typeof window!=='undefined'?window:globalThis);
