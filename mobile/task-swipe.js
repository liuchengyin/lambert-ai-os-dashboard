(function(){
  var OPEN=280/3,TH=36,cur=null;
  function wrap(row,title,onDelete){
    var w=document.createElement('div');w.className='task-swipe';
    var b=document.createElement('button');b.className='task-swipe-delete';b.type='button';
    b.textContent='删除';b.setAttribute('aria-label','删除：'+title);b.hidden=true;b.tabIndex=-1;
    row.classList.add('task-swipe-front');
    w.appendChild(row);w.appendChild(b);
    var st={w:w,row:row,btn:b,open:false,dx:0,id:null,sx:0,sy:0,cap:false,sup:false};
    function setX(x,anim){row.style.transition=anim?'transform .2s':'none';row.style.transform='translateX('+x+'px)';}
    function open(){if(cur&&cur!==st)close(cur);st.open=true;st.btn.hidden=false;st.btn.tabIndex=0;setX(-OPEN,true);cur=st;}
    function close(s){s=s||st;if(s!==st){s.close();return;}s.open=false;setX(0,true);s.btn.hidden=true;s.btn.tabIndex=-1;if(cur===s)cur=null;}
    st.close=close;st.openFn=open;
    row.addEventListener('pointerdown',function(e){
      if(e.pointerType==='mouse'&&e.button!==0)return;
      st.id=e.pointerId;st.sx=e.clientX;st.sy=e.clientY;st.dx=0;st.cap=false;st.sup=false;
    });
    row.addEventListener('pointermove',function(e){
      if(e.pointerId!==st.id)return;
      var dx=e.clientX-st.sx,dy=e.clientY-st.sy;
      if(!st.cap){
        if(Math.abs(dx)>10&&Math.abs(dx)>Math.abs(dy)*1.3){
          st.cap=true;st.sup=true;st.btn.hidden=false;w.classList.add('swipe-dragging');row.setPointerCapture(e.pointerId);
          if(cur&&cur!==st)close(cur);
        }else if(Math.abs(dy)>10){st.id=null;return;}
        else return;
      }
      var base=st.open?-OPEN:0;
      st.dx=Math.max(-OPEN,Math.min(0,base+dx));
      setX(st.dx,false);
    });
    function end(e){
      if(e.pointerId!==st.id)return;
      st.id=null;w.classList.remove('swipe-dragging');
      if(!st.cap)return;
      st.cap=false;
      var d=st.dx;
      if(d<=-TH)open();else close();
      st.dx=0;
    }
    row.addEventListener('pointerup',end);
    row.addEventListener('pointercancel',function(e){
      if(e.pointerId!==st.id)return;st.id=null;w.classList.remove('swipe-dragging');
      if(st.cap){st.cap=false;if(st.open)open();else close();st.dx=0;}
    });
    row.addEventListener('click',function(e){
      if(st.sup){st.sup=false;e.stopPropagation();e.preventDefault();return;}
      if(st.open){e.stopPropagation();e.preventDefault();close();}
    },true);
    b.addEventListener('click',function(e){
      e.stopPropagation();
      try{onDelete();}catch(err){alert('删除失败：'+(err&&err.message||err));return;}
      close();
    });
    w.addEventListener('keydown',function(e){
      var t=e.target;
      if(t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.isContentEditable))return;
      if(e.key==='ArrowLeft'){e.preventDefault();open();}
      else if(e.key==='Escape'||e.key==='ArrowRight'){if(st.open){e.preventDefault();close();}}
    });
    return w;
  }
  function close(s){if(s&&s.close)s.close();}
  var bound=false;
  function bindDoc(){
    if(bound)return;bound=true;
    document.addEventListener('pointerdown',function(e){
      if(!cur)return;
      if(cur.w.contains(e.target))return;
      close(cur);
    },true);
    document.addEventListener('scroll',function(){if(cur)close(cur);},true);
  }
  bindDoc();
  window.MobileTaskSwipe={wrap:wrap};
})();
