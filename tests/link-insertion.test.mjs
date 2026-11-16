import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync(new URL('../knowledge-links.js',import.meta.url),'utf8');
const start=source.indexOf('  function insertLink('),end=source.indexOf('  function commitLinkMove(',start);
const move=runInNewContext(source.slice(start,end)+';insertLink');
const original=()=>[{id:'a',extra:'keep',links:['A','B','C','D'].map(id=>({id,url:'https://example.com/'+id,unknown:{keep:true}}))},{id:'b',links:[{id:'E'}]},{id:'empty',links:[]}];
const order=(list,id='a')=>Array.from(list.find(g=>g.id===id).links,l=>l.id).join('');
test('forward insertion shifts intervening cards instead of exchanging endpoints',()=>{const list=original(),next=move(list,'a','A','a','D');assert.equal(order(next),'BCAD');assert.equal(order(list),'ABCD');assert.equal(next[0].links[2],list[0].links[0]);assert.equal(next[0].extra,'keep');});
test('backward insertion shifts cards and preserves every bookmark',()=>{assert.equal(order(move(original(),'a','D','a','B')),'ADBC');});
test('append supports moving to the end of a row/group',()=>{assert.equal(order(move(original(),'a','A','a',null)),'BCDA');});
test('cross-group insertion keeps destination cards and removes the source once',()=>{const next=move(original(),'a','B','b','E');assert.equal(order(next),'ACD');assert.equal(order(next,'b'),'BE');});
test('empty groups accept a moved bookmark',()=>{const next=move(original(),'a','C','empty',null);assert.equal(order(next),'ABD');assert.equal(order(next,'empty'),'C');});
test('stale target or source is a no-op',()=>{for(const args of [['a','X','b','E'],['a','A','b','X'],['a','A','missing',null]])assert.equal(move(original(),...args),null);});
test('self and adjacent placements do not trigger redundant saves',()=>{assert.equal(move(original(),'a','A','a','A'),null);assert.equal(move(original(),'a','A','a','B'),null);assert.equal(move(original(),'a','D','a',null),null);});
// Exercise the actual pointer handlers with minimal DOM doubles. This is not a real-browser touch test.
function pointerFixture(){
 const list=original(),saved=[],listeners=new Map(),classes=()=>({add(){},remove(){}});
 const root={contains:()=>true,querySelectorAll:()=>[]};
 const sec={dataset:{groupId:'a'},classList:classes()};
 const target={dataset:{linkId:'D'},classList:classes(),getBoundingClientRect:()=>({left:200,top:100,width:100,height:100,bottom:200})};
 const hit={closest:selector=>selector==='.knowledge-group'?sec:selector==='.knowledge-link-card'?target:null};
 let capture=false,handle;
 const document={createElement:()=>handle={setAttribute(){},setPointerCapture(){capture=true;},hasPointerCapture:()=>capture,releasePointerCapture(){capture=false;}},addEventListener:(k,fn)=>listeners.set(k,fn),removeEventListener:k=>listeners.delete(k),elementFromPoint:()=>hit};
 const context={document,root,groups:list,locked:false,linkDrag:null,host:()=>'',window:{innerHeight:900,scrollBy(){}},commitLinkMove:(...args)=>saved.push(args)};
 const a=source.indexOf('  function addMoveHandle('),b=source.indexOf('  function addTile(',a);
 const mount=runInNewContext(source.slice(a,b)+';addMoveHandle',context);
 const card={dataset:{},classList:classes(),append(){}};mount(card,list[0],list[0].links[0]);
 const event=(x,y)=>({pointerId:1,button:0,clientX:x,clientY:y,preventDefault(){},stopPropagation(){}});
 return {handle,event,saved,listeners};
}
test('grip press then drag commits an insertion boundary once',()=>{const f=pointerFixture();f.handle.onpointerdown(f.event(0,0));f.handle.onpointermove(f.event(220,150));f.handle.onpointerup(f.event(220,150));assert.equal(f.saved.length,1);assert.deepEqual(Array.from(f.saved[0]),['a','A','a','D']);});
test('click without movement, cancellation and Escape never write',()=>{for(const mode of ['click','cancel','escape']){const f=pointerFixture();f.handle.onpointerdown(f.event(0,0));if(mode!=='click')f.handle.onpointermove(f.event(220,150));if(mode==='cancel')f.handle.onpointercancel();else if(mode==='escape')f.listeners.get('keydown')({key:'Escape',preventDefault(){}});else f.handle.onpointerup(f.event(0,0));assert.equal(f.saved.length,0);}});
