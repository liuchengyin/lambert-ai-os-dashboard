// Based on DeepSeek Flash draft; reviewed for fail-closed owner validation and cloud documents.
(function () {
  'use strict';

  var OWNER_KEY = 'lambert_active_account_v1';
  var PREFIX = 'lambert_private_v1:';
  var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  var owner = localStorage.getItem(OWNER_KEY) || '';
  if (owner && !UUID_RE.test(owner)) throw Error('invalid_account_owner');

  var PASSTHROUGH_EXACT = {
    'lambert_active_account_v1': true,
    'lambert_public_config_v1': true,
    'tasks': true,
    'projects': true,
    'daily_reviews_v2': true
  };
  var PASSTHROUGH_PREFIX = ['lambert_auth_v1', 'lambert_workspace_v1:'];

  function isPassthrough(key) {
    if (Object.prototype.hasOwnProperty.call(PASSTHROUGH_EXACT,key)) return true;
    for (var i = 0; i < PASSTHROUGH_PREFIX.length; i++) {
      if (key.indexOf(PASSTHROUGH_PREFIX[i]) === 0) return true;
    }
    return false;
  }

  function assertOwner() {
    var current = localStorage.getItem(OWNER_KEY) || '';
    if (current && !UUID_RE.test(current)) throw Error('invalid_account_owner');
    if (current !== owner) {
      var err = new Error('account_changed');
      err.code = 'account_changed';
      throw err;
    }
  }

  function resolveKey(key) {
    key = String(key);
    if (!owner || isPassthrough(key)) return key;
    return PREFIX + owner + ':' + key;
  }

  var documents=['reading_workspace_v2','reading_standalone_notes_v1','knowledge_link_library_v1','knowledge_link_personal_v1'];
  function cloud(key){return owner&&documents.indexOf(String(key))>=0;}
  function bridge(){if(!window.LambertData||window.LambertData.active!==owner)throw Error('account_data_not_ready');return window.LambertData;}
  function getItem(key) {
    assertOwner();
    if(cloud(key)){var value=bridge().read(String(key),null);return value===null?null:JSON.stringify(value);}
    return localStorage.getItem(resolveKey(key));
  }

  function setItem(key, value) {
    assertOwner();
    if(cloud(key)){bridge().write(String(key),JSON.parse(String(value)));return;}
    return localStorage.setItem(resolveKey(key), value);
  }

  function removeItem(key) {
    assertOwner();
    if(cloud(key)){bridge().write(String(key),null);return;}
    return localStorage.removeItem(resolveKey(key));
  }

  function databaseName(base) {
    assertOwner();
    base = String(base);
    return owner ? base + '_' + owner : base;
  }

  if(window.addEventListener)window.addEventListener('storage',function(event){
    if(event.key===OWNER_KEY&&(event.newValue||'')!==owner)window.location.reload();
  });
  window.LambertPrivateStorage = {
    getItem: getItem,
    setItem: setItem,
    removeItem: removeItem,
    owner: owner,
    assertOwner: assertOwner,
    databaseName: databaseName
  };
})();
