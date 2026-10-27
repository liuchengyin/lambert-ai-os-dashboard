(function(){
  'use strict';
  var keys=['tasks','projects','daily_reviews_v2','reading_workspace_v2','reading_standalone_notes_v1','knowledge_link_library_v1','knowledge_link_personal_v1'];
  // Installed synchronously before the existing app scripts. A signed-in workspace
  // is activated only after the account page has prepared its isolated cache.
  var active=localStorage.getItem('lambert_active_account_v1');
  var adapter=null;
  function raw(key,fallback){var value=(window.LambertPrivateStorage||localStorage).getItem(key);return value===null?fallback:JSON.parse(value);}
  window.LambertData={
    active:active,
    syncInfo:function(){return {active:active,pending:adapter&&adapter.pending?adapter.pending().length:0,conflicts:adapter&&adapter.conflicts?adapter.conflicts().length:0};},
    install:function(value){adapter=value;},
    read:function(key,fallback){
      if(active&&key==='daily_reviews_v1')return {};
      if(active!==localStorage.getItem('lambert_active_account_v1'))throw Error('账户已切换，请刷新');
      if(active&&keys.indexOf(key)>=0){
        if(!adapter)throw Error('账户数据尚未加载，请稍后重试');
        return adapter.read(key,fallback);
      }
      return raw(key,fallback);
    },
    writeMany:function(values){
      if(active!==localStorage.getItem('lambert_active_account_v1'))throw Error('账户已切换，请刷新');
      if(active){if(!adapter)throw Error('账户尚未加载');adapter.writeMany(values);window.dispatchEvent(new Event('lambert-local-change'));return;}
      var old={};Object.keys(values).forEach(function(k){old[k]=localStorage.getItem(k);});
      try{Object.keys(values).forEach(function(k){localStorage.setItem(k,JSON.stringify(values[k]));});}
      catch(e){Object.keys(old).forEach(function(k){if(old[k]===null)localStorage.removeItem(k);else localStorage.setItem(k,old[k]);});throw e;}
    },
    write:function(key,value){
      if(active!==localStorage.getItem('lambert_active_account_v1'))throw Error('账户已切换，请刷新');
      if(active&&keys.indexOf(key)>=0){
        if(!adapter)throw Error('账户数据尚未加载，请稍后重试');
        adapter.write(key,value);window.dispatchEvent(new Event('lambert-local-change'));return;
      }
      // Legacy reviews are intentionally kept local; never import them into a different account.
      if(active&&key==='daily_reviews_v1')return;
      (window.LambertPrivateStorage||localStorage).setItem(key,JSON.stringify(value));
    }
  };
  ['write','writeMany'].forEach(function(name){var original=window.LambertData[name];window.LambertData[name]=function(){
    var args=arguments,key=name==='write'?args[0]:Object.keys(args[0]||{}).join(',');
    function report(phase,error){window.dispatchEvent(new CustomEvent('lambert-save-state',{detail:{phase:phase,key:key,code:error&&error.name,conflict:!!(error&&String(error.message).includes('冲突')),itemId:error&&error.itemId,kind:error&&error.kind}}));}
    report('saving');try{var result=original.apply(this,args);report('saved');return result;}catch(error){report('failed',error);throw error;}
  };});
})();
