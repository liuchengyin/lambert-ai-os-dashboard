(function(){
'use strict';
var current=null;
function wrap(row,title,onDelete,onComplete){
 var w=document.createElement('div');w.className='task-swipe';
 var remove=document.createElement('button');remove.className='task-swipe-delete';remove.type='button';remove.textContent='删除';remove.setAttribute('aria-label','删除：'+title);remove.hidden=true;remove.tabIndex=-1;
 var complete=document.createElement('span');complete.className='task-swipe-complete';complete.textContent='✓ 完成';complete.setAttribute('aria-hidden','true');
 row.classList.add('task-swipe-front');w.append(complete,remove,row);
 var id=null,sx=0,sy=0,x=0,drag=false,suppress=false,opened=false,wasOpen=false,busy=false;
 function half(){return w.clientWidth/2;}
 function move(value,animate){row.style.transition=animate?'transform 200ms cubic-bezier(.22,.61,.36,1),opacity 200ms':'none';row.style.transform='translateX('+value+'px)';}
 function close(){opened=false;move(0,true);remove.hidden=true;remove.tabIndex=-1;w.classList.remove('swipe-dragging','swipe-ready','swipe-right');if(current===state)current=null;}
 function open(){if(current&&current!==state)current.close();opened=true;remove.hidden=false;remove.tabIndex=0;move(-half(),true);current=state;w.classList.remove('swipe-dragging','swipe-ready','swipe-right');}
 var state={w:w,close:close};
 row.addEventListener('pointerdown',function(e){
  if(busy||id!==null||(e.pointerType==='mouse'&&e.button!==0))return;
  id=e.pointerId;sx=e.clientX;sy=e.clientY;x=opened?-half():0;drag=false;suppress=false;wasOpen=opened;
 });
 row.addEventListener('pointermove',function(e){
  if(e.pointerId!==id||busy)return;
  var dx=e.clientX-sx,dy=e.clientY-sy;
  if(!drag){
   if(Math.abs(dx)>10&&Math.abs(dx)>Math.abs(dy)*1.3){drag=true;suppress=true;row.setPointerCapture(id);if(current&&current!==state)current.close();w.classList.add('swipe-dragging');}
   else if(Math.abs(dy)>10){id=null;return;}else return;
  }
  x=Math.max(-half(),Math.min(wasOpen?0:(onComplete?half():0),(wasOpen?-half():0)+dx));
  w.classList.toggle('swipe-right',x>0);remove.hidden=x>=0;remove.tabIndex=-1;
  w.classList.toggle('swipe-ready',x>=Math.max(64,w.clientWidth*.25));move(x,false);
 });
 row.addEventListener('pointerup',function(e){
  if(e.pointerId!==id)return;id=null;if(!drag)return;drag=false;w.classList.remove('swipe-dragging');
  if(wasOpen&&e.clientX-sx>10){close();return;}
  if(x<=-36){open();return;}
  if(!wasOpen&&onComplete&&x>=Math.max(64,w.clientWidth*.25)){
   busy=true;
   try{onComplete();if(current===state)current=null;w.classList.add('swipe-finishing');move(w.clientWidth,true);row.style.opacity='0';}
   catch(err){busy=false;close();alert('完成失败：'+(err.message||err));}
   return;
  }
  close();
 });
 row.addEventListener('pointercancel',function(e){if(e.pointerId!==id)return;id=null;drag=false;if(wasOpen)open();else close();});
 row.addEventListener('click',function(e){if(suppress||busy){suppress=false;e.preventDefault();e.stopPropagation();return;}if(opened){e.preventDefault();e.stopPropagation();close();}},true);
 remove.addEventListener('click',function(e){e.stopPropagation();try{onDelete();close();}catch(err){alert('删除失败：'+(err.message||err));}});
 w.addEventListener('keydown',function(e){if(e.target&&(/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||e.target.isContentEditable))return;if(e.key==='ArrowLeft'){e.preventDefault();open();}else if((e.key==='Escape'||e.key==='ArrowRight')&&opened){e.preventDefault();close();}});
 return w;
}
function closeCurrent(){if(current)current.close();}
document.addEventListener('pointerdown',function(e){if(current&&!current.w.contains(e.target))closeCurrent();},true);
document.addEventListener('scroll',closeCurrent,true);window.addEventListener('resize',closeCurrent);
window.MobileTaskSwipe={wrap:wrap};
})();
