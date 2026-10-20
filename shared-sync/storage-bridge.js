(function(){
  'use strict';
  var keys=['tasks','projects','daily_reviews_v2'];
  // Installed synchronously before the existing app scripts. A signed-in workspace
  // is activated only after the account page has prepared its isolated cache.
  var active=localStorage.getItem('lambert_active_account_v1');
  var adapter=null;
  function raw(key,fallback){var value=localStorage.getItem(key);return value===null?fallback:JSON.parse(value);}
  window.LambertData={
    active:active,
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
      localStorage.setItem(key,JSON.stringify(value));
    }
  };
})();
