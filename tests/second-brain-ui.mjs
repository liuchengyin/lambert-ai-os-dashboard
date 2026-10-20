// Run with: TEST_BASE_URL=http://127.0.0.1:8000/ node tests/second-brain-ui.mjs
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:8000/';
const browser = await chromium.launch({headless:true});
const ctx = await browser.newContext({viewport:{width:1366,height:900},acceptDownloads:true});
const initial = {
  projects:[{id:'p-second-brain',name:'第二大脑测试项目',status:'进行中',standard:'保持旧数据'}],
  tasks:[{id:'t-second-brain',title:'原始任务不可改',status:'待开始',project:'第二大脑测试项目',priority:'P2',due:'',note:'原始隐私备注',createdAt:'2026-10-19T00:00:00Z'}],
  reviews:{'2026-10-19':{goal:'完成原始任务',taskIds:['t-second-brain'],gap:'需要稳步开发'}},
  notes:[{id:'old-note',title:'已有笔记',body:'不能丢',category:'知识',projectId:'',createdAt:'2026-10-19T00:00:00Z',extra:'扩展字段'}]
};
await ctx.addInitScript(fixture=>{
  for(const [key,rows] of Object.entries({
    projects:fixture.projects,tasks:fixture.tasks,daily_reviews_v2:fixture.reviews,lambert_brain_notes_v1:fixture.notes
  })){if(localStorage.getItem(key)===null)localStorage.setItem(key,JSON.stringify(rows))}
},initial);
const page = await ctx.newPage();
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
const get = key => page.evaluate(key => localStorage.getItem(key),key);
const pass=(name,good)=>{assert.ok(good,name);console.log('PASS:',name)};

try {
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.locator('nav button[data-v="brain"]').click();
  await page.locator('#brainStats .brain-stat').first().waitFor();
  pass('Second Brain navigation visible',await page.locator('#brain').isVisible());
  pass('Read-only projects and tasks indexed',await page.locator('.brain-stat strong').nth(2).textContent()==='1'
    && await page.locator('.brain-stat strong').nth(3).textContent()==='1');
  const original = Object.fromEntries(await Promise.all(['projects','tasks','daily_reviews_v2'].map(async k=>[k,await get(k)])));
  pass('Explicit task/review edges shown',await page.locator('#brainGraph .brain-svg-edge').count()>=2);

  await page.locator('#brainNew').click();
  await page.locator('#brainNoteTitle').fill('新建节点');
  await page.locator('#brainNoteCategory').selectOption('知识');
  await page.locator('#brainNoteProject').selectOption('p-second-brain');
  await page.locator('#brainNoteBody').fill('新写入的知识，不触碰项目');
  await page.locator('#brainForm button[type="submit"]').click();
  pass('New note persisted independently',await page.evaluate(()=>JSON.parse(localStorage.getItem('lambert_brain_notes_v1')).length===2));
  pass('New note connected to correct project',await page.locator('#brainDetail .brain-related').count()>=1);

  await page.locator('#brainDetail .brain-edit').click();
  await page.locator('#brainNoteTitle').fill('更新后的节点');
  await page.locator('#brainForm button[type="submit"]').click();
  pass('Editing updates existing note, not a duplicate',await page.evaluate(()=>{
    const notes=JSON.parse(localStorage.getItem('lambert_brain_notes_v1'));
    return notes.length===2 && notes.filter(n=>n.title==='更新后的节点').length===1;
  }));

  await page.locator('#brainSearch').fill('更新后的节点');
  pass('Search filters notes',await page.locator('#brainResults .brain-result').count()===1);
  await page.locator('#brainSearch').fill('');
  await page.locator('.brain-filter').filter({hasText:'笔记'}).click();
  pass('Type filter limits to notes',await page.locator('#brainResults .brain-result').count()===2);

  const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#brainExport').click()]);
  const backup=JSON.parse(await readFile(await download.path(),'utf8'));
  pass('JSON backup includes both notes and custom fields',backup.notes.length===2
    &&backup.notes.some(n=>n.id==='old-note'&&n.extra==='扩展字段')
    &&backup.format==='lambert-ai-os-second-brain-notes');

  const after=Object.fromEntries(await Promise.all(['projects','tasks','daily_reviews_v2'].map(async k=>[k,await get(k)])));
  pass('Existing project/task/review storage unchanged by brain operations',
    Object.keys(original).every(k=>original[k]===after[k]));
  await page.reload({waitUntil:'domcontentloaded'});
  pass('Refresh restores Second Brain tab',await page.locator('#brain').isVisible());
  pass('Notes survive refresh',await page.locator('#brainResults').getByText('更新后的节点').count()===1);
  await page.setViewportSize({width:390,height:844});
  pass('Mobile view exposes Brain controls',await page.locator('#brainNew').count()===1 && await page.locator('#brainExport').count()===1);
  pass('No page execution errors',errors.length===0);
} finally {
  await browser.close();
}
