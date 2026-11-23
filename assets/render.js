/* ============================================================
   版式渲染器 —— 全部手写 canvas，没有第三方依赖。
   一张图 = 媒体名(红) / 大标题(宋体黑体) / 引言+署名 / 日期 / 双图
   ============================================================ */
(function (global) {
  'use strict';

  var WIDTH = 1200;
  var PAD = 64;
  var INNER = WIDTH - PAD * 2;

  var C = {
    ink: '#0b0b0c',
    label: '#c0392b',
    phBg: '#f2f3f5',
    phLine: '#d6dae0',
    phText: '#a3aab4'
  };

  var F = {
    serif: '"Noto Serif SC", "Source Han Serif SC", "Songti SC", STSong, SimSun, serif',
    sans: '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif',
    ui: '"Inter", "Helvetica Neue", Arial, "Microsoft YaHei", "PingFang SC", sans-serif'
  };

  /* 竖向节奏，改这几个数就能整体调版式 */
  var M = {
    top: 22,
    labelSize: 27,
    labelBlock: 32,
    labelGap: 10,
    headlineLh: 1.17,
    headGap: 36,
    quoteSize: 30,
    quoteLh: 1.62,
    quoteGap: 20,
    dateSize: 25,
    dateBlock: 30,
    dateGap: 18,
    bottom: 26,
    colGap: 22
  };

  var CJK = /[\u2e80-\u2eff\u2f00-\u2fdf\u3000-\u303f\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff00-\uffef\u2018\u2019\u201c\u201d\u2014\u2013\u2026\u00b7]/;
  var NO_LINE_START = /^[，。、；：！？）》」』】〉”’…·%‰℃,.;:!?)\]}〕〉]$/;
  var NO_LINE_END = /[（《「『【〈“‘(\[{]$/;

  function isCJK(ch) { return CJK.test(ch); }

  /* 把一行文字切成「不可再拆」的单元：中文单字、拉丁单词 */
  function tokenize(line) {
    var out = [];
    var buf = '';
    for (var i = 0; i < line.length; i++) {
      var ch = line[i];
      if (/\s/.test(ch)) {
        if (buf) { out.push(buf); buf = ''; }
        out.push(' ');
      } else if (isCJK(ch)) {
        if (buf) { out.push(buf); buf = ''; }
        out.push(ch);
      } else {
        buf += ch;
      }
    }
    if (buf) out.push(buf);
    return out;
  }

  /* 标点不能落在行首；左括号不能落在行尾 */
  function applyRules(tokens) {
    var merged = [];
    for (var i = 0; i < tokens.length; i++) {
      var t = tokens[i];
      if (merged.length && NO_LINE_START.test(t)) {
        merged[merged.length - 1] += t;
      } else {
        merged.push(t);
      }
    }
    var fixed = [];
    for (var j = 0; j < merged.length; j++) {
      var u = merged[j];
      if (NO_LINE_END.test(u.slice(-1)) && j + 1 < merged.length && merged[j + 1] !== ' ') {
        fixed.push(u + merged[j + 1]);
        j++;
      } else {
        fixed.push(u);
      }
    }
    return fixed;
  }

  function splitLong(ctx, token, maxW) {
    var chunks = [];
    var cur = '';
    for (var i = 0; i < token.length; i++) {
      var next = cur + token[i];
      if (cur && ctx.measureText(next).width > maxW) {
        chunks.push(cur);
        cur = token[i];
      } else {
        cur = next;
      }
    }
    if (cur) chunks.push(cur);
    return chunks;
  }

  /* 按画布宽度折行（调用前先设好 ctx.font） */
  function wrap(ctx, text, maxW) {
    var src = text == null ? '' : String(text);
    var lines = [];
    var paras = src.split('\n');

    for (var p = 0; p < paras.length; p++) {
      var toks = applyRules(tokenize(paras[p]));
      var line = '';
      for (var i = 0; i < toks.length; i++) {
        var t = toks[i];
        if (t === ' ' && line === '') continue;
        var candidate = line + t;
        if (line !== '' && ctx.measureText(candidate).width > maxW) {
          lines.push(line.replace(/\s+$/, ''));
          line = (t === ' ') ? '' : t;
          if (ctx.measureText(line).width > maxW) {
            var chunks = splitLong(ctx, line, maxW);
            for (var c = 0; c < chunks.length - 1; c++) lines.push(chunks[c]);
            line = chunks[chunks.length - 1];
          }
        } else {
          line = candidate;
        }
      }
      lines.push(line.replace(/\s+$/, ''));
    }
    return lines;
  }

  function maxWidth(ctx, lines) {
    var w = 0;
    for (var i = 0; i < lines.length; i++) {
      w = Math.max(w, ctx.measureText(lines[i]).width);
    }
    return w;
  }

  function headlineLayout(ctx, state, family) {
    var text = (state.headline || '').trim();
    if (!text) return { size: 0, lines: [] };

    if (state.headlineAuto === false && state.headlineSize) {
      ctx.font = '900 ' + state.headlineSize + 'px ' + family;
      return { size: state.headlineSize, lines: wrap(ctx, text, INNER) };
    }

    var sizes = [66, 62, 58, 54, 50, 46, 42, 38];
    for (var i = 0; i < sizes.length; i++) {
      ctx.font = '900 ' + sizes[i] + 'px ' + family;
      var lines = wrap(ctx, text, INNER);
      if (lines.length <= 3) return { size: sizes[i], lines: lines };
    }
    ctx.font = '900 38px ' + family;
    return { size: 38, lines: wrap(ctx, text, INNER) };
  }

  function drawSlot(ctx, img, x, y, w, h, focus, hint) {
    if (img && img.width) {
      var sc = Math.max(w / img.width, h / img.height);
      var dw = img.width * sc;
      var dh = img.height * sc;
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.clip();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) * focus, dw, dh);
      ctx.restore();
      return;
    }

    ctx.save();
    ctx.fillStyle = C.phBg;
    ctx.fillRect(x, y, w, h);
    ctx.setLineDash([10, 8]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = C.phLine;
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
    ctx.setLineDash([]);
    ctx.fillStyle = C.phText;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '600 ' + Math.round(Math.max(15, Math.min(w, h) * 0.055)) + 'px ' + F.ui;
    ctx.fillText(hint, x + w / 2, y + h / 2);
    ctx.restore();
  }

  /**
   * 主渲染。ctx 需已按目标尺寸缩放过。
   * measureOnly = true 时只算高度、不画图（用于预览定高）。
   * 返回整张图的高度（逻辑单位）。
   */
  function render(ctx, state, images, measureOnly) {
    var s = state || {};
    var imgs = images || {};
    var family = s.fontFamily === 'sans' ? F.sans : F.serif;

    ctx.save();
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, WIDTH, 20000);

    var y = M.top;

    /* ---------- 媒体名 ---------- */
    var label = (s.label || '').trim();
    if (label) {
      ctx.font = '700 ' + M.labelSize + 'px ' + F.ui;
      if ('letterSpacing' in ctx) ctx.letterSpacing = '0.6px';
      ctx.fillStyle = C.label;
      ctx.fillText(wrap(ctx, label, INNER)[0] || '', PAD, y + 2);
      if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
      y += M.labelBlock + M.labelGap;
    }

    /* ---------- 标题 ---------- */
    var head = headlineLayout(ctx, s, family);
    if (head.lines.length) {
      ctx.font = '900 ' + head.size + 'px ' + family;
      ctx.fillStyle = C.ink;
      var lh = Math.round(head.size * M.headlineLh);
      for (var i = 0; i < head.lines.length; i++) {
        ctx.fillText(head.lines[i], PAD, y + i * lh);
      }
      y += head.lines.length * lh + M.headGap;
    }

    /* ---------- 引言 + 署名 ---------- */
    var quote = (s.quote || '').trim();
    var source = (s.source || '').trim();
    if (quote || source) {
      var qLh = Math.round(M.quoteSize * M.quoteLh);
      ctx.font = '400 ' + M.quoteSize + 'px ' + family;
      ctx.fillStyle = C.ink;

      var srcW = source ? ctx.measureText(source).width : 0;
      var qLines = quote ? wrap(ctx, quote, INNER) : [];
      var qW = maxWidth(ctx, qLines);

      if (qLines.length === 1 && source && qW + 44 + srcW <= INNER) {
        ctx.fillText(qLines[0], PAD, y);
        ctx.textAlign = 'right';
        ctx.fillText(source, PAD + INNER, y);
        ctx.textAlign = 'left';
        y += qLh;
      } else {
        for (var q = 0; q < qLines.length; q++) ctx.fillText(qLines[q], PAD, y + q * qLh);
        if (qLines.length) y += qLines.length * qLh;
        if (source) {
          ctx.textAlign = 'right';
          ctx.fillText(source, PAD + INNER, y);
          ctx.textAlign = 'left';
          y += qLh;
        }
      }
      y += M.quoteGap;
    }

    /* ---------- 日期 ---------- */
    var date = (s.date || '').trim();
    if (date) {
      ctx.font = '700 ' + M.dateSize + 'px ' + F.ui;
      ctx.fillStyle = C.ink;
      ctx.fillText(date, PAD, y + 1);
      y += M.dateBlock + M.dateGap;
    }

    /* ---------- 双图 ---------- */
    var imgH = Math.max(160, Number(s.imageHeight) || 520);
    var ratio = Math.min(0.8, Math.max(0.15, Number(s.leftRatio) || 0.44));
    var leftW = Math.round((INNER - M.colGap) * ratio);
    var rightW = INNER - M.colGap - leftW;

    if (!measureOnly) {
      drawSlot(ctx, imgs.left, PAD, y, leftW, imgH, 0.16, '左图');
      drawSlot(ctx, imgs.right, PAD + leftW + M.colGap, y, rightW, imgH, 0.5, '右图 · 拖入你的截图');
    }
    y += imgH + M.bottom;

    ctx.restore();
    return y;
  }

  global.MemeRender = {
    WIDTH: WIDTH,
    PAD: PAD,
    render: render,
    reset: null
  };
})(window);
