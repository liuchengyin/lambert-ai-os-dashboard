(function(){
'use strict';
var current=null;
function icon(name){return window.MobileCompose.icon(name);}
function wrap(row,title,onDelete,onComplete,onArchive){
 var w=document.createElement('div');w.className='task-swipe';
 var remove=document.createElement('button');remove.className='task-swipe-delete';remove.type='button';remove.textContent='删除';remove.setAttribute('aria-label','删除：'+title);
 var complete=document.createElement('button');complete.className='task-swipe-complete';complete.type='button';complete.appendChild(icon(onArchive?'archive':'check'));complete.appendChild(document.createTextNode(onArchive?'归档':'完成'));complete.setAttribute('aria-label',(onArchive?'归档：':'完成：')+title);
 row.classList.add('task-swipe-front');w.append(complete,remove,row);
 var id=null,sx=0,sy=0,x=0,drag=false,suppress=false,opened=0,startX=0,busy=false;
 function half(){return w.clientWidth/2;}
 function quarter(){return w.clientWidth/4;}
 function move(value,animate){row.style.transition=animate?'transform 200ms cubic-bezier(.22,.61,.36,1),opacity 200ms':'none';row.style.transform='translateX('+value+'px)';w.classList.toggle('swipe-right',value>0);}
 function actions(side){remove.hidden=side!==-1;remove.tabIndex=side===-1?0:-1;complete.hidden=side!==1;complete.tabIndex=side===1?0:-1;}
 function close(){opened=0;move(0,true);actions(0);w.classList.remove('swipe-dragging');if(current===state)current=null;}
 function open(side){if(current&&current!==state)current.close();opened=side;actions(side);move(side===1?quarter():-half(),true);current=state;w.classList.remove('swipe-dragging');}
 function finish(action,label){if(busy)return;busy=true;try{action();if(current===state)current=null;actions(0);w.classList.add('swipe-finishing');move(w.clientWidth,true);row.style.opacity='0';}catch(err){busy=false;close();alert(label+'失败：'+(err.message||err));}}
 var state={w:w,close:close};actions(0);
 row.addEventListener('pointerdown',function(e){
  if(busy||id!==null||!e.isPrimary||(e.pointerType==='mouse'&&e.button!==0))return;
  id=e.pointerId;sx=e.clientX;sy=e.clientY;startX=opened===-1?-half():opened===1?quarter():0;x=startX;drag=false;suppress=false;
 });
 row.addEventListener('pointermove',function(e){
  if(e.pointerId!==id||busy)return;
  var dx=e.clientX-sx,dy=e.clientY-sy;
  if(!drag){
   if(Math.abs(dy)>10&&Math.abs(dy)>=Math.abs(dx)){id=null;return;}
   if(Math.abs(dx)<12||Math.abs(dx)<Math.abs(dy)*1.5)return;
   drag=true;suppress=true;row.setPointerCapture(id);if(current&&current!==state)current.close();w.classList.add('swipe-dragging');
  }
  if(e.cancelable)e.preventDefault();
  x=Math.max(-half(),Math.min(onComplete||onArchive?quarter():0,startX+dx));
  actions(x>0?1:x<0?-1:0);complete.tabIndex=-1;remove.tabIndex=-1;move(x,false);
 });
 row.addEventListener('pointerup',function(e){
  if(e.pointerId!==id)return;id=null;if(!drag)return;drag=false;w.classList.remove('swipe-dragging');
  var dx=e.clientX-sx;
  if(opened&&Math.sign(dx)===-opened&&Math.abs(dx)>12){close();return;}
  if(x<=-36){open(-1);return;}
  if(onArchive&&startX===0&&dx>=quarter()&&x>0){finish(onArchive,'归档');return;}
  if(onComplete&&x>=quarter()*.6){open(1);return;}
  close();
 });
 row.addEventListener('pointercancel',function(e){if(e.pointerId!==id)return;id=null;drag=false;if(opened)open(opened);else close();});
 // A child's implicit touch capture is released when the row takes ownership; that is not cancellation.
 row.addEventListener('lostpointercapture',function(e){if(e.target===row&&e.pointerId===id){id=null;drag=false;close();}});
 row.addEventListener('click',function(e){if(suppress||busy){suppress=false;e.preventDefault();e.stopPropagation();return;}if(opened){e.preventDefault();e.stopPropagation();close();}},true);
 remove.addEventListener('click',function(e){e.stopPropagation();if(opened!==-1)return;try{onDelete();close();}catch(err){alert('删除失败：'+(err.message||err));}});
 complete.addEventListener('click',function(e){e.stopPropagation();if(opened===1&&onComplete)finish(onComplete,'完成');});
 w.addEventListener('keydown',function(e){if(e.target&&(/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||e.target.isContentEditable))return;if(e.key==='ArrowLeft'){e.preventDefault();open(-1);}else if(e.key==='Escape'){e.preventDefault();close();}else if(e.key==='ArrowRight'){e.preventDefault();if(opened)close();else if(onComplete)open(1);else if(onArchive)finish(onArchive,'归档');}});
 return w;
}
function closeCurrent(){if(current)current.close();}
document.addEventListener('pointerdown',function(e){if(current&&!current.w.contains(e.target))closeCurrent();},true);
document.addEventListener('scroll',closeCurrent,true);window.addEventListener('resize',closeCurrent);
window.MobileTaskSwipe={wrap:wrap};
})();
