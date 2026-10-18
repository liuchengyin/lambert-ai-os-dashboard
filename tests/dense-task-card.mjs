import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync('task-center.js','utf8');
const helper=source.slice(source.indexOf('function compactTaskDates('),source.indexOf('function taskExpanded('));
const format=vm.runInNewContext('('+helper.trim()+')');
assert.equal(format({start:'2026-10-18T09:09',due:'2026-10-18T13:05'}),'10月18日 09:09—10月18日 13:05');
assert.equal(format({start:'2026-10-18',due:'2027-01-02'}),'10月18日—1月2日');
assert.equal(format({due:'2026-10-18T13:05'}),'待定—10月18日 13:05');
assert.equal(format({}),'待排期');
assert.equal(format({start:'2026-02-30',due:'bad'}),'待定—待定');
assert.equal(format({start:'2026-10-18T29:05'}),'待定—待定');
const browser=await chromium.launch(),ctx=await browser.newContext({viewport:{width:1440,height:1000}}),errors=[];
await ctx.addInitScript(()=>{if(localStorage.dense_fixture)return;localStorage.dense_fixture='1';localStorage.projects=JSON.stringify([{id:'p',name:'紧凑卡片项目',status:'进行中',category:'健康'}]);localStorage.tasks=JSON.stringify([{id:'dense',title:'完成履约数据分析并输出结果',projectId:'p',project:'紧凑卡片项目',status:'待开始',matrix:'q2',priority:'P3',labels:['健康','工作','个人'],start:'2026-10-18T09:09',due:'2026-10-18T13:05',note:'第一行备注\n第二行备注\n第三行保留但不占高度 <img src=x onerror=alert(1)> https://example.com/verylong'.repeat(4),custom:'keep'}]);localStorage.task_center_preferences_v1=JSON.stringify({projectId:'p',view:'board'});});
const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));
try{
 await p.goto(process.env.TEST_BASE_URL||'http://127.0.0.1:8000/');await p.locator('nav button[data-v=tasks]').click();const card=p.locator('[data-tc-task=dense]');
 assert.equal(await card.locator('.tc-task-dates').textContent(),'10月18日 09:09—10月18日 13:05');
 assert.ok((await card.locator('.tc-task-dates').getAttribute('title')).includes('2026'));
 assert.equal(await card.locator('summary .tc-card-badges .tc-tag').count(),3);assert.equal(await card.locator('.tc-task-body .tc-tag').count(),0);
 assert.equal(await card.locator('.tc-task-note img').count(),0);assert.ok(await card.locator('.tc-task-note').evaluate(e=>e.clientHeight<=parseFloat(getComputedStyle(e).lineHeight)*2+1));
 const checkLayout=async()=>{const b=await card.evaluate(e=>{const d=e.querySelector('.tc-task-dates').getBoundingClientRect(),a=e.querySelector('.tc-advance').getBoundingClientRect(),b=e.getBoundingClientRect(),s=e.querySelector('summary').getBoundingClientRect();return {d:{top:d.top,right:d.right,bottom:d.bottom},a:{top:a.top,left:a.left,right:a.right,bottom:a.bottom},b:{left:b.left,right:b.right,height:b.height},s:{right:s.right}}});assert.ok(b.a.left>=b.d.right-1,'advance sits to right of dates');assert.ok(b.a.right<=b.b.right&&b.a.top<b.d.bottom,'advance shares footer row');assert.ok(b.b.height<145,'card remains compact');};
 await checkLayout();mkdirSync('tests/screenshots',{recursive:true});await p.screenshot({path:'tests/screenshots/dense-tasks-desktop.png',fullPage:true});await p.setViewportSize({width:400,height:850});await checkLayout();assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await p.screenshot({path:'tests/screenshots/dense-tasks-mobile.png',fullPage:true});
 await card.locator('.tc-task-title').click();await p.locator('#tcEditor[open]').waitFor();await p.locator('#tcCancel').click();await card.locator('.tc-fold').click();assert.equal(await card.locator('details').evaluate(e=>e.open),false);await card.locator('.tc-fold').click();await card.locator('.tc-advance').click();
 const t=await p.evaluate(()=>JSON.parse(localStorage.tasks)[0]);assert.equal(t.status,'进行中');assert.equal(t.start,'2026-10-18T09:09');assert.equal(t.due,'2026-10-18T13:05');assert.equal(t.custom,'keep');assert.ok(t.note.includes('第三行'));assert.deepEqual(errors,[]);
 console.log('PASS compact dates without year, labels beside priority, clamped safe notes, footer advance, mobile and preserved data/actions');
}finally{await browser.close();}
