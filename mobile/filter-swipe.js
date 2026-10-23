(function(){
'use strict';
var app=document.getElementById('app'),gesture=null,motion=null,suppressUntil=0;
var reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
function group(){return app.querySelector('.task-list>.task-scopes,.project-status-filter,.review-day-scopes');}
function release(){var g=gesture;gesture=null;if(g&&app.hasPointerCapture(g.id))app.releasePointerCapture(g.id);return g;}
function clearMotion(){if(!motion)return;cancelAnimationFrame(motion.raf);clearTimeout(motion.timer);motion.frame.remove();motion=null;}
function cancel(){release();clearMotion();}
function page(source,top,padding){
 var clone=source.cloneNode(true);clone.removeAttribute('id');clone.querySelectorAll('[id]').forEach(function(n){n.removeAttribute('id');});
 clone.querySelectorAll('[data-k]').forEach(function(n){n.removeAttribute('data-k');});
 clone.querySelectorAll('.task-fab,.filter-swipe-frame').forEach(function(n){n.remove();});
 clone.classList.add('filter-swipe-page');clone.setAttribute('aria-hidden','true');clone.inert=true;
 clone.style.top=top+'px';clone.style.padding=padding;return clone;
}
function neighbor(direction){
 var m=motion;if(m.direction===direction)return;
 if(m.next)m.next.remove();m.direction=direction;m.next=null;
 var preview=window.MobileFilterPages&&window.MobileFilterPages.preview(direction);
 if(preview){m.next=page(preview,m.top,m.padding);m.frame.appendChild(m.next);m.next.querySelectorAll('.review-fields textarea').forEach(function(ta){ta.style.height='0px';ta.style.height=Math.max(64,ta.scrollHeight+2)+'px';});}
}
function start(g,direction){
 var rect=app.getBoundingClientRect(),nav=document.getElementById('tabs').getBoundingClientRect();
 var top=Math.max(0,rect.top),bottom=Math.min(innerHeight,nav.top,rect.bottom);
 var frame=document.createElement('div');frame.className='filter-swipe-frame';frame.setAttribute('aria-hidden','true');frame.inert=true;
 frame.style.cssText='left:'+rect.left+'px;top:'+top+'px;width:'+rect.width+'px;height:'+Math.max(0,bottom-top)+'px';
 var padding=getComputedStyle(app).padding,current=page(app,rect.top-top,padding);frame.appendChild(current);
 motion={frame:frame,current:current,next:null,direction:0,width:rect.width,top:rect.top-top,padding:padding,origin:g.group,x:0,raf:0,timer:0,settling:false};
 app.appendChild(frame);neighbor(direction);
}
function draw(g){
 if(!g.group.isConnected){cancel();return;}
 var direction=g.dx<0?1:-1;if(!motion)start(g,direction);else neighbor(direction);
 var m=motion;if(!m)return;
 // At the first/last page, resistance grows instead of exposing an empty page.
 m.x=m.next?Math.max(-m.width,Math.min(m.width,g.dx)):g.dx*.25/(1+Math.abs(g.dx)/m.width);
 m.current.style.transform='translate3d('+m.x+'px,0,0)';
 if(m.next)m.next.style.transform='translate3d('+(m.x+m.direction*m.width)+'px,0,0)';
}
function commit(m){
 if(!m.origin.isConnected)return;
 var event=new CustomEvent('filter-swipe',{cancelable:true,detail:{direction:m.direction}});
 if(!m.origin.dispatchEvent(event))return;
 var buttons=Array.from(m.origin.querySelectorAll('button'));
 var active=buttons.findIndex(function(b){return b.getAttribute('aria-pressed')==='true';});
 var next=buttons[active+m.direction];if(active>=0&&next&&!next.disabled)next.click();
}
function settle(accepted){
 var m=motion;if(!m)return;cancelAnimationFrame(m.raf);m.settling=true;m.frame.dataset.phase=accepted?'commit':'rebound';
 var target=accepted?-m.direction*m.width:0;
 var duration=reduced.matches?0:Math.max(170,Math.min(280,190+Math.abs(target-m.x)/m.width*70));
 // Read layout once at release; pointermove only writes compositor transforms.
 m.current.getBoundingClientRect();
 var transition='transform '+duration+'ms cubic-bezier(.22,.75,.25,1)';m.current.style.transition=transition;if(m.next)m.next.style.transition=transition;
 m.current.style.transform='translate3d('+target+'px,0,0)';if(m.next)m.next.style.transform='translate3d('+(target+m.direction*m.width)+'px,0,0)';
 m.timer=setTimeout(function(){if(motion!==m)return;try{if(accepted)commit(m);}finally{clearMotion();}},duration+20);
}
app.addEventListener('pointerdown',function(e){
 if(motion&&motion.settling)return;
 if(gesture){cancel();return;}
 if(!e.isPrimary||e.button!==0||!group())return;
 var target=e.target;
 // Row actions and native input selection remain independent of page swiping.
 if(target.closest('.task,.task-swipe,input,textarea,select,a,summary,[contenteditable],.goal-picker'))return;
 if(target.closest('button')&&!target.closest('.task-scopes,.project-view,.project-title-edit'))return;
 gesture={id:e.pointerId,x:e.clientX,y:e.clientY,dx:0,group:group(),locked:false,lastX:e.clientX,lastTime:performance.now(),velocity:0};
});
app.addEventListener('pointermove',function(e){
 var g=gesture;if(!g||e.pointerId!==g.id)return;
 var dx=e.clientX-g.x,dy=e.clientY-g.y;
 if(!g.locked){
  if(Math.abs(dy)>12&&Math.abs(dy)>=Math.abs(dx)){cancel();return;}
  if(Math.abs(dx)<12||Math.abs(dx)<Math.abs(dy)*1.5)return;
  g.locked=true;app.setPointerCapture(e.pointerId);
 }
 if(e.cancelable)e.preventDefault();
 var now=performance.now(),elapsed=now-g.lastTime;if(elapsed>0)g.velocity=(e.clientX-g.lastX)/elapsed;g.lastX=e.clientX;g.lastTime=now;g.dx=dx;
 if(!motion)draw(g);
 if(motion&&!motion.raf)motion.raf=requestAnimationFrame(function(){if(motion)motion.raf=0;if(gesture===g)draw(g);});
});
app.addEventListener('pointerup',function(e){
 var g=gesture;if(!g||e.pointerId!==g.id)return;release();if(!g.locked)return;
 suppressUntil=performance.now()+350;g.dx=e.clientX-g.x;draw(g);if(!motion)return;
 var distance=Math.abs(g.dx),dy=Math.abs(e.clientY-g.y);
 var flick=performance.now()-g.lastTime<90&&Math.abs(g.velocity)>.55&&distance>32&&Math.sign(g.velocity)===Math.sign(g.dx);
 settle(!!motion.next&&distance>dy*1.5&&(distance>=Math.min(100,motion.width*.24)||flick));
});
app.addEventListener('click',function(e){if(e.isTrusted&&(motion&&motion.settling||performance.now()<suppressUntil)){e.preventDefault();e.stopImmediatePropagation();}},true);
app.addEventListener('pointercancel',function(){var g=release();if(g&&g.locked){suppressUntil=performance.now()+350;settle(false);}});
app.addEventListener('lostpointercapture',function(e){if(e.target===app&&gesture){release();settle(false);}});
// Navigation, resizing, or scrolling must never commit a stale page later.
window.addEventListener('blur',cancel);window.addEventListener('resize',cancel);window.addEventListener('scroll',cancel,{passive:true});
if(window.visualViewport){visualViewport.addEventListener('resize',cancel);visualViewport.addEventListener('scroll',cancel);}
 document.addEventListener('pointerdown',function(e){if(motion&&!app.contains(e.target))cancel();},true);
})();
