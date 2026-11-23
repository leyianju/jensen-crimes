/* ============================================================
   交互层：表单 ↔ 状态 ↔ 画布
   ============================================================ */
(function () {
  'use strict';

  var WIDTH = window.MemeRender.WIDTH;

  var DEFAULTS = {
    label: 'arknights',
    headline: '英伟达董事会调查发现，CEO黄仁勋玩丝之歌一直到第三幕还在用收割者',
    quote: '天哪是我们的第七纹章大人',
    source: '——一位明显受惊的英伟达高管说。',
    date: 'November 17, 2026',
    imageHeight: 520,
    leftRatio: 0.44,
    headlineSize: 66,
    headlineAuto: true,
    fontFamily: 'serif',
    portrait: 'official'
  };

  var DEFAULT_PORTRAIT = 'official';
  var DEFAULT_RIGHT = 'assets/img/demo-game.jpg';
  var PORTRAITS = window.PORTRAITS || [];
  var LS_KEY = 'jensen-crimes:v1';

  var $ = function (id) { return document.getElementById(id); };

  var state = {};
  var imgs = { left: null, right: null };
  var objectUrls = [];

  var probe = document.createElement('canvas').getContext('2d');
  var preview, frame, toastEl;
  var rafId = 0;
  var toastTimer = 0;

  /* ---------------- 图片 ---------------- */

  function loadImage(src) {
    return new Promise(function (resolve, reject) {
      var im = new Image();
      im.onload = function () { resolve(im); };
      im.onerror = function () { reject(new Error('图片加载失败')); };
      im.src = src;
    });
  }

  function portraitById(id) {
    for (var i = 0; i < PORTRAITS.length; i++) {
      if (PORTRAITS[i].id === id) return PORTRAITS[i];
    }
    return null;
  }

  function buildPortraits() {
    var box = $('portraits');
    if (!box) return;
    box.innerHTML = '';

    PORTRAITS.forEach(function (p) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'portrait';
      b.setAttribute('data-id', p.id);
      b.title = p.name + ' — ' + (p.credit || '');
      b.innerHTML = '<img src="' + p.thumb + '" alt="' + p.name + '" loading="lazy">' +
                    '<span class="portrait__tag">' + p.name + '</span>';
      b.addEventListener('click', function () { selectPortrait(p.id); });
      box.appendChild(b);
    });

    var up = document.createElement('button');
    up.type = 'button';
    up.className = 'portrait portrait--upload';
    up.title = '上传你自己的照片';
    up.innerHTML = '<span class="portrait__plus">＋</span><span class="portrait__tag">上传</span>';
    up.addEventListener('click', function () { $('fileLeft').click(); });
    box.appendChild(up);
  }

  function markPortrait(id) {
    document.querySelectorAll('.portrait[data-id]').forEach(function (el) {
      el.classList.toggle('is-on', el.getAttribute('data-id') === id);
    });
  }

  function selectPortrait(id, silent) {
    var p = portraitById(id) || portraitById(DEFAULT_PORTRAIT) || PORTRAITS[0];
    if (!p) return;
    state.portrait = p.id;
    markPortrait(p.id);
    loadImage(p.src).then(function (im) {
      imgs.left = im;
      schedule();
      if (!silent) {
        saveLocal();
        toast('左图换成「' + p.name + '」');
      }
    }).catch(function () {
      if (!silent) toast('这张图加载失败了', true);
    });
  }

  function flashPick(slot) {
    var el = slot === 'left' ? document.querySelector('.portrait--upload') : $('pickRight');
    if (!el) return;
    el.classList.add('is-hit');
    setTimeout(function () { el.classList.remove('is-hit'); }, 900);
  }

  function handleFile(file, slot) {
    if (!file) return;
    if (!/^image\//.test(file.type)) { toast('这不是图片文件', true); return; }
    var url = URL.createObjectURL(file);
    objectUrls.push(url);
    loadImage(url).then(function (im) {
      imgs[slot] = im;
      if (slot === 'right') {
        $('rightName').textContent = '自定义 · ' + baseName(file.name);
        $('hint').classList.add('is-hidden');
      } else {
        state.portrait = 'custom';
        markPortrait(null);
        saveLocal();
      }
      flashPick(slot);
      schedule();
      toast(slot === 'left' ? '左图已替换（自定义）' : '右图已替换');
    }).catch(function () {
      toast('读不出这张图，换一张试试', true);
    });
  }

  function baseName(name) {
    var n = String(name || '图片');
    return n.length > 18 ? n.slice(0, 15) + '…' : n;
  }

  function loadDefaults() {
    selectPortrait(state.portrait, true);

    loadImage(DEFAULT_RIGHT).then(function (im) {
      imgs.right = im;
      $('rightName').textContent = '示例截图 · 点击替换';
      $('hint').classList.add('is-hidden');
      schedule();
    }).catch(function () { /* 没有示例图就留空 */ });
  }

  /* ---------------- 绘制 ---------------- */

  function schedule() {
    if (rafId) return;
    rafId = requestAnimationFrame(function () {
      rafId = 0;
      paint();
    });
  }

  function paint() {
    var height = window.MemeRender.render(probe, state, imgs, true);
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var w = Math.round(WIDTH * dpr);
    var h = Math.round(height * dpr);

    if (preview.width !== w) preview.width = w;
    if (preview.height !== h) preview.height = h;

    var ctx = preview.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    window.MemeRender.render(ctx, state, imgs, false);
  }

  function renderToCanvas(scale) {
    var height = window.MemeRender.render(probe, state, imgs, true);
    var canvas = document.createElement('canvas');
    canvas.width = Math.round(WIDTH * scale);
    canvas.height = Math.round(height * scale);
    var ctx = canvas.getContext('2d');
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    window.MemeRender.render(ctx, state, imgs, false);
    return canvas;
  }

  function toBlob(canvas) {
    return new Promise(function (resolve, reject) {
      if (!canvas.toBlob) { reject(new Error('浏览器太老')); return; }
      canvas.toBlob(function (blob) {
        blob ? resolve(blob) : reject(new Error('生成图片失败'));
      }, 'image/png');
    });
  }

  function stamp() {
    var d = new Date();
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes());
  }

  /* ---------------- 导出 ---------------- */

  function download() {
    var btn = $('download');
    btn.disabled = true;
    toBlob(renderToCanvas(2)).then(function (blob) {
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'jensen-crimes-' + stamp() + '.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
      toast('已保存（' + Math.round(blob.size / 1024) + ' KB）');
    }).catch(function (err) {
      toast('导出失败：' + err.message, true);
    }).then(function () {
      btn.disabled = false;
    });
  }

  function copyImage() {
    if (!navigator.clipboard || !window.ClipboardItem || !window.isSecureContext) {
      toast('这个环境不支持直接复制，改走下载');
      download();
      return;
    }
    toBlob(renderToCanvas(2)).then(function (blob) {
      return navigator.clipboard.write([new window.ClipboardItem({ 'image/png': blob })]);
    }).then(function () {
      toast('图片已复制，去聊天框粘贴吧');
    }).catch(function () {
      toast('复制被浏览器拦了，改走下载');
      download();
    });
  }

  /* ---------------- 分享 / 存档 ---------------- */

  function encodeState(s) {
    var bytes = new TextEncoder().encode(JSON.stringify(s));
    var bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function decodeState(str) {
    try {
      var b64 = str.replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4) b64 += '=';
      var bin = atob(b64);
      var bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return JSON.parse(new TextDecoder().decode(bytes));
    } catch (e) {
      return null;
    }
  }

  function sanitize(raw) {
    var out = {};
    if (!raw || typeof raw !== 'object') return out;
    ['label', 'headline', 'quote', 'source', 'date', 'fontFamily', 'portrait'].forEach(function (k) {
      if (typeof raw[k] === 'string') out[k] = raw[k].slice(0, 200);
    });
    if (typeof raw.headlineAuto === 'boolean') out.headlineAuto = raw.headlineAuto;
    if (isFinite(raw.headlineSize)) out.headlineSize = Math.min(84, Math.max(36, Number(raw.headlineSize)));
    if (isFinite(raw.imageHeight)) out.imageHeight = Math.min(820, Math.max(320, Number(raw.imageHeight)));
    if (isFinite(raw.leftRatio)) out.leftRatio = Math.min(0.68, Math.max(0.28, Number(raw.leftRatio)));
    if (out.fontFamily && out.fontFamily !== 'serif' && out.fontFamily !== 'sans') delete out.fontFamily;
    return out;
  }

  function share() {
    if (location.protocol === 'file:') {
      toast('本地打开没法生成分享链接，部署到网上就能用了', true);
      return;
    }
    var encoded = encodeState(state);
    var url = location.origin + location.pathname + '#' + encoded;
    history.replaceState(null, '', '#' + encoded);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function () {
        toast('链接已复制，发给朋友打开就是这张图');
      }, function () {
        window.prompt('复制这个链接：', url);
      });
    } else {
      window.prompt('复制这个链接：', url);
    }
  }

  function saveLocal() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) { /* 隐私模式 */ }
  }

  function readLocal() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      return raw ? sanitize(JSON.parse(raw)) : null;
    } catch (e) { return null; }
  }

  /* ---------------- 表单 ---------------- */

  function syncForm() {
    document.querySelectorAll('[data-key]').forEach(function (el) {
      var key = el.dataset.key;
      if (key === 'leftRatio') el.value = Math.round(state.leftRatio * 100);
      else if (key === 'headlineAuto') el.checked = !!state.headlineAuto;
      else el.value = state[key];
    });
    $('headlineAuto').checked = !!state.headlineAuto;
    $('headlineSize').disabled = !!state.headlineAuto;
    document.querySelectorAll('#fontSeg button').forEach(function (b) {
      b.classList.toggle('is-on', b.dataset.font === state.fontFamily);
    });
    updateOutputs();
  }

  function updateOutputs() {
    $('sizeOut').textContent = state.headlineAuto ? '自动' : state.headlineSize + 'px';
    $('heightOut').textContent = state.imageHeight;
    $('ratioOut').textContent = Math.round(state.leftRatio * 100) + '%';
  }

  function onInput(e) {
    var el = e.target;
    var key = el.dataset.key;
    if (!key) return;
    var v = el.value;
    if (key === 'leftRatio') v = Number(v) / 100;
    else if (key === 'headlineSize' || key === 'imageHeight') v = Number(v);
    state[key] = v;
    if (key === 'headlineSize') {
      state.headlineAuto = false;
      $('headlineAuto').checked = false;
      $('headlineSize').disabled = false;
    }
    updateOutputs();
    schedule();
    saveLocal();
  }

  /* ---------------- toast ---------------- */

  function toast(msg, isError) {
    toastEl.textContent = msg;
    toastEl.classList.toggle('is-err', !!isError);
    toastEl.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('is-on'); }, 2400);
  }

  /* ---------------- 绑定 ---------------- */

  function bind() {
    document.querySelectorAll('[data-key]').forEach(function (el) {
      el.addEventListener('input', onInput);
      el.addEventListener('change', onInput);
    });

    $('headlineAuto').addEventListener('change', function (e) {
      state.headlineAuto = e.target.checked;
      $('headlineSize').disabled = state.headlineAuto;
      updateOutputs();
      schedule();
      saveLocal();
    });

    document.querySelectorAll('#fontSeg button').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.fontFamily = btn.dataset.font;
        document.querySelectorAll('#fontSeg button').forEach(function (b) {
          b.classList.toggle('is-on', b === btn);
        });
        schedule();
        saveLocal();
      });
    });

    $('pickRight').addEventListener('click', function () { $('fileRight').click(); });
    $('fileLeft').addEventListener('change', function (e) {
      handleFile(e.target.files && e.target.files[0], 'left');
      e.target.value = '';
    });
    $('fileRight').addEventListener('change', function (e) {
      handleFile(e.target.files && e.target.files[0], 'right');
      e.target.value = '';
    });

    $('clearRight').addEventListener('click', function () {
      imgs.right = null;
      $('rightName').textContent = '还没放图 · 点击或拖进来';
      $('hint').classList.remove('is-hidden');
      schedule();
      toast('右图已清空');
    });

    $('download').addEventListener('click', download);
    $('copy').addEventListener('click', copyImage);
    $('share').addEventListener('click', share);
    $('random').addEventListener('click', randomPreset);

    /* 拖拽 */
    ['dragenter', 'dragover'].forEach(function (type) {
      frame.addEventListener(type, function (e) {
        e.preventDefault();
        frame.classList.add('is-drag');
      });
    });
    ['dragleave', 'dragend'].forEach(function (type) {
      frame.addEventListener(type, function () { frame.classList.remove('is-drag'); });
    });
    frame.addEventListener('drop', function (e) {
      e.preventDefault();
      frame.classList.remove('is-drag');
      var file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (!file) return;
      var rect = preview.getBoundingClientRect();
      var rel = (e.clientX - rect.left) / rect.width;
      handleFile(file, rel < state.leftRatio ? 'left' : 'right');
    });

    /* 点画布左半边换左图，右半边换右图 */
    preview.addEventListener('click', function (e) {
      var rect = preview.getBoundingClientRect();
      var rel = (e.clientX - rect.left) / rect.width;
      (rel < state.leftRatio ? $('fileLeft') : $('fileRight')).click();
    });

    /* 粘贴截图 → 右图 */
    document.addEventListener('paste', function (e) {
      var items = e.clipboardData && e.clipboardData.items;
      if (!items) return;
      for (var i = 0; i < items.length; i++) {
        if (items[i].kind === 'file' && /^image\//.test(items[i].type)) {
          var f = items[i].getAsFile();
          if (f) {
            handleFile(f, 'right');
            toast('已从剪贴板放进右图');
          }
          break;
        }
      }
    });

    /* 快捷键 */
    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        download();
      }
    });
  }

  function randomPreset() {
    var list = window.PRESETS || [];
    if (!list.length) return;
    var p = list[Math.floor(Math.random() * list.length)];
    ['label', 'headline', 'quote', 'source', 'date'].forEach(function (k) {
      state[k] = p[k] || '';
    });
    syncForm();
    schedule();
    saveLocal();
    toast('「' + p.quote.slice(0, 16) + '」');
  }

  /* ---------------- 启动 ---------------- */

  function init() {
    preview = $('preview');
    frame = $('frame');
    toastEl = $('toast');

    var fromHash = location.hash.length > 2 ? sanitize(decodeState(location.hash.slice(1))) : null;
    state = Object.assign({}, DEFAULTS, fromHash || readLocal() || {});

    syncForm();
    bind();
    buildPortraits();
    loadDefaults();
    schedule();

    if (document.fonts) {
      if (document.fonts.ready) document.fonts.ready.then(schedule);
      if (document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', schedule);
    }

    window.addEventListener('resize', schedule);

    /* 给控制台 / 无头测试留个把手 */
    window.__jensen = {
      state: state,
      imgs: imgs,
      paint: function () { paint(); },
      toCanvas: renderToCanvas,
      set: function (patch) {
        Object.assign(state, patch);
        syncForm();
        schedule();
      }
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
