(function () {
  'use strict';
  var ORIGIN = 'https://embed.diagrams.net';
  var SRC = ORIGIN + '/?embed=1&proto=json&spin=1&noExitBtn=1&lang=zh';

  function create(opts) {
    opts = opts || {};
    var frame = opts.frame;
    var onXml = typeof opts.onXml === 'function' ? opts.onXml : function () {};
    var onStatus = typeof opts.onStatus === 'function' ? opts.onStatus : function () {};
    var initialXml = typeof opts.initialXml === 'string' ? opts.initialXml : '';
    var listening = false;
    var pendingSave = false;

    function post(msg) {
      var win = frame && frame.contentWindow;
      if (!win) return;
      win.postMessage(JSON.stringify(msg), ORIGIN);
    }

    function handle(ev) {
      if (ev.origin !== ORIGIN) return;
      if (!frame || ev.source !== frame.contentWindow) return;
      var data;
      try { data = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data; } catch (e) { return; }
      if (!data || typeof data !== 'object') return;
      var event = data.event;
      if (event === 'init') {
        post({ action: 'load', xml: initialXml, autosave: 0, saveAndExit: 0, title: '画master' });
      } else if (event === 'save') {
        if (typeof data.xml === 'string' && data.xml.length > 0) onXml(data.xml);
      } else if (event === 'export') {
        if (pendingSave) {
          pendingSave = false;
          var xml = typeof data.xml === 'string' && data.xml ? data.xml : data.data;
          if (typeof xml === 'string' && xml.length > 0) onXml(xml);
        }
      } else if (event === 'exit') {
        onStatus('closed');
      } else if (event === 'load') {
        onStatus('loaded');
      }
    }

    function open() {
      if (!frame) return;
      if (!listening) {
        window.addEventListener('message', handle);
        listening = true;
      }
      frame.src = SRC;
    }

    function close() {
      if (listening) {
        window.removeEventListener('message', handle);
        listening = false;
      }
      pendingSave = false;
      if (frame) frame.src = 'about:blank';
    }

    function requestSave() {
      if (!listening) return;
      pendingSave = true;
      post({ action: 'export', format: 'xml' });
    }

    return { open: open, close: close, requestSave: requestSave };
  }

  window.LambertDrawioBridge = Object.freeze({ create: create });
})();
