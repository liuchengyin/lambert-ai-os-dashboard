/* 画master full draw.io canvas: separate account-scoped document, read-only source projection. */
(function(root){
 'use strict';
 const KEY='lambert_logistics_master_drawio_v1';
 const BACKUP_KEY='lambert_logistics_master_drawio_backup_v1';
 const MAX_XML=3800000;
 const clone=x=>JSON.parse(JSON.stringify(x));
 const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
 const validXml=s=>typeof s==='string'&&s.length<=MAX_XML&&s.length>18&&
   /^\s*(?:<\?xml[^>]*\?>\s*)?<(?:mxfile|mxGraphModel)(?:\s|>)/.test(s)&&!/<!(?:DOCTYPE|ENTITY)/i.test(s);
 const record=(xml,sourceVersion)=>({schema:1,xml,sourceVersion,updatedAt:new Date().toISOString()});
 const valid=x=>x&&x.schema===1&&validXml(x.xml)&&Number.isSafeInteger(x.sourceVersion)&&x.sourceVersion>=0&&typeof x.updatedAt==='string'&&x.updatedAt.length<=48;
 function load(store){
   try{
     const raw=store.getItem(KEY);
     if(raw===null)return {exists:false};
     const data=JSON.parse(raw);
     if(!valid(data))return {error:'已有画master文件格式异常；为防止覆盖，已禁止写入'};
     return {exists:true,data:clone(data)};
   }catch{return {error:'读取画master失败；为防止覆盖，已禁止写入'};}
 }
 function save(store,xml,sourceVersion){
   if(!validXml(xml)||!Number.isSafeInteger(sourceVersion)||sourceVersion<0)return false;
   try{
     const prior=store.getItem(KEY);
     // Fail closed: don't write over a corrupt version and don't write unless the old revision has a backup.
     if(prior!==null){
       const parsed=JSON.parse(prior);
       if(!valid(parsed))return false;
       store.setItem(BACKUP_KEY,prior);
     }
     store.setItem(KEY,JSON.stringify(record(xml,sourceVersion)));
     return true;
   }catch{return false;}
 }
 function seed(source){
   if(!source||source.schema!==1||!Array.isArray(source.modules)||source.modules.length>80)throw Error('invalid_original_graph');
   const cells=['<mxCell id="0"/>','<mxCell id="1" parent="0"/>'];
   let total=0;
   const rowHeight=91;
   source.modules.forEach((m,index)=>{
     if(!m||typeof m.id!=='string'||!Array.isArray(m.nodes)||m.nodes.length>150)throw Error('invalid_original_module');
     const x=80+index*328,head='mod_'+index;
     cells.push('<mxCell id="'+head+'" value="'+esc((m.category||'物流')+' · '+(m.name||'未命名'))+'" style="rounded=1;whiteSpace=wrap;html=0;fillColor=#e8e1f6;strokeColor=#b8a5d9;fontSize=18;fontStyle=1;" vertex="1" parent="1"><mxGeometry x="'+x+'" y="80" width="262" height="58" as="geometry"/></mxCell>');
     let y=155,previousStage='';
     const map=new Map();
     m.nodes.forEach((n,i)=>{
       if(!n||typeof n.id!=='string')throw Error('invalid_original_operation');
       total++;
       if(total>3000)throw Error('too_many_operations');
       const stage=Array.isArray(m.stages)?m.stages.find(s=>s.id===n.stageId):null;
       const name=stage?.name||'操作流程';
       if(name!==previousStage){
         cells.push('<mxCell id="stage_'+index+'_'+i+'" value="'+esc(name)+'" style="text;html=0;align=left;fontColor=#84729c;fontSize=12;fontStyle=1;" vertex="1" parent="1"><mxGeometry x="'+(x+10)+'" y="'+y+'" width="240" height="26" as="geometry"/></mxCell>');
         y+=34;previousStage=name;
       }
       const id='op_'+index+'_'+i,exception=Boolean(n.branchOnly);
       map.set(n.id,id);
       const style=exception?'fillColor=#fff1f1;strokeColor=#df8585;fontColor=#973b44':'fillColor=#ffffff;strokeColor=#a892cb;fontColor=#2c2640';
       cells.push('<mxCell id="'+id+'" value="'+esc(n.title||'未命名操作')+'" style="rounded=1;whiteSpace=wrap;html=0;spacing=12;'+style+';" vertex="1" parent="1" lambertModuleId="'+esc(m.id)+'" lambertOperationId="'+esc(n.id)+'"><mxGeometry x="'+(x+10)+'" y="'+y+'" width="242" height="61" as="geometry"/></mxCell>');
       y+=rowHeight;
     });
     for(const [k,e] of (Array.isArray(m.branches)?m.branches:[]).entries()){
       if(!e||!map.has(e.from)||!map.has(e.to)||e.from===e.to)continue;
       const isException=e.type==='exception'||/异常|失败/.test(e.label||'');
       const stroke=isException?'#d45f69':'#6084b4';
       cells.push('<mxCell id="branch_'+index+'_'+k+'" value="'+esc(e.label||'条件')+'" style="edgeStyle=orthogonalEdgeStyle;rounded=1;html=0;endArrow=block;endFill=1;strokeWidth=2;strokeColor='+stroke+';fontColor='+stroke+';" edge="1" parent="1" source="'+map.get(e.from)+'" target="'+map.get(e.to)+'"><mxGeometry relative="1" as="geometry"/></mxCell>');
     }
   });
   // No sequential arrows are inferred: only explicit stored branch edges above.
   return '<mxfile host="LambertOS" type="device"><diagram id="lambert-logistics" name="物流研究画布"><mxGraphModel dx="1500" dy="950" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1600" pageHeight="1200" math="0" shadow="0"><root>'+cells.join('')+'</root></mxGraphModel></diagram></mxfile>';
 }
 function blank(){
   return '<mxfile host="LambertOS" type="device"><diagram id="lambert-blank" name="自由画布"><mxGraphModel dx="1000" dy="750" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1600" pageHeight="1200"><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel></diagram></mxfile>';
 }
 root.LambertDrawioModel=Object.freeze({KEY,BACKUP_KEY,validXml,load,save,seed,blank});
})(typeof window!=='undefined'?window:globalThis);
