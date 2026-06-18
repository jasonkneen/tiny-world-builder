(function () {
  'use strict';

  const WAVE1 = '2026-06-21T23:59:00Z';
  const WAVE1_MS = Date.parse(WAVE1);
  const SECOND = 1000;
  const MINUTE = 60 * SECOND;
  const HOUR = 60 * MINUTE;
  const DAY = 24 * HOUR;

  function interpolate(str, params) {
    if (!params || typeof str !== 'string') return str;
    return str.replace(/\{(\w+)\}/g, function (whole, key) {
      return Object.prototype.hasOwnProperty.call(params, key) ? String(params[key]) : whole;
    });
  }

  function T(key, params, fallback) {
    if (typeof window !== 'undefined' && typeof window.t === 'function') {
      const translated = window.t(key, params);
      if (translated && translated !== key) return translated;
    }
    return interpolate(fallback || key, params);
  }

  function nowMs(value) {
    if (value == null) return Date.now();
    if (typeof value === 'number') return value;
    if (value instanceof Date) return value.getTime();
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : Date.now();
  }

  function unit(key, n, fallback) {
    return T(key, { n }, fallback);
  }

  function formatRemaining(now) {
    const at = nowMs(now);
    const remainingMs = Math.max(0, WAVE1_MS - at);
    const totalSeconds = Math.max(0, Math.ceil(remainingMs / SECOND));
    const live = remainingMs <= 0;
    const days = Math.floor(totalSeconds / (DAY / SECOND));
    const hours = Math.floor((totalSeconds % (DAY / SECOND)) / (HOUR / SECOND));
    const minutes = Math.floor((totalSeconds % (HOUR / SECOND)) / (MINUTE / SECOND));
    const seconds = totalSeconds % 60;
    const time = [
      unit('time.days', days, '{n}d'),
      unit('time.hours', hours, '{n}h'),
      unit('time.minutes', minutes, '{n}m'),
    ].join(' ');
    const label = live
      ? T('countdown.live', null, 'WAVE1 is live')
      : T('countdown.label', { time }, 'WAVE1 in {time}');
    return {
      target: WAVE1,
      targetMs: WAVE1_MS,
      live,
      days,
      hours,
      minutes,
      seconds,
      totalSeconds,
      time,
      label,
    };
  }

  function setDomLabel(el, formatted) {
    let label = el.querySelector('[data-countdown-label]');
    if (!label) {
      el.textContent = '';
      const dot = document.createElement('span');
      dot.className = 'tw-countdown-dot';
      dot.setAttribute('aria-hidden', 'true');
      label = document.createElement('span');
      label.className = 'tw-countdown-label';
      label.setAttribute('data-countdown-label', '');
      el.appendChild(dot);
      el.appendChild(label);
    }
    label.textContent = formatted.label;
    el.setAttribute('aria-label', formatted.label);
    el.dataset.countdownLabel = formatted.label;
    el.dataset.countdownLive = formatted.live ? 'true' : 'false';
  }

  function mount(el, options) {
    if (typeof el === 'string') el = document.querySelector(el);
    if (!el) return null;
    if (el.__tinyworldCountdownMount) return el.__tinyworldCountdownMount;
    const opts = options || {};
    const skin = opts.skin || el.getAttribute('data-countdown-skin') || 'pill';
    const tickMode = opts.tick || el.getAttribute('data-countdown-tick') || 'interval';
    const state = { lastLabel: '', timer: null, raf: 0, stopped: false };
    el.classList.add('tw-countdown', 'tw-countdown-' + skin);

    function update() {
      if (state.stopped) return;
      const formatted = formatRemaining(typeof opts.now === 'function' ? opts.now() : undefined);
      if (formatted.label !== state.lastLabel) {
        state.lastLabel = formatted.label;
        setDomLabel(el, formatted);
      }
    }

    function frame() {
      update();
      if (!state.stopped) state.raf = window.requestAnimationFrame(frame);
    }

    update();
    if (tickMode === 'raf' && typeof window.requestAnimationFrame === 'function') {
      state.raf = window.requestAnimationFrame(frame);
    } else {
      state.timer = window.setInterval(update, 1000);
    }

    const api = {
      update,
      stop: function () {
        state.stopped = true;
        if (state.timer) window.clearInterval(state.timer);
        if (state.raf) window.cancelAnimationFrame(state.raf);
        el.__tinyworldCountdownMount = null;
      },
      formatted: function () { return formatRemaining(); },
    };
    el.__tinyworldCountdownMount = api;
    return api;
  }

  function mountAll(root) {
    const host = root || document;
    if (!host || !host.querySelectorAll) return [];
    return Array.from(host.querySelectorAll('[data-countdown-mount]')).map(function (el) {
      return mount(el);
    }).filter(Boolean);
  }

  function ensureBuilderBrandMount() {
    if (!document.getElementById('app')) return;
    const brand = document.querySelector('.brand');
    if (!brand || brand.querySelector('.brand-countdown')) return;
    const el = document.createElement('div');
    el.className = 'brand-countdown';
    el.setAttribute('data-countdown-mount', '');
    el.setAttribute('data-countdown-skin', 'app');
    el.setAttribute('data-countdown-tick', 'interval');
    el.setAttribute('aria-live', 'polite');
    el.textContent = 'WAVE1 in';
    brand.appendChild(el);
  }

  function roundedRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function fitText(ctx, text, maxWidth, size, weight) {
    let fontSize = size;
    do {
      ctx.font = (weight || 700) + ' ' + fontSize + 'px "Space Grotesk", system-ui, sans-serif';
      if (ctx.measureText(text).width <= maxWidth || fontSize <= 18) break;
      fontSize -= 2;
    } while (fontSize > 18);
  }

  function renderCanvas(ctx, options) {
    if (!ctx) return null;
    const opts = options || {};
    const canvas = ctx.canvas || {};
    const w = opts.width || canvas.width || 1024;
    const h = opts.height || canvas.height || 128;
    const formatted = opts.formatted || formatRemaining(opts.now);
    ctx.clearRect(0, 0, w, h);

    const inset = opts.inset == null ? 18 : opts.inset;
    const panelH = h - inset * 2;
    const grad = ctx.createLinearGradient(0, inset, 0, h - inset);
    grad.addColorStop(0, 'rgba(18, 35, 68, 0.94)');
    grad.addColorStop(1, 'rgba(7, 15, 34, 0.9)');
    roundedRect(ctx, inset, inset, w - inset * 2, panelH, 22);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(127, 178, 255, 0.5)';
    ctx.stroke();

    ctx.fillStyle = formatted.live ? '#79ffb0' : '#7fb2ff';
    roundedRect(ctx, inset + 22, inset + 24, 12, panelH - 48, 6);
    ctx.fill();

    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#f2f6ff';
    fitText(ctx, formatted.label, w - inset * 2 - 128, 44, 800);
    ctx.fillText(formatted.label, inset + 58, h / 2 + 1);

    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(174, 198, 255, 0.78)';
    ctx.font = '700 24px "Space Grotesk", system-ui, sans-serif';
    ctx.fillText('WAVE1', w - inset - 28, h / 2 + 1);
    ctx.textAlign = 'left';
    return formatted;
  }

  const api = {
    WAVE1,
    WAVE1_MS,
    formatRemaining,
    mount,
    mountAll,
    renderCanvas,
  };
  window.TinyWorldCountdown = api;

  function boot() {
    ensureBuilderBrandMount();
    mountAll(document);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
}());
