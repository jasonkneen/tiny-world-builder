// TinyWorld custom confirmation dialogs.
// Replaces browser-native confirm() so localhost/app actions keep the premium in-app UI.
(function tinyworldCustomConfirmBoot() {
  'use strict';
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.twConfirm && window.twConfirm.__tinyworldCustomConfirm) return;

  let twConfirmRoot = null;
  let twConfirmStyle = null;
  const twConfirmQueue = [];
  let twConfirmActive = null;

  function ensureStyle() {
    if (twConfirmStyle) return;
    twConfirmStyle = document.createElement('style');
    twConfirmStyle.id = 'tw-custom-confirm-style';
    twConfirmStyle.textContent = `
      .tw-confirm-backdrop{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(4,8,14,.58);backdrop-filter:blur(12px) saturate(1.15);-webkit-backdrop-filter:blur(12px) saturate(1.15)}
      .tw-confirm-card{width:min(520px,calc(100vw - 38px));border:1px solid rgba(255,255,255,.14);border-radius:22px;background:linear-gradient(180deg,rgba(21,24,31,.98),rgba(13,16,22,.98));box-shadow:0 34px 90px rgba(0,0,0,.58),inset 0 1px 0 rgba(255,255,255,.06);color:#f7f2e8;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;overflow:hidden;transform:translateY(6px) scale(.985);opacity:0;animation:twConfirmIn .14s ease-out forwards}
      @keyframes twConfirmIn{to{transform:translateY(0) scale(1);opacity:1}}
      .tw-confirm-head{display:flex;align-items:center;gap:12px;padding:22px 24px 8px}.tw-confirm-icon{width:34px;height:34px;border-radius:14px;display:grid;place-items:center;background:rgba(120,190,255,.14);color:#9dc9ff;box-shadow:inset 0 0 0 1px rgba(157,201,255,.18)}
      .tw-confirm-icon.danger{background:rgba(255,100,92,.14);color:#ffb1aa;box-shadow:inset 0 0 0 1px rgba(255,177,170,.2)}
      .tw-confirm-title{font-size:18px;font-weight:760;letter-spacing:-.02em;line-height:1.15}.tw-confirm-body{padding:6px 24px 8px;color:rgba(247,242,232,.82);font-size:14px;line-height:1.5}.tw-confirm-body p{margin:0 0 9px}.tw-confirm-details{margin-top:10px;padding:12px;border-radius:14px;background:rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.08);color:rgba(247,242,232,.72);white-space:pre-wrap;overflow-wrap:anywhere}.tw-confirm-actions{display:flex;justify-content:flex-end;gap:10px;padding:18px 24px 24px}.tw-confirm-btn{appearance:none;border:0;border-radius:999px;padding:11px 18px;min-width:104px;font:inherit;font-weight:720;cursor:pointer;color:#eaf2ff;background:rgba(255,255,255,.09);box-shadow:inset 0 0 0 1px rgba(255,255,255,.11);transition:transform .12s ease,background .12s ease,box-shadow .12s ease}.tw-confirm-btn:hover{transform:translateY(-1px);background:rgba(255,255,255,.13)}.tw-confirm-btn.cancel{color:#d8e3ee}.tw-confirm-btn.primary{color:#07131d;background:linear-gradient(180deg,#a9ccff,#7eb0ff);box-shadow:0 10px 24px rgba(86,144,255,.25),inset 0 1px 0 rgba(255,255,255,.35)}.tw-confirm-btn.danger{color:#fff;background:linear-gradient(180deg,#ff756c,#db3f35);box-shadow:0 10px 24px rgba(219,63,53,.25),inset 0 1px 0 rgba(255,255,255,.25)}
      @media (max-width:560px){.tw-confirm-actions{flex-direction:column-reverse}.tw-confirm-btn{width:100%}}
    `;
    document.head.appendChild(twConfirmStyle);
  }

  function icon(intent) {
    if (intent === 'danger') return '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.3 3.9 1.8 18.2A2 2 0 0 0 3.5 21h17a2 2 0 0 0 1.7-2.8L13.7 3.9a2 2 0 0 0-3.4 0Z"/></svg>';
    return '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  }

  function teardown(result) {
    const done = twConfirmActive;
    twConfirmActive = null;
    if (twConfirmRoot && twConfirmRoot.parentNode) twConfirmRoot.parentNode.removeChild(twConfirmRoot);
    twConfirmRoot = null;
    try { document.removeEventListener('keydown', onKey, true); } catch (_) {}
    if (done) done.resolve(result === true);
    drain();
  }
  function onKey(e) {
    if (!twConfirmActive) return;
    if (e.key === 'Escape') { e.preventDefault(); teardown(false); }
    if (e.key === 'Enter') { e.preventDefault(); teardown(true); }
  }
  function render(req) {
    ensureStyle();
    twConfirmRoot = document.createElement('div');
    twConfirmRoot.className = 'tw-confirm-backdrop';
    twConfirmRoot.setAttribute('role', 'presentation');
    const intent = req.intent === 'danger' ? 'danger' : 'default';
    const title = req.title || 'Confirm action';
    const message = req.message || '';
    const details = req.details || '';
    const cancelLabel = req.cancelLabel || 'Cancel';
    const confirmLabel = req.confirmLabel || 'OK';
    twConfirmRoot.innerHTML = '<div class="tw-confirm-card" role="dialog" aria-modal="true" aria-labelledby="tw-confirm-title">' +
      '<div class="tw-confirm-head"><div class="tw-confirm-icon ' + intent + '">' + icon(intent) + '</div><div id="tw-confirm-title" class="tw-confirm-title">' + esc(title) + '</div></div>' +
      '<div class="tw-confirm-body">' + (message ? '<p>' + esc(message) + '</p>' : '') + (details ? '<div class="tw-confirm-details">' + esc(details) + '</div>' : '') + '</div>' +
      '<div class="tw-confirm-actions"><button type="button" class="tw-confirm-btn cancel" data-action="cancel">' + esc(cancelLabel) + '</button><button type="button" class="tw-confirm-btn ' + (intent === 'danger' ? 'danger' : 'primary') + '" data-action="confirm">' + esc(confirmLabel) + '</button></div>' +
      '</div>';
    twConfirmRoot.addEventListener('click', (e) => { if (e.target === twConfirmRoot) teardown(false); });
    twConfirmRoot.querySelector('[data-action="cancel"]').addEventListener('click', () => teardown(false));
    twConfirmRoot.querySelector('[data-action="confirm"]').addEventListener('click', () => teardown(true));
    document.body.appendChild(twConfirmRoot);
    document.addEventListener('keydown', onKey, true);
    const btn = twConfirmRoot.querySelector('[data-action="cancel"]');
    setTimeout(() => { try { btn.focus(); } catch (_) {} }, 0);
  }
  function drain() {
    if (twConfirmActive || twConfirmQueue.length === 0) return;
    twConfirmActive = twConfirmQueue.shift();
    render(twConfirmActive.request);
  }

  window.twConfirm = function twConfirm(request) {
    const req = typeof request === 'string' ? { title: request } : (request || {});
    return new Promise((resolve) => { twConfirmQueue.push({ request: req, resolve }); drain(); });
  };
  window.twConfirm.__tinyworldCustomConfirm = true;
})();
