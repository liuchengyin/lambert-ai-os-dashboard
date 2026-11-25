// Uses the controller credential only; it never enters the test process or model context.
export async function publish(t,workspace,{env=process.env,fetcher=fetch}={}) {
 const token=env.STUDIO_GITHUB_TOKEN;if(!token)throw Error('github_not_configured');
 const root='https://api.github.com/repos/liuchengyin/lambert-ai-os-dashboard';
 async function api(route,method='GET',body){const r=await fetcher(root+route,{method,redirect:'error',signal:AbortSignal.timeout(15000),headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json','Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});if(!r.ok)throw Error('github_request_failed');return r.json();}
 const head='feat/web-studio-'+t.id;
 // Look up the unique task branch before creating any externally visible objects.
 const refs=await api('/git/matching-refs/heads/'+head);const existing=refs.find(r=>r.ref==='refs/heads/'+head);
 if(!existing){
  const base=await api('/git/commits/'+t.baseCommit);
  const tree=await api('/git/trees','POST',{base_tree:base.tree.sha,tree:await Promise.all(t.files.map(async p=>({path:p,mode:'100644',type:'blob',content:(await workspace.read(t,p)).content})))});
  const commit=await api('/git/commits','POST',{message:'AI Studio task '+t.id,tree:tree.sha,parents:[t.baseCommit]});
  await api('/git/refs','POST',{ref:'refs/heads/'+head,sha:commit.sha});
 }else{
  const commit=await api('/git/commits/'+existing.object.sha);if(commit.message!=='AI Studio task '+t.id||commit.parents?.length!==1||commit.parents[0].sha!==t.baseCommit)throw Error('remote_branch_changed');
  const tree=await api('/git/trees/'+commit.tree.sha+'?recursive=1');
  // Refuse to overwrite a branch somebody else changed; a retry is safe only for identical contents.
  for(const p of t.files){const entry=tree.tree.find(x=>x.path===p);if(!entry)throw Error('remote_branch_changed');const blob=await api('/git/blobs/'+entry.sha);if(Buffer.from(blob.content.replace(/\s/g,''),'base64').toString('utf8')!==(await workspace.read(t,p)).content)throw Error('remote_branch_changed');}
 }
 const prs=await api('/pulls?state=all&head=liuchengyin:'+head);if(prs.length)return {url:prs[0].html_url,reused:true};
 const pr=await api('/pulls','POST',{head,base:env.STUDIO_PR_BASE||'main',title:'AI Studio: '+t.goal.slice(0,80),draft:true,body:'Task '+t.id+'\n\nGoal: '+t.goal+'\n\nAcceptance: '+t.acceptance+'\n\nAutomated workspace tests completed before export. Review this draft before merging. No production deployment.'});return {url:pr.html_url,reused:false};
}
