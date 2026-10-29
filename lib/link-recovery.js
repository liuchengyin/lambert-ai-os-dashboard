/* Common-link recovery: read-only discovery, non-destructive merging, no network. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.LambertLinkRecovery=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const KEYS=['knowledge_link_library_v1','knowledge_link_personal_v1'];
 const isObject=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
 const decode=x=>{try{return typeof x==='string'?JSON.parse(x):x}catch{return null}};
 const validGroups=value=>Array.isArray(value)&&value.every(g=>isObject(g)&&typeof g.name==='string'&&Array.isArray(g.links));
 const meaningful=value=>validGroups(value)&&value.some(g=>g.links.some(l=>isObject(l)&&typeof l.url==='string'&&l.url.trim()));
 function findSources(storage,owner){
   const sources=[],seen=new Set();
   const put=(key,value,origin)=>{
     const val=decode(value);
     if(!meaningful(val))return;
     const signature=JSON.stringify([key,val]);
     if(seen.has(signature))return;
     seen.add(signature);
     sources.push({key,origin,groups:val});
   };
   KEYS.forEach(key=>{
     put(key,storage.getItem(key),'本机未登录时保存的旧链接');
     if(owner)put(key,storage.getItem('lambert_private_v1:'+owner+':'+key),'当前账号旧版本机存储');
   });
   for(let i=0;i<storage.length;i++){
     const storageKey=storage.key(i);
     if(!storageKey?.startsWith('lambert_backup_v2:'))continue;
     const backup=decode(storage.getItem(storageKey));
     if(!isObject(backup)||backup.format!=='lambert-local-backup-v2')continue;
     if(backup.account&&backup.account.userId!==owner)continue;
     for(const key of KEYS){
       // Only a guest backup or backup tied to the currently selected owner.
       if(!backup.account)put(key,backup.raw?.[key],'本机历史备份');
       if(owner&&backup.account?.userId===owner){
         put(key,backup.account.snapshot?.[key],'当前账号历史备份');
         put(key,backup.account.rawStorage?.['lambert_private_v1:'+owner+':'+key],'当前账号旧本机备份');
       }
     }
   }
   return sources;
 }
 function merge(current,sources,key){
   if(current!==null&&!validGroups(current))throw Error('当前链接库格式异常，已停止保护数据');
   const result=structuredClone(current||[]),usedIds=new Set(),usedUrls=new Set();
   for(const group of result)for(const link of group.links){
     if(isObject(link)&&typeof link.id==='string')usedIds.add(link.id);
     if(isObject(link)&&typeof link.url==='string')usedUrls.add(link.url.trim());
   }
   const usedGroups=new Set(result.map(g=>g.id)),ids={group:0,link:0};
   const nextId=(kind,set)=>{
     let id;
     do{id='restored_'+kind+'_'+(++ids[kind]);}while(set.has(id));
     set.add(id);return id;
   };
   let addedLinks=0,addedGroups=0;
   for(const source of sources){
     if(source.key!==key)continue;
     for(const old of source.groups){
       if(!isObject(old)||!Array.isArray(old.links)||typeof old.name!=='string')continue;
       const candidates=old.links.filter(l=>isObject(l)&&typeof l.url==='string'&&l.url.trim()&&!usedUrls.has(l.url.trim()));
       if(!candidates.length)continue;
       let target=result.find(g=>g.name===old.name);
       if(!target){
         target={...structuredClone(old),links:[]};
         if(typeof target.id!=='string'||usedGroups.has(target.id))target.id=nextId('group',usedGroups);
         else usedGroups.add(target.id);
         result.push(target);addedGroups++;
       }
       for(const link of candidates){
         const url=link.url.trim();
         if(usedUrls.has(url))continue;
         const next=structuredClone(link);
         if(typeof next.id!=='string'||usedIds.has(next.id))next.id=nextId('link',usedIds);
         else usedIds.add(next.id);
         target.links.push(next);usedUrls.add(url);addedLinks++;
       }
     }
   }
   return {groups:result,addedLinks,addedGroups};
 }
 function preview(currentByKey,sources){
   const updates={},count={};
   for(const key of KEYS){
     const result=merge(currentByKey[key]??null,sources,key);
     updates[key]=result.groups;count[key]={links:result.addedLinks,groups:result.addedGroups};
   }
   return {updates,count,total:KEYS.reduce((n,k)=>n+count[k].links,0)};
 }
 return Object.freeze({KEYS,validGroups,findSources,merge,preview});
});
