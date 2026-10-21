(function(){
'use strict';
var app=document.getElementById('app'),gesture=null,suppressUntil=0;
function group(){return app.querySelector('.task-list>.task-scopes,.project-status-filter,.review-day-scopes');}
function reset(){if(gesture&&app.hasPointerCapture(gesture.id))app.releasePointerCapture(gesture.id);gesture=null;}
app.addEventListener('pointerdown',function(e){
 if(gesture){reset();return;}
 if(!e.isPrimary||e.button!==0||!group())return;
 var target=e.target;
 // Rows keep their own delete/complete gestures; editing controls keep native behavior.
 if(target.closest('.task,.task-swipe,input,textarea,select,a,summary,[contenteditable],.goal-picker'))return;
 if(target.closest('button')&&!target.closest('.task-scopes,.project-view,.project-title-edit'))return;
 gesture={id:e.pointerId,x:e.clientX,y:e.clientY,group:group(),locked:false};
});
app.addEventListener('pointermove',function(e){
 var g=gesture;if(!g||e.pointerId!==g.id)return;
 var dx=e.clientX-g.x,dy=e.clientY-g.y;
 if(!g.locked){
  if(Math.abs(dy)>12&&Math.abs(dy)>=Math.abs(dx)){reset();return;}
  if(Math.abs(dx)<12||Math.abs(dx)<Math.abs(dy)*1.5)return;
  g.locked=true;app.setPointerCapture(e.pointerId);
 }
 if(e.cancelable)e.preventDefault();
});
app.addEventListener('pointerup',function(e){
 var g=gesture;if(!g||e.pointerId!==g.id)return;
 var dx=e.clientX-g.x,dy=e.clientY-g.y;reset();
 if(!g.locked)return;
 suppressUntil=performance.now()+350;
 if(!g.group.isConnected||Math.abs(dx)<Math.min(90,Math.max(56,app.clientWidth*.18))||Math.abs(dx)<Math.abs(dy)*1.5)return;
 var direction=dx<0?1:-1;
 var event=new CustomEvent('filter-swipe',{cancelable:true,detail:{direction:direction}});
 if(!g.group.dispatchEvent(event))return;
 var buttons=Array.from(g.group.querySelectorAll('button'));
 var active=buttons.findIndex(function(b){return b.getAttribute('aria-pressed')==='true';});
 var next=buttons[active+direction];if(active>=0&&next&&!next.disabled)next.click();
});
app.addEventListener('click',function(e){if(e.isTrusted&&performance.now()<suppressUntil){e.preventDefault();e.stopImmediatePropagation();}},true);
app.addEventListener('pointercancel',reset);
app.addEventListener('lostpointercapture',function(e){if(e.target===app)gesture=null;});
window.addEventListener('blur',reset);
})();
