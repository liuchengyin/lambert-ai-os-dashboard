// Gate only the embedded "常用链接" view. The workbench itself stays open.
(function () {
  const original = window.openView;
  if (typeof original !== 'function') return;

  const KEY = 'lambert_links_view_unlocked_v1';
  let unlocked = false;
  try { unlocked = sessionStorage.getItem(KEY) === '1'; } catch {}

  const style = document.createElement('style');
  style.textContent = '.links-gate-dialog{border:1px solid #e4dfea;border-radius:14px;padding:20px;background:#fff;color:#33313b;max-width:min(92vw,420px);box-shadow:0 20px 65px #27213a26}.links-gate-dialog::backdrop{background:#15101f77}.links-gate-form{font-family:inherit;display:grid;gap:12px}.links-gate-form h3{margin:0;font-size:18px}.links-gate-form p{margin:0;font-size:13px;color:#70667d}.links-gate-form label{display:grid;gap:6px;font-size:13px}.links-gate-form input{font:inherit;padding:10px 12px;border:1px solid #d8d2e2;border-radius:8px}.links-gate-form #linksGateError{color:#a33}.links-gate-actions{display:flex;justify-content:flex-end;gap:8px}.links-gate-actions button{font:inherit;padding:8px 14px;border:1px solid #ddd7e6;border-radius:8px;background:#fff;cursor:pointer}.links-gate-actions .task-primary-btn{background:#7357d7;color:#fff;border-color:#7357d7}';
  document.head.appendChild(style);

  const dialog = document.createElement('dialog');
  dialog.className = 'links-gate-dialog';
  dialog.innerHTML = '<form method="dialog" class="links-gate-form">' +
    '<h3>常用链接 · 口令验证</h3>' +
    '<p>工作台无需登录；进入常用链接需要输入数据管理口令。</p>' +
    '<label>口令<input id="linksGatePassword" type="password" autocomplete="current-password" maxlength="256" required></label>' +
    '<p id="linksGateError" role="alert"></p>' +
    '<div class="links-gate-actions"><button type="button" id="linksGateCancel">取消</button>' +
    '<button type="button" id="linksGateSubmit" class="task-primary-btn">进入</button></div>' +
    '</form>';
  document.body.appendChild(dialog);

  const input = dialog.querySelector('#linksGatePassword');
  const error = dialog.querySelector('#linksGateError');
  const submit = dialog.querySelector('#linksGateSubmit');
  let pending = false;
  let onSuccess = null;

  async function verify() {
    if (pending || !input.value) return;
    pending = true;
    submit.disabled = true;
    submit.textContent = '验证中…';
    error.textContent = '';
    try {
      const res = await fetch('/api/links-unlock', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({password: input.value})
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        unlocked = true;
        try { sessionStorage.setItem(KEY, '1'); } catch {}
        const done = onSuccess;
        onSuccess = null;
        input.value = '';
        dialog.close('ok');
        if (done) done();
        return;
      }
      error.textContent = data.error === 'not_configured'
        ? '服务端尚未配置口令，请联系管理员。'
        : data.error === 'wrong_password'
          ? '口令不正确，请重试。'
          : '验证失败（' + (data.error || res.status) + '）。';
      input.focus();
      input.select();
    } catch {
      error.textContent = '连接失败，请检查网络后重试。';
    } finally {
      pending = false;
      submit.disabled = false;
      submit.textContent = '进入';
    }
  }

  submit.addEventListener('click', verify);
  dialog.querySelector('#linksGateCancel').addEventListener('click', () => {
    onSuccess = null;
    input.value = '';
    dialog.close('cancel');
  });
  dialog.addEventListener('close', () => {
    if (dialog.returnValue !== 'ok') onSuccess = null;
    input.value = '';
  });
  dialog.querySelector('form').addEventListener('submit', e => {
    e.preventDefault();
    verify();
  });

  window.openView = function (id) {
    if (id !== 'knowledge' || unlocked) {
      return original.apply(this, arguments);
    }
    onSuccess = () => original.apply(this, arguments);
    dialog.showModal();
    input.focus();
  };
})();
