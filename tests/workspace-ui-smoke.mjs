import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';

const BASE=process.env.TEST_BASE_URL||'http://127.0.0.1:8000/';
const errors=[];
const browser=await chromium.launch({headless:true});
const ctx=await browser.newContext({viewport:{width:1440,height:960}});
await ctx.addInitScript(()=>{
  if(!localStorage.getItem('projects'))localStorage.setItem('projects',JSON.stringify([
    {id:'project-test',name:'项目编辑取消测试',status:'进行中',due:'2026-10-20',standard:'保留原始完成标准',createdAt:'2026-10-10T08:00:00Z'}
  ]));
  if(!localStorage.getItem('tasks'))localStorage.setItem('tasks',JSON.stringify([
    {id:'drag-a',title:'拖动测试 A',status:'待开始',project:'项目编辑取消测试',priority:'P2',matrix:'q2',due:'',note:'',createdAt:'2026-10-10T08:00:00Z'},
    {id:'drag-b',title:'拖动测试 B',status:'进行中',project:'项目编辑取消测试',priority:'P2',matrix:'q2',due:'',note:'',createdAt:'2026-10-10T08:01:00Z'},
    {id:'drag-c',title:'拖动测试 C',status:'进行中',project:'项目编辑取消测试',priority:'P2',matrix:'q2',due:'',note:'',createdAt:'2026-10-10T08:02:00Z'}
  ]));
});
const page=await ctx.newPage();
page.on('pageerror',e=>errors.push(e.stack||e.message));
const check=(label,condition)=>{assert.ok(condition,label);console.log('PASS:',label)};
const status=async id=>page.evaluate(id=>JSON.parse(localStorage.getItem('tasks')).find(t=>t.id===id)?.status,id);
try{
  await page.goto(BASE,{waitUntil:'load'});
  await page.locator('#home .s1-head').waitFor({state:'visible'});
  check('Sprint 1 today hub loads',await page.locator('#home .s1-metrics .s1-metric').count()===4);
  await page.locator('#aiDailyCard').waitFor({state:'visible'});
  check('AI daily advisor is visible without replacing task panels',await page.locator('#aiDailyCard').count()===1);
  check('AI requires consent before sending task data',await page.locator('#aiDailyCard').innerText().then(t=>t.includes('同意发送任务摘要')));
  check('AI script does not overwrite task storage on initial load',await page.evaluate(()=>JSON.parse(localStorage.getItem('tasks')).some(t=>t.id==='drag-a')));

  check('Sprint 1 uses real task data',await page.locator('#home .s1-task').count()>0);
  check('Sprint 1 shows project and review panels',await page.locator('#home .s1-projects').count()===1&&await page.locator('#home #s1Review').count()===1);
  await page.waitForFunction(()=>document.querySelectorAll('nav .s1-nav-group').length===3);
  check('Navigation is grouped into work, growth and tools',await page.locator('nav .s1-nav-group').count()===3);

  check('Navigation keeps all eight visible page buttons',await page.locator('nav button[data-v]').count()>=8);

  check('Work group is renamed to Execution',await page.locator('nav .s1-nav-group[data-group="work"] .s1-nav-heading').innerText().then(v=>v.includes('执行区')));
  const navFonts=await page.evaluate(()=>({
    heading:parseFloat(getComputedStyle(document.querySelector('.s1-nav-heading')).fontSize),
    item:parseFloat(getComputedStyle(document.querySelector('nav button[data-v="tasks"]')).fontSize)
  }));
  check('Sidebar group heading is legible',navFonts.heading>=13);
  check('Sidebar page labels are enlarged',navFonts.item>=14.5);
  check('Group headings match navigation item font size',Math.abs(navFonts.heading-navFonts.item)<0.1);
  const expandedWidth=await page.locator('.shell>aside').evaluate(e=>e.getBoundingClientRect().width);
  const expandedMainWidth=await page.locator('main').evaluate(e=>e.getBoundingClientRect().width);
  check('Desktop collapse control is visible',await page.locator('#s1SidebarToggle').isVisible());

  check('Redundant dashboard slogan is removed',await page.locator('main>header h1').count()===0);
  check('Date remains visible in compact header',await page.locator('main>header #today').isVisible());
  const toggleStyle=await page.locator('#s1SidebarToggle').evaluate(e=>{
    const c=getComputedStyle(e);return {background:c.backgroundColor,border:c.borderTopWidth,shadow:c.boxShadow,label:e.textContent.trim()};
  });
  check('Sidebar toggle is plain chevron, without white tile',toggleStyle.label==='<'&&toggleStyle.background==='rgba(0, 0, 0, 0)'&&toggleStyle.border==='0px'&&toggleStyle.shadow==='none');

  await page.locator('#s1SidebarToggle').click();
  check('Sidebar collapses to compact icon rail',await page.locator('.shell>aside').evaluate(e=>e.getBoundingClientRect().width<=80));
  check('Main workspace expands with collapsed rail',await page.locator('main').evaluate((e,w)=>e.getBoundingClientRect().width>w+90,expandedMainWidth));
  check('Collapsed rail preserves every module icon',await page.locator('nav button[data-v] .s1-nav-icon').count()>=8);
  await page.locator('nav button[data-v="tasks"]').click();
  check('Collapsed sidebar navigation remains functional',await page.locator('#tasks').isVisible());
  await page.reload({waitUntil:'load'});
  await page.locator('#s1SidebarToggle').waitFor({state:'visible'});
  check('Sidebar collapsed state persists after refresh',await page.locator('.shell>aside').evaluate(e=>e.getBoundingClientRect().width<=80));
  await page.locator('#s1SidebarToggle').click();
  check('Sidebar expands back to original width',await page.locator('.shell>aside').evaluate((e,w)=>Math.abs(e.getBoundingClientRect().width-w)<2,expandedWidth));

  await page.locator('#s1AddTask').click();
  check('Quick task creation opens existing task form',await page.locator('#tasks').isVisible()&&await page.locator('#taskAddDetails').evaluate(e=>e.open));

  const brand=page.locator('.shell>aside .lambert-brand-icon');
  check('Selected Lambert mark is visible in sidebar',await brand.isVisible());
  check('Sidebar logo SVG has loaded',await brand.evaluate(e=>e.complete&&e.naturalWidth>0));
  check('Sidebar logo has no white background tile',await brand.evaluate(e=>getComputedStyle(e).backgroundColor==='rgba(0, 0, 0, 0)'&&getComputedStyle(e).borderTopWidth==='0px'));
  const logoSvg=await page.request.get(new URL('brand/logo-mark.svg',BASE).href);
  const logoText=await logoSvg.text();
  check('Violet logo uses a pure white rounded-square center',logoSvg.ok()&&logoText.includes('rx="12" fill="#fff"')&&logoText.includes('#8c4df1'));
  check('Browser favicon points to selected mark',await page.locator('link[rel="icon"]').getAttribute('href')==='brand/logo-mark.svg?v=purple-white-1');
  const favicon=await page.request.get(new URL('brand/logo-mark.svg',BASE).href);
  check('Favicon SVG is served correctly',favicon.ok()&&(await favicon.text()).includes('<svg'));
  const appIcon=await page.request.get(new URL('brand/app-icon.svg',BASE).href);
  check('App icon is served correctly',appIcon.ok()&&(await appIcon.text()).includes('viewBox="0 0 512 512"'));
  const manifest=await page.request.get(new URL('manifest.webmanifest',BASE).href);
  check('PWA manifest references Lambert app icon',manifest.ok()&&(await manifest.json()).icons.some(i=>i.src==='/brand/app-icon.svg'));
  await page.locator('nav button[data-v="tasks"]').click();
  await page.locator('.task-v5-card[data-task-id="drag-a"]').waitFor({state:'visible'});
  await page.waitForTimeout(350); // dashboard renders task cards asynchronously after navigation
  await page.waitForFunction(()=>document.querySelector('.task-v5-card[data-task-id="drag-a"]')?.draggable===true);
  check('Task cards are draggable',await page.locator('.task-v5-card[data-task-id="drag-a"]').evaluate(e=>e.draggable===true));
  await page.locator('[data-task-id="drag-a"]').dragTo(page.locator('.task-v5-col.doing'),{targetPosition:{x:160,y:220}});
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('tasks')).find(t=>t.id==='drag-a')?.status==='进行中');
  check('Cross-column drag persists new status',await status('drag-a')==='进行中');
  check('Dragged card moved to doing column',await page.locator('.task-v5-col.doing [data-task-id="drag-a"]').count()===1);
  await page.locator('[data-task-id="drag-a"]').dragTo(page.locator('.task-v5-col.done'),{targetPosition:{x:160,y:220}});
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('tasks')).find(t=>t.id==='drag-a')?.status==='已完成');
  check('Dragging to completed column persists',await status('drag-a')==='已完成');
  await page.reload({waitUntil:'load'});
  await page.locator('nav button[data-v="tasks"]').click();
  await page.locator('.task-v5-col.done [data-task-id="drag-a"]').waitFor({state:'visible'});
  check('Task status survives refresh',await status('drag-a')==='已完成');
  const compactHeight=await page.locator('[data-task-id="drag-a"]').evaluate(e=>e.getBoundingClientRect().height);
  const completedBefore=await page.evaluate(()=>JSON.parse(localStorage.getItem('tasks')).find(t=>t.id==='drag-a'));
  await page.locator('.task-v5-col.done [data-task-id="drag-a"]').click();
  await page.locator('#ev5Reopen').waitFor({state:'visible'});
  await page.locator('#ev5Reopen').click();
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('tasks')).find(t=>t.id==='drag-a')?.status==='进行中');
  const reopened=await page.evaluate(()=>JSON.parse(localStorage.getItem('tasks')).find(t=>t.id==='drag-a'));
  check('Completed task can return to in-progress without changing other fields',JSON.stringify(reopened)===JSON.stringify({...completedBefore,status:'进行中'}));
  await page.reload({waitUntil:'load'});
  await page.locator('nav button[data-v="tasks"]').click();
  await page.locator('.task-v5-col.doing [data-task-id="drag-a"]').waitFor({state:'visible'});
  check('Undo completion survives refresh',await status('drag-a')==='进行中');
  // Card click remains the edit entry; todo cards use a right-aligned start arrow.
  await page.locator('[data-task-id="drag-a"]').click();
  await page.locator('#ev5Status').selectOption('待开始');
  await page.locator('#ev5Save').click();
  const todoCard=page.locator('[data-task-id="drag-a"]');
  check('Task cards do not duplicate the edit entry',await page.locator('.task-v5-card button').filter({hasText:'编辑'}).count()===0);
  check('Todo start action uses an accessible edge chevron',await todoCard.getByRole('button',{name:'开始任务'}).innerText()==='>');
  const compact=await todoCard.evaluate(e=>{const card=e.getBoundingClientRect(),arrow=e.querySelector('.task-start-arrow').getBoundingClientRect();return {height:card.height,gap:card.right-arrow.right}});
  check('Todo and completed cards have the same compact height',Math.abs(compact.height-compactHeight)<2);
  check('Start chevron hugs the right edge',compact.gap>=0&&compact.gap<10);
  const quadrantColors=await todoCard.evaluate(e=>{
    const original=e.className,transition=e.style.transition,priority=e.style.getPropertyPriority('transition'),colors={};e.style.setProperty('transition','none','important');
    for(const q of ['q1','q2','q3','q4']){e.className='task-v5-card '+q;const s=getComputedStyle(e);colors[q]={border:s.borderTopColor,shadow:s.boxShadow,sides:[s.borderTopColor,s.borderRightColor,s.borderBottomColor,s.borderLeftColor]}}
    e.className=original;e.style.setProperty('transition',transition,priority);return colors;
  });
  for(const [q,color] of Object.entries({q1:'rgb(231, 140, 140)',q2:'rgb(141, 174, 232)',q3:'rgb(229, 177, 106)',q4:'rgb(182, 189, 199)'})){
    check(q+' surrounds the card with its quadrant color',quadrantColors[q].sides.every(x=>x===color)&&quadrantColors[q].shadow!=='none');
  }
  await todoCard.getByRole('button',{name:'开始任务'}).click();
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('tasks')).find(t=>t.id==='drag-a')?.status==='进行中');
  check('Start arrow moves the task to in-progress',await status('drag-a')==='进行中');
  const doingCard=page.locator('[data-task-id="drag-a"]');
  check('In-progress card is compact and has no return button',Math.abs(await doingCard.evaluate(e=>e.getBoundingClientRect().height)-compactHeight)<2&&await doingCard.getByRole('button',{name:'退回',exact:true}).count()===0);
  await doingCard.click();
  await page.getByRole('button',{name:'退回待开始',exact:true}).click();
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('tasks')).find(t=>t.id==='drag-a')?.status==='待开始');
  check('Return from in-progress is available inside editing',await status('drag-a')==='待开始');
  await page.locator('[data-task-id="drag-a"]').getByRole('button',{name:'开始任务'}).click();
  await page.locator('[data-task-id="drag-b"]').dragTo(page.locator('[data-task-id="drag-c"]'),{targetPosition:{x:120,y:5}});
  await page.waitForTimeout(250);
  const order=await page.evaluate(()=>JSON.parse(localStorage.getItem('task_drag_order_v1')));
  check('In-column reorder is saved',Array.isArray(order)&&order.includes('drag-b')&&order.includes('drag-c'));
  await page.locator('nav button[data-v="projects"]').click();
  await page.locator('.project-card-actions button').filter({hasText:'编辑'}).first().click();
  await page.locator('#projectEditDlg[open]').waitFor({state:'visible'});
  check('Project dialog has a visible X cancel',await page.locator('#projectEditClose').isVisible());
  await page.locator('#projectEditName').fill('不应该保存的修改');
  await page.locator('#projectEditClose').click();
  check('X closes project dialog',await page.locator('#projectEditDlg').evaluate(e=>!e.open));
  const projectName=await page.evaluate(()=>JSON.parse(localStorage.getItem('projects'))[0].name);
  check('X cancel leaves original project data untouched',projectName==='项目编辑取消测试');
  await page.locator('nav button[data-v="review"]').click();
  await page.locator('#rv6Goal').waitFor({state:'visible'});
  check('Daily review uses goal-result-improvement layout',await page.locator('.review-v7-steps').isVisible());
  const goalSpan=await page.locator('.review-v6-goal').evaluate(e=>getComputedStyle(e).gridColumnStart);
  check('Daily goal is full-width top section',goalSpan==='1');
  await page.locator('#rv6Goal').fill('今天完成一个清晰目标');
  await page.locator('#rv6Restart').fill('明天先做五分钟');
  await page.locator('#rv6Save').click();
  const reviews=await page.evaluate(()=>JSON.parse(localStorage.getItem('daily_reviews_v2')));
  check('Existing daily review storage still works',Object.values(reviews).some(r=>r.goal==='今天完成一个清晰目标'&&r.restart==='明天先做五分钟'));
  for(const [view,nav] of [['home','home'],['projects','projects'],['tasks','tasks'],['review','review'],['writing','writing'],['reading','reading']]){
    await page.locator('nav button[data-v="'+nav+'"]').click();
    await page.waitForTimeout(100);
    const bg=await page.locator('#'+view).evaluate(e=>getComputedStyle(e).backgroundImage);
    check(view+' uses shared pastel background',bg.includes('radial-gradient'));
  }
  check('Common links still available',await page.locator('nav button[data-v="knowledge"]').count()===1);
  // Keep reviewable visual snapshots from the same isolated demo data.
  mkdirSync('tests/screenshots',{recursive:true});
  await page.locator('nav button[data-v="home"]').click();
  await page.locator('.shell>aside').screenshot({path:'tests/screenshots/lambert-sidebar-logo.png'});
  await page.locator('#s1SidebarToggle').click();
  await page.locator('.shell>aside').screenshot({path:'tests/screenshots/sidebar-collapsed.png'});
  await page.locator('#s1SidebarToggle').click();
  for(const [view,name] of [['home','overview'],['projects','projects'],['tasks','tasks'],['review','review']]){
    await page.locator('nav button[data-v="'+view+'"]').click();
    await page.screenshot({path:'tests/screenshots/'+name+'-desktop.png',fullPage:true});
  }
  await page.setViewportSize({width:390,height:844});
  check('Mobile menu button is visible',await page.locator('.s1-mobile-nav-toggle').isVisible());
  check('Desktop rail control stays hidden on mobile',await page.locator('#s1SidebarToggle').isHidden());
  await page.locator('.s1-mobile-nav-toggle').click();
  check('Mobile menu expands on demand',await page.locator('.shell>aside').evaluate(e=>e.classList.contains('s1-mobile-open')));
  await page.locator('.s1-mobile-nav-toggle').click();
  check('Mobile menu collapses after toggle',await page.locator('.shell>aside').evaluate(e=>!e.classList.contains('s1-mobile-open')));
  await page.locator('.s1-mobile-nav-toggle').click();
  await page.locator('nav button[data-v="review"]').click();
  const mobileColumns=await page.locator('.review-v6-workspace').evaluate(e=>getComputedStyle(e).gridTemplateColumns.trim().split(/\s+/).length);
  check('Review switches to one column on mobile',mobileColumns===1);
  const reviewOverflow=await page.locator('#review').evaluate(e=>e.scrollWidth-e.clientWidth);
  check('Mobile review has no horizontal overflow',reviewOverflow<=5);
  await page.screenshot({path:'tests/screenshots/review-mobile.png',fullPage:true});
  check('No uncaught JavaScript errors',errors.length===0);
  console.log('Workspace UI smoke passed.');
}catch(e){
  console.error('Workspace UI smoke failed:',e.stack);
  console.error('Browser errors:',errors);
  await page.screenshot({path:'workspace-ui-smoke-failure.png',fullPage:true}).catch(()=>{});
  process.exitCode=1;
}finally{await browser.close()}
