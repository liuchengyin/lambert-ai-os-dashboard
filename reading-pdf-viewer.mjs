// Adapted from DeepSeek's scheduler draft; fixed placeholders, cancellation and scroll tracking.
export function createPdfViewer({shell,onPage=()=>{},onError=()=>{}}){
 let pdf=null,mode='single',current=1,epoch=0,task=null,work=null,queue=[],wanted=new Set(),frame=0;
 let slotHeight=0,slotWidth=0,slots=new Map(),canvases=new Map(),width=0,layoutPending=false;
 const clamp=n=>Math.min(pdf.numPages,Math.max(1,Math.floor(Number(n))||1));
 const alive=(stamp,doc)=>stamp===epoch&&pdf===doc;
 const cancel=()=>{epoch++;task?.cancel();queue=[];wanted.clear();cancelAnimationFrame(frame);};
 function announce(n){if(n!==current){current=n;onPage(n);}}
 function resetCanvas(canvas){canvas.remove();canvas.width=0;canvas.height=0;}
 function clear(){for(const c of canvases.values())resetCanvas(c);canvases.clear();slots.clear();shell.replaceChildren();}
 function schedule(){
  if(!pdf||layoutPending)return;
  const range=mode==='single'?[current]:Array.from({length:5},(_,i)=>current+i-2).filter(n=>n>=1&&n<=pdf.numPages);
  wanted=new Set(range);
  for(const [n,c] of canvases)if(!wanted.has(n)){
   // A rendering canvas is released by its own finally block after cancellation settles.
   if(c.dataset.rendering==='true'){task?.cancel();continue;}
   resetCanvas(c);canvases.delete(n);
  }
  queue=range.sort((a,b)=>Math.abs(a-current)-Math.abs(b-current)).filter(n=>!canvases.has(n));
  if(!work){work=drain().finally(()=>{work=null;if(queue.length&&pdf&&!layoutPending)schedule();});}
 }
 async function drain(){
  while(pdf&&queue.length&&!layoutPending){
   const n=queue.shift(),stamp=epoch,doc=pdf,slot=slots.get(n);
   if(!slot||!wanted.has(n)||canvases.has(n))continue;
   let canvas,render;
   try{
    const page=await doc.getPage(n);
    if(!alive(stamp,doc)||!wanted.has(n)||slots.get(n)!==slot)continue;
    const base=page.getViewport({scale:1});
    const scale=Math.min(2,slotWidth/base.width,slotHeight/base.height),viewport=page.getViewport({scale});
    const ratio=Math.min(2,globalThis.devicePixelRatio||1);
    canvas=document.createElement('canvas');canvas.className='book-page-canvas';canvas.dataset.rendering='true';
    canvas.setAttribute('aria-label',`第 ${n} 页`);if(mode==='single')canvas.id='bookCanvas';
    canvas.width=Math.ceil(viewport.width*ratio);canvas.height=Math.ceil(viewport.height*ratio);
    canvas.style.width=`${viewport.width}px`;canvas.style.height=`${viewport.height}px`;
    slot.append(canvas);canvases.set(n,canvas);
    render=page.render({canvasContext:canvas.getContext('2d'),viewport,transform:ratio===1?undefined:[ratio,0,0,ratio,0,0]});task=render;
    await render.promise;
    if(alive(stamp,doc)&&wanted.has(n)&&slots.get(n)===slot){canvas.dataset.rendering='false';slot.dataset.rendered='true';}
    else{resetCanvas(canvas);if(canvases.get(n)===canvas)canvases.delete(n);}
   }catch(e){
    if(canvas){resetCanvas(canvas);if(canvases.get(n)===canvas)canvases.delete(n);}
    if(alive(stamp,doc)&&e.name!=='RenderingCancelledException')onError(e);
   }finally{if(task===render)task=null;}
  }
 }
 async function layout(page){
  cancel();layoutPending=true;const stamp=epoch,doc=pdf;
  if(work)await work;
  if(!alive(stamp,doc))return;
  clear();
  const first=await doc.getPage(page);if(!alive(stamp,doc))return;
  const base=first.getViewport({scale:1});
  width=shell.clientWidth;slotWidth=Math.max(1,width-32);slotHeight=Math.round(slotWidth*base.height/base.width);
  shell.dataset.mode=mode;
  const numbers=mode==='single'?[page]:Array.from({length:doc.numPages},(_,i)=>i+1);
  const fragment=document.createDocumentFragment();
  for(const n of numbers){
   const el=document.createElement('div');el.className='book-pdf-page';el.dataset.page=String(n);
   el.style.height=`${slotHeight}px`;el.setAttribute('aria-label',`第 ${n} 页`);
   slots.set(n,el);fragment.append(el);
  }
  shell.append(fragment);current=page;layoutPending=false;
  shell.scrollTop=mode==='continuous'?Math.max(0,slots.get(page).offsetTop-16):0;
  onPage(page);schedule();await work;
 }
 function scroll(){
  if(!pdf||mode!=='continuous'||layoutPending)return;
  cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{
   if(!pdf||mode!=='continuous'||layoutPending)return;
   // All page slots remain in the document; only nearby canvas pixels are retained.
   const target=shell.scrollTop+Math.min(shell.clientHeight*.4,slotHeight*.4);
   const page=clamp(Math.floor(Math.max(0,target-16)/(slotHeight+16))+1);
   announce(page);schedule();
  });
 }
 shell.addEventListener('scroll',scroll,{passive:true});
 async function resize(){
  if(!pdf||layoutPending||shell.hidden||!shell.clientWidth||Math.abs(shell.clientWidth-width)<2)return;
  try{await layout(current);}catch(e){onError(e);}
 }
 const observer=new ResizeObserver(()=>{void resize();});observer.observe(shell);
 return {
  async open(doc,page=1,nextMode='single'){pdf=doc;mode=nextMode==='continuous'?'continuous':'single';await layout(clamp(page));},
  async goTo(value){
   if(!pdf)return;const page=clamp(value);
   if(mode==='single'){await layout(page);return;}
   announce(page);shell.scrollTop=Math.max(0,slots.get(page).offsetTop-16);schedule();await work;
  },
  async setMode(next){if(!pdf)return;mode=next==='continuous'?'continuous':'single';await layout(current);},
  resize,
  close(){cancel();pdf=null;layoutPending=false;const pending=work;void Promise.resolve(pending).then(()=>{if(!pdf)clear();});},
  destroy(){this.close();observer.disconnect();shell.removeEventListener('scroll',scroll);}
 };
}
