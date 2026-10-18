globalThis.TaskCenterModel=(function(){
'use strict';
function isObj(v){return v!==null&&typeof v==='object'&&!Array.isArray(v);}
function clone(v){if(Array.isArray(v))return v.map(clone);if(isObj(v)){var o={};for(var k in v)if(Object.prototype.hasOwnProperty.call(v,k))Object.defineProperty(o,k,{value:clone(v[k]),enumerable:true,writable:true,configurable:true});return o;}return v;}
function str(v){return typeof v==='string'?v:'';}
function pad(n){return n<10?'0'+n:''+n;}
function parseDay(value){
  if(typeof value!=='string')return null;
  var s=value.trim();
  if(!s)return null;
  var m=/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?)?$/.exec(s);
  if(!m)return null;
  var y=+m[1],mo=+m[2],d=+m[3];
  if(y<1||mo<1||mo>12||d<1)return null;
  var dim=[31,(y%4===0&&(y%100!==0||y%400===0))?29:28,31,30,31,30,31,31,30,31,30,31][mo-1];
  if(d>dim)return null;
  if(m[4]!==undefined){var hh=+m[4],mi=+m[5],ss=m[6]===undefined?0:+m[6];if(hh>23||mi>59||ss>59)return null;}
  return {y:y,m:mo,d:d};
}
function day(value){
  var p=parseDay(value);
  if(!p)return '';
  return String(p.y).padStart(4,'0')+'-'+pad(p.m)+'-'+pad(p.d);
}
function dayNumber(value){
  var p=parseDay(value);
  if(!p)return null;
  var dt=new Date(0);dt.setUTCHours(0,0,0,0);dt.setUTCFullYear(p.y,p.m-1,p.d);return Math.floor(dt.getTime()/86400000);
}
function range(task){
  if(!isObj(task))return null;
  var s=day(task.start),e=day(task.due);
  if(!s||!e)return null;
  var sn=dayNumber(s),en=dayNumber(e);
  if(sn===null||en===null||sn>en)return null;
  function clock(v,last){var part=/[T ](.+)$/.exec(v.trim());if(!part)return last?86399999:0;var a=part[1].split(':');return (+a[0]*3600 + +a[1]*60 + +(a[2]||0))*1000;}
  if(sn===en&&clock(task.start,false)>clock(task.due,true))return null;
  return {start:s,end:e};
}
function gantt(tasks,from,days){
  var out=[];
  if(!Array.isArray(tasks))return out;
  var f=day(from);
  if(!f)return out;
  var n=typeof days==='number'?Math.floor(days):NaN;
  if(!isFinite(n)||n<1||n>366)return out;
  var fn=dayNumber(f);
  if(fn===null)return out;
  var winEnd=fn+n-1;
  for(var i=0;i<tasks.length;i++){
    var t=tasks[i];
    if(!isObj(t))continue;
    var r=range(t);
    if(!r)continue;
    var sn=dayNumber(r.start),en=dayNumber(r.end);
    if(sn===null||en===null)continue;
    if(en<fn||sn>winEnd)continue;
    var cs=Math.max(sn,fn),ce=Math.min(en,winEnd);
    out.push({taskId:t.id,offset:cs-fn,length:ce-cs+1,clippedStart:cs>sn,clippedEnd:ce<en});
  }
  return out;
}
function resolveProject(task,projects){
  if(!isObj(task))return 'inbox';
  var list=Array.isArray(projects)?projects:[];
  var ids=Object.create(null),names=Object.create(null);
  for(var i=0;i<list.length;i++){
    var p=list[i];
    if(!isObj(p))continue;
    if(p.id!==undefined&&p.id!==null&&p.id!=='')ids[String(p.id)]=p.id;
    var nm=str(p.name).trim();
    if(nm){if(!names[nm])names[nm]=[];names[nm].push(p.id);}
  }
  var pid=task.projectId;
  if(pid!==undefined&&pid!==null&&pid!==''&&Object.prototype.hasOwnProperty.call(ids,String(pid)))return ids[String(pid)];
  if(pid!==undefined&&pid!==null&&pid!=='')return 'inbox';
  var legacy=str(task.project).trim();
  if(legacy){
    if(Object.prototype.hasOwnProperty.call(ids,legacy))return ids[legacy];
    if(names[legacy]&&names[legacy].length===1)return names[legacy][0];
  }
  return 'inbox';
}
function migrate(projects,tasks){
  var srcP=Array.isArray(projects)?projects:[],srcT=Array.isArray(tasks)?tasks:[];
  var outP=srcP.map(clone),outT=srcT.map(clone),changed=false;
  var ids=Object.create(null),names=Object.create(null);
  for(var i=0;i<outP.length;i++){
    var p=outP[i];
    if(!isObj(p))continue;
    if(p.id!==undefined&&p.id!==null&&p.id!=='')ids[String(p.id)]=p.id;
    var nm=str(p.name).trim();
    if(nm){if(!names[nm])names[nm]=[];names[nm].push(p.id);}
    if(!Object.prototype.hasOwnProperty.call(p,'category')){p.category='';changed=true;}
  }
  for(var j=0;j<outT.length;j++){
    var t=outT[j];
    if(!isObj(t))continue;
    if(!Object.prototype.hasOwnProperty.call(t,'labels')){t.labels=[];changed=true;}
    var pid=t.projectId;
    var hasPid=pid!==undefined&&pid!==null&&pid!=='';
    if(hasPid&&Object.prototype.hasOwnProperty.call(ids,String(pid))){
      if(t.projectId!==ids[String(pid)]){t.projectId=ids[String(pid)];changed=true;}
      continue;
    }
    if(hasPid)continue;
    var legacy=str(t.project).trim();
    if(!legacy)continue;
    var resolved=null;
    if(Object.prototype.hasOwnProperty.call(ids,legacy))resolved=ids[legacy];
    else if(names[legacy]&&names[legacy].length===1)resolved=names[legacy][0];
    if(resolved!==null&&resolved!==undefined){
      if(t.projectId!==resolved){t.projectId=resolved;changed=true;}
    }
  }
  return {projects:outP,tasks:outT,changed:changed};
}
return {resolveProject:resolveProject,migrate:migrate,day:day,dayNumber:dayNumber,range:range,gantt:gantt};
})();
