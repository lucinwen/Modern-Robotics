/* Shared interaction helpers for the 14-day lesson pages. Vanilla, offline, no network. */
(function () {
  'use strict';
  var LK = {};

  LK.$ = function (id) { return document.getElementById(id); };
  LK.$$ = function (selector, root) { return Array.prototype.slice.call((root || document).querySelectorAll(selector)); };

  LK.clamp = function (v, lo, hi) { return Math.min(hi, Math.max(lo, v)); };
  LK.lerp = function (a, b, t) { return a + (b - a) * t; };
  LK.deg = function (r) { return r * 180 / Math.PI; };
  LK.rad = function (d) { return d * Math.PI / 180; };
  LK.fmt = function (v, d) { return (Math.round(v * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d); };

  LK.cssVar = function (name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  };

  LK.palette = function () {
    return {
      fg: LK.cssVar('--foreground') || '#172b29',
      muted: LK.cssVar('--muted-foreground') || '#566b65',
      border: LK.cssVar('--border') || '#dce5df',
      grid: LK.cssVar('--border') || '#dce5df',
      primary: LK.cssVar('--primary') || '#185b4d',
      accent: LK.cssVar('--accent') || '#e0eee7',
      card: LK.cssVar('--card') || '#ffffff',
      s1: LK.cssVar('--viz-series-1') || '#218472',
      s2: LK.cssVar('--viz-series-2') || '#c08232',
      s3: LK.cssVar('--viz-series-3') || '#576dc5',
      s4: LK.cssVar('--viz-series-4') || '#ab5484',
      s5: LK.cssVar('--viz-series-5') || '#4286a3',
      s6: LK.cssVar('--viz-series-6') || '#8a744b',
      x: LK.cssVar('--axis-x') || '#bb514f',
      y: LK.cssVar('--axis-y') || '#368465',
      z: LK.cssVar('--axis-z') || '#526fc3',
      bad: LK.cssVar('--destructive') || '#bd403b'
    };
  };

  /* Bind a range input to an output element. map(value) -> display string. */
  LK.range = function (input, output, map, onChange) {
    if (typeof input === 'string') input = LK.$(input);
    if (typeof output === 'string') output = LK.$(output);
    if (!input) return null;
    function render() {
      var v = parseFloat(input.value);
      if (output) output.textContent = map ? map(v) : String(v);
      if (onChange) onChange(v);
    }
    input.addEventListener('input', render);
    render();
    return { refresh: render, value: function () { return parseFloat(input.value); } };
  };

  /* Bind several controls (checkbox/select/range/number) to one handler. */
  LK.bind = function (ids, handler, eventName) {
    (ids || []).forEach(function (id) {
      var el = LK.$(id);
      if (!el) return;
      el.addEventListener(eventName || (el.type === 'range' ? 'input' : 'change'), handler);
    });
    if (handler) handler();
  };

  LK.setFlag = function (el, text, kind) {
    if (typeof el === 'string') el = LK.$(el);
    if (!el) return;
    el.textContent = text;
    el.className = 'flag ' + (kind || '');
  };

  LK.text = function (id, value) {
    var el = typeof id === 'string' ? LK.$(id) : id;
    if (el) el.textContent = value;
  };

  /* Fit a canvas to its container at device resolution. Returns state with ctx + css size. */
  LK.canvas = function (canvas, height) {
    if (typeof canvas === 'string') canvas = LK.$(canvas);
    if (!canvas) return null;
    var ctx = canvas.getContext('2d');
    var state = { canvas: canvas, ctx: ctx, w: 300, h: height || 240, dpr: 1 };
    height = height || 240;
    function resize() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var cssW = Math.max(200, canvas.clientWidth || canvas.parentNode.clientWidth || 300);
      state.w = cssW;
      state.h = height;
      state.dpr = dpr;
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.height = height + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return state;
    }
    state.resize = resize;
    resize();
    var ro = null;
    if (window.ResizeObserver) {
      ro = new ResizeObserver(function () { resize(); if (state.onresize) state.onresize(); });
      ro.observe(canvas.parentNode || canvas);
    } else {
      window.addEventListener('resize', function () { resize(); if (state.onresize) state.onresize(); });
    }
    state.disconnect = function () { if (ro) ro.disconnect(); };
    return state;
  };

  /* Draw helpers */
  LK.clear = function (s, color) {
    s.ctx.save();
    s.ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
    s.ctx.clearRect(0, 0, s.w, s.h);
    if (color) { s.ctx.fillStyle = color; s.ctx.fillRect(0, 0, s.w, s.h); }
    s.ctx.restore();
  };

  LK.arrow = function (ctx, x1, y1, x2, y2, color, width) {
    var ang = Math.atan2(y2 - y1, x2 - x1);
    var head = 8;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = width || 1.6;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - head * Math.cos(ang - 0.4), y2 - head * Math.sin(ang - 0.4));
    ctx.lineTo(x2 - head * Math.cos(ang + 0.4), y2 - head * Math.sin(ang + 0.4));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };

  LK.label = function (ctx, text, x, y, color, size, align) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.font = (size || 12) + 'px "Noto Sans SC","PingFang SC","Microsoft YaHei",sans-serif';
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
    ctx.restore();
  };

  LK.dot = function (ctx, x, y, r, color) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r || 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  /* Automatically highlight the current day in the shared switcher. */
  function highlightSwitcher() {
    var key = document.body.dataset.lessonKey || '';
    var match = /day-(\d{2})/.exec(key);
    if (!match) return;
    var day = match[1];
    var link = document.querySelector('.day-switcher a[data-day="' + day + '"]');
    if (link) {
      link.setAttribute('aria-current', 'page');
      var summary = document.getElementById('day-switcher-current');
      if (summary) {
        var strong = link.querySelector('strong');
        var span = link.querySelector('span');
        summary.textContent = (strong ? strong.textContent : 'DAY ' + day) + (span ? ' · ' + span.textContent : '');
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', highlightSwitcher);
  } else {
    highlightSwitcher();
  }

  window.LK = LK;
})();
