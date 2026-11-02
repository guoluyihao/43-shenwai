/* 构建期分页：A4 一页一纸 + 封面页 + 三级目录 + 页眉页脚 + 真实页码
   结构约定：
     [data-toc="1"] 章、[data-toc="2"] 节、含表/图的 .an-card 自动作为三级块
     [data-break="page"] 强制另起一页（D.2–D.4 等）
   导出时 window.__EXPORT__ = true：生成独立封面页（第 1 页）
   网页查看时不生成封面页，正文页码从 1 开始 */
(function () {
  'use strict';

  function run() {
    var host = document.querySelector('.an-page');
    if (!host) { window.__PAGES__ = 0; return; }

    var withCover = !!window.__EXPORT__;
    var compact = host.getAttribute('data-compact') === '1';
    var src = host.cloneNode(true);
    host.style.display = 'none';

    // 1. 去掉只在屏幕上用的外壳
    src.querySelectorAll('.an-rolebar, .an-toolbar, .an-toc, .an-backtop, .breadcrumb, .an-cover-actions, .an-hub-grid, .an-hub-note, .an-hub-meta, .an-card-head-row .btn, .an-print-hide').forEach(function (n) { n.remove(); });

    var title = (src.querySelector('.an-cover h1') || {}).textContent || document.title || '增值分析报告';
    title = title.trim();

    // 2. 收集三级目录（在分页前，基于源 DOM）
    var toc = [];
    var chapters = Array.prototype.slice.call(src.querySelectorAll('.an-chapter'));
    chapters.forEach(function (ch) {
      var chLabel = ch.getAttribute('data-toc-label') || (ch.querySelector('h2') || {}).textContent || '';
      toc.push({ level: 1, label: chLabel.trim(), el: ch.querySelector('.an-chapter-head') || ch });
      var secs = Array.prototype.slice.call(ch.querySelectorAll('.an-section'));
      var hasSec = secs.length > 0;
      // 按 DOM 顺序收集节与块，保证目录父子关系正确
      var seen = {};
      Array.prototype.slice.call(ch.querySelectorAll('.an-section, .an-card')).forEach(function (node) {
        if (node.classList.contains('an-section')) {
          toc.push({ level: 2, label: (node.getAttribute('data-toc-label') || '').trim(), el: node.querySelector('.an-section-head') || node });
          return;
        }
        if (node.closest('.an-print-hide') || node.closest('.an-appendix')) return;
        var h = node.querySelector('h4');
        if (!h) return;
        var isData = !!(node.querySelector('table, svg, .an-hist, .an-bars, .an-stack, .an-flow, .an-mig, .an-heat'));
        if (!isData) return;
        var label = h.textContent.replace(/（续）$/, '').trim();
        if (seen[label]) return;
        seen[label] = 1;
        var inSec = !!node.closest('.an-section');
        toc.push({ level: inSec ? 3 : 2, label: label, el: node });
      });
    });

    toc.forEach(function (t, i) {
      t.anchor = 'toc-' + i;
      t.el.setAttribute('data-anchor', t.anchor);
    });

    // 3. 分页容器（必须挂到文档里，否则测不到高度）
    var pagesEl = document.createElement('div');
    pagesEl.className = 'pages';
    document.body.appendChild(pagesEl);
    var pages = [];
    var page = null, body = null;

    function newPage(kind) {
      page = document.createElement('div');
      page.className = 'pg' + (kind ? ' pg-' + kind : '');
      var head = document.createElement('div');
      head.className = 'pg-head';
      body = document.createElement('div');
      body.className = 'pg-body';
      var foot = document.createElement('div');
      foot.className = 'pg-foot';
      page.appendChild(head);
      page.appendChild(body);
      page.appendChild(foot);
      pagesEl.appendChild(page);
      pages.push(page);
      return page;
    }

    function over() { return used() > body.clientHeight + 1; }
    function used() {
      var kids = body.children;
      if (!kids.length) return 0;
      var last = kids[kids.length - 1];
      var rb = body.getBoundingClientRect();
      var rl = last.getBoundingClientRect();
      var mb = parseFloat(getComputedStyle(last).marginBottom || '0') || 0;
      return (rl.bottom - rb.top) + mb;
    }
    function remain() { return body.clientHeight - used(); }
    function fits(el) {
      body.appendChild(el);
      if (over()) { body.removeChild(el); return false; }
      return true;
    }
    function clone(el) { return el.cloneNode(true); }
    function add(el) { body.appendChild(el); }

    // ---------- 表格跨页 ----------
    function tableOf(card) { return card.querySelector ? card.querySelector('table') : null; }
    function rowsOf(t) { return t && t.tBodies && t.tBodies[0] ? Array.prototype.slice.call(t.tBodies[0].rows) : null; }
    function tableHost(card, t) {
      var h = t;
      while (h.parentElement && h.parentElement !== card) h = h.parentElement;
      return h;
    }
    function coverMap(rows) {
      var cover = new Array(rows.length);
      for (var i = 0; i < rows.length; i++) {
        var max = i;
        for (var j = 0; j < rows[i].cells.length; j++) {
          var rs = rows[i].cells[j].rowSpan || 1;
          if (rs > 1) max = Math.max(max, i + rs - 1);
        }
        cover[i] = Math.max(max, i > 0 ? cover[i - 1] : 0);
      }
      return cover;
    }
    function lastSafe(cover, from, to) {
      for (var i = Math.min(to, cover.length - 1); i >= from; i--) if (cover[i] <= i) return i + 1;
      return 0;
    }
    function shellFor(card, t, tp, cont) {
      var c = card.cloneNode(false);
      if (cont) c.classList.add('card-cont');
      var h = card.querySelector('h4');
      if (h) c.appendChild(clone(h));
      var headRow = card.querySelector('.an-card-head-row');
      if (headRow && !cont) {
        var hr = clone(headRow);
        hr.querySelectorAll('.btn').forEach(function (b) { b.remove(); });
        c.appendChild(hr);
      }
      var wrap = tp.cloneNode(false);
      var nt = t.cloneNode(true);
      while (nt.tBodies.length) nt.removeChild(nt.tBodies[0]);
      var tb = document.createElement('tbody');
      nt.appendChild(tb);
      wrap.appendChild(nt);
      c.appendChild(wrap);
      return { card: c, tbody: tb };
    }
    function placeTableCard(card) {
      var t = tableOf(card);
      if (!t) return false;
      var rows = rowsOf(t);
      if (!rows || rows.length < 4) return false;
      var tp = tableHost(card, t);
      var cover = coverMap(rows);
      var notes = [];
      Array.prototype.slice.call(card.children).forEach(function (n) {
        if (n === tp) return;
        if (n.matches && (n.matches('h4') || n.matches('.an-card-head-row'))) return;
        notes.push(clone(n));
      });
      var idx = 0, guard = 0;
      while (idx < rows.length && guard++ < 400) {
        var sh = shellFor(card, t, tp, idx > 0);
        if (!fits(sh.card)) {
          if (body.childNodes.length) newPage();
          if (!fits(sh.card)) add(sh.card);
        }
        var added = 0;
        while (idx + added < rows.length) {
          var tr = clone(rows[idx + added]);
          sh.tbody.appendChild(tr);
          if (over()) { sh.tbody.removeChild(tr); break; }
          added++;
        }
        if (added === 0) { sh.tbody.appendChild(clone(rows[idx])); added = 1; }
        if (idx + added < rows.length) {
          var safe = lastSafe(cover, idx, idx + added - 1);
          if (safe > idx && safe < idx + added) {
            var cut = idx + added - safe;
            for (var k = 0; k < cut; k++) sh.tbody.removeChild(sh.tbody.lastChild);
            added = safe - idx;
          }
        }
        idx += added;
        if (idx < rows.length) newPage();
        else if (notes.length) {
          var holder = card.cloneNode(false);
          holder.classList.add('card-cont');
          notes.forEach(function (n) { holder.appendChild(n); });
          if (!fits(holder)) { newPage(); add(holder); }
        }
      }
      return true;
    }

    function gridCols(el) {
      if (!el.classList) return 0;
      if (el.classList.contains('an-grid-2')) return 2;
      if (el.classList.contains('an-interp')) return 3;
      if (el.classList.contains('an-flows')) return 3;
      return 0;
    }
    function placeGrid(el, cols) {
      var kids = Array.prototype.slice.call(el.children);
      for (var i = 0; i < kids.length; i += cols) {
        var row = el.cloneNode(false);
        kids.slice(i, i + cols).forEach(function (k) { row.appendChild(clone(k)); });
        if (!fits(row)) {
          newPage();
          if (!fits(row)) add(row);
        }
      }
      return true;
    }
    function placeUnit(unit) {
      if (fits(unit)) return true;
      // data-keep="1"：小表不允许拆行，放不下就整块挪到下一页；仍放不下再按行拆
      if (unit.getAttribute && unit.getAttribute('data-keep') === '1' && body.childNodes.length) {
        newPage();
        if (fits(unit)) return true;
      }
      var cols = gridCols(unit);
      if (cols) return placeGrid(unit, cols);
      if (tableOf(unit)) {
        var rows = rowsOf(tableOf(unit));
        if (rows && rows.length >= 4) return placeTableCard(unit);
      }
      return false;
    }

    // ---------- 封面 ----------
    var coverEl = src.querySelector('.an-cover');
    if (withCover && coverEl) {
      newPage('cover');
      add(clone(coverEl));
    }
    if (coverEl) coverEl.remove();

    // ---------- 正文 ----------
    chapters.forEach(function (ch) {
      var head = ch.querySelector('.an-chapter-head');
      var bodyEl = ch.querySelector('.an-chapter-body');
      if (compact && body && body.childNodes.length && remain() > 160) {
        // 区域简报：章节内容少，允许接排，但保持 12mm 间隔
        var hc0 = clone(head);
        hc0.classList.add('flow');
        if (!fits(hc0)) { newPage(); add(hc0); }
        else if (bodyEl && bodyEl.children.length) {
          // 章头不能被“孤立”：若首个内容块放不进本页，章头跟着去下一页
          var probe = clone(bodyEl.children[0]);
          var probeFit = fits(probe);
          if (probeFit) body.removeChild(probe);
          else {
            body.removeChild(hc0);
            newPage();
            add(hc0);
          }
        }
      } else {
        newPage(); // 章一定另起一页
        if (head) add(clone(head));
      }
      if (!bodyEl) return;
      var kids = Array.prototype.slice.call(bodyEl.children);
      kids.forEach(function (kid) {
        if (kid.classList && kid.classList.contains('an-section')) {
          if (kid.getAttribute('data-break') === 'page' && body.childNodes.length) newPage();
          var sh = clone(kid.querySelector('.an-section-head'));
          if (body.childNodes.length && remain() < 130) newPage();
          if (!fits(sh)) newPage();
          if (!sh.parentNode) add(sh);
          var sbody = kid.querySelector('.an-section-body');
          if (!sbody) return;
          Array.prototype.slice.call(sbody.children).forEach(function (block) {
            var u = clone(block);
            if (placeUnit(u)) return;
            newPage();
            if (!placeUnit(u)) add(u);
          });
        } else {
          var u2 = clone(kid);
          if (placeUnit(u2)) return;
          newPage();
          if (!placeUnit(u2)) add(u2);
        }
      });
    });

    // ---------- 锚点页码 ----------
    var anchorPage = {};
    pages.forEach(function (p, i) {
      p.querySelectorAll('[data-anchor]').forEach(function (n) {
        var k = n.getAttribute('data-anchor');
        if (anchorPage[k] == null) anchorPage[k] = i;
      });
    });

    // 章标签按页归属
    var cur = '';
    pages.forEach(function (p) {
      var h = p.querySelector('[data-toc="1"]');
      if (h) cur = (h.getAttribute('data-toc-label') || '').trim();
      p.setAttribute('data-chapter', cur);
    });
    var frontCount = (withCover && coverEl) ? 1 : 0;

    // ---------- 目录页 ----------
    var tocPages = [];
    if (toc.length) {
      var tocStage = document.createElement('div');
      tocStage.className = 'toc-stage';
      document.body.appendChild(tocStage);
      var tp = null, tb = null;
      function newTocPage(first) {
        var pg = document.createElement('div');
        pg.className = 'pg pg-toc';
        var head = document.createElement('div');
        head.className = 'pg-head';
        head.innerHTML = '<span class="pg-head-title">' + esc(title) + '</span><span class="pg-head-chapter">目录</span>';
        var b = document.createElement('div');
        b.className = 'pg-body';
        var f = document.createElement('div');
        f.className = 'pg-foot';
        pg.appendChild(head);
        pg.appendChild(b);
        pg.appendChild(f);
        if (first) {
          var t = document.createElement('div');
          t.className = 'toc-title';
          t.textContent = '目 录';
          b.appendChild(t);
          var meta = document.createElement('div');
          meta.className = 'toc-meta';
          meta.textContent = 'A4 · 三级目录 · 页码对应正文';
          b.appendChild(meta);
        }
        tocPages.push(pg);
        tocStage.appendChild(pg);
        tp = pg; tb = b;
        return b;
      }
      newTocPage(true);
      toc.forEach(function (t) {
        var row = document.createElement('div');
        row.className = 'toc-row toc-l' + t.level;
        var num = anchorPage[t.anchor];
        var pageNo = num == null ? '' : String(num - frontCount + 1);
        row.innerHTML = '<span class="toc-label">' + esc(t.label) + '</span><span class="toc-dots"></span><span class="toc-page">' + pageNo + '</span>';
        tb.appendChild(row);
        if (tb.scrollHeight > tb.clientHeight + 1) {
          tb.removeChild(row);
          tb = newTocPage(false);
          tb.appendChild(row);
        }
      });
      var insertAt = (withCover && coverEl) ? 1 : 0;
      var ref = pagesEl.children[insertAt] || null;
      tocPages.forEach(function (pg) { pagesEl.insertBefore(pg, ref); });
      tocStage.remove();
    }

    // ---------- 页眉页脚 ----------
    var all = Array.prototype.slice.call(pagesEl.querySelectorAll('.pg'));
    var front = all.filter(function (p) { return p.classList.contains('pg-cover') || p.classList.contains('pg-toc'); }).length;
    all.forEach(function (p, i) {
      if (p.classList.contains('pg-cover')) return;
      var head = p.querySelector('.pg-head');
      var foot = p.querySelector('.pg-foot');
      if (p.classList.contains('pg-toc')) {
        if (!head.innerHTML) head.innerHTML = '<span class="pg-head-title">' + esc(title) + '</span><span class="pg-head-chapter">目录</span>';
        foot.textContent = '';
        return;
      }
      var ch = p.getAttribute('data-chapter') || '';
      head.innerHTML = '<span class="pg-head-title">' + esc(title) + '</span><span class="pg-head-chapter">' + esc(ch) + '</span>';
      foot.textContent = '第 ' + (i - front + 1) + ' 页 / 共 ' + (all.length - front) + ' 页';
    });

    // ---------- 侧边目录定位（仅屏幕，不进 PDF） ----------
    (function buildSideToc() {
      document.querySelectorAll('.paper-toc, .pt-fab').forEach(function (n) { n.remove(); });
      if (!toc.length) return;

      var inApp = !!document.querySelector('.app-shell');
      var domPage = {};
      all.forEach(function (p, i) {
        p.querySelectorAll('[data-anchor]').forEach(function (n) {
          var k = n.getAttribute('data-anchor');
          if (domPage[k] == null) { domPage[k] = i; if (!n.id) n.id = 'a-' + k; }
        });
      });
      function pageNo(k) {
        var i = domPage[k];
        return i == null ? '' : String(i - front + 1);
      }

      var panel = document.createElement('aside');
      panel.className = 'paper-toc' + (inApp ? ' in-app' : '');
      panel.setAttribute('aria-label', '报告目录');
      var head = document.createElement('div');
      head.className = 'pt-head';
      head.innerHTML = '<b>目录</b><span class="pt-progress"></span>';
      var list = document.createElement('div');
      list.className = 'pt-body';
      panel.appendChild(head);
      panel.appendChild(list);

      var chapEl = null, secEl = null, secBlocks = null;
      toc.forEach(function (t) {
        var no = pageNo(t.anchor);
        if (t.level === 1) {
          chapEl = document.createElement('div');
          chapEl.className = 'pt-chapter';
          var a1 = document.createElement('a');
          a1.className = 'pt-l1';
          a1.href = '#a-' + t.anchor;
          a1.setAttribute('data-anchor', t.anchor);
          a1.title = t.label;
          a1.innerHTML = '<span class="pt-label">' + esc(t.label) + '</span><span class="pt-page">' + no + '</span>';
          chapEl.appendChild(a1);
          list.appendChild(chapEl);
          secEl = null; secBlocks = null;
        } else if (t.level === 2) {
          secEl = document.createElement('div');
          secEl.className = 'pt-sec';
          var a2 = document.createElement('a');
          a2.className = 'pt-l2';
          a2.href = '#a-' + t.anchor;
          a2.setAttribute('data-anchor', t.anchor);
          a2.title = t.label;
          a2.innerHTML = '<span class="pt-label">' + esc(t.label) + '</span><span class="pt-page">' + no + '</span>';
          secEl.appendChild(a2);
          (chapEl || list).appendChild(secEl);
          secBlocks = null;
        } else {
          if (!secBlocks) {
            secBlocks = document.createElement('div');
            secBlocks.className = 'pt-blocks';
            (secEl || chapEl || list).appendChild(secBlocks);
            if (secEl) {
              var caret = document.createElement('button');
              caret.type = 'button';
              caret.className = 'pt-caret';
              caret.setAttribute('aria-label', '展开本节的图表');
              caret.textContent = '▸';
              secEl.insertBefore(caret, secEl.firstChild);
            }
          }
          var a3 = document.createElement('a');
          a3.className = 'pt-l3';
          a3.href = '#a-' + t.anchor;
          a3.setAttribute('data-anchor', t.anchor);
          a3.title = t.label;
          a3.innerHTML = '<span class="pt-label">' + esc(t.label) + '</span><span class="pt-page">' + no + '</span>';
          secBlocks.appendChild(a3);
        }
      });

      var fab = document.createElement('button');
      fab.type = 'button';
      fab.className = 'pt-fab' + (inApp ? ' in-app' : '');
      fab.textContent = '目录';

      panel.addEventListener('click', function (ev) {
        var caret = ev.target.closest ? ev.target.closest('.pt-caret') : null;
        if (caret) {
          var sec = caret.parentNode;
          sec.classList.toggle('open');
          return;
        }
        var link = ev.target.closest ? ev.target.closest('[data-anchor]') : null;
        if (!link) return;
        ev.preventDefault();
        var anchor = link.getAttribute('data-anchor');
        var target = document.querySelector('[data-anchor="' + anchor + '"]');
        if (!target) return;
        var offset = inApp ? 78 : 14;
        var top = target.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
        panel.classList.remove('open');
      });
      fab.addEventListener('click', function () { panel.classList.toggle('open'); });

      document.body.appendChild(panel);
      document.body.appendChild(fab);
      document.body.classList.add('has-paper-toc');

      var progress = head.querySelector('.pt-progress');
      var links = Array.prototype.slice.call(panel.querySelectorAll('[data-anchor]'));
      var entries = links.map(function (a) {
        var k = a.getAttribute('data-anchor');
        return { el: a, page: domPage[k] == null ? null : domPage[k] };
      });
      var activeEl = null;
      var total = all.length - front;

      function setActive(idx) {
        var found = null;
        for (var i = 0; i < entries.length; i++) {
          if (entries[i].page != null && entries[i].page <= idx) found = entries[i];
        }
        if (!found) { if (activeEl) activeEl.classList.remove('is-active'); activeEl = null; return; }
        if (found.el === activeEl) return;
        if (activeEl) activeEl.classList.remove('is-active');
        activeEl = found.el;
        activeEl.classList.add('is-active');
        var sec = activeEl.closest ? activeEl.closest('.pt-sec') : null;
        if (sec) sec.classList.add('open');
        var r = activeEl.getBoundingClientRect(), pr = list.getBoundingClientRect();
        if (r.top < pr.top + 8) list.scrollTop -= (pr.top + 8 - r.top);
        else if (r.bottom > pr.bottom - 8) list.scrollTop += (r.bottom - pr.bottom + 8);
      }

      var ticking = false;
      function sync() {
        ticking = false;
        var probe = window.scrollY + (inApp ? 96 : 40);
        var cur = 0;
        for (var i = 0; i < all.length; i++) {
          var top = all[i].getBoundingClientRect().top + window.scrollY;
          if (top <= probe) cur = i; else break;
        }
        setActive(cur);
        var n = cur - front + 1;
        if (n >= 1 && n <= total) progress.textContent = '第 ' + n + ' / ' + total + ' 页';
        else progress.textContent = '共 ' + total + ' 页';
      }
      window.addEventListener('scroll', function () {
        if (ticking) return;
        ticking = true;
        setTimeout(function () { ticking = false; sync(); }, 70);
      }, { passive: true });
      setTimeout(sync, 30);
    })();

    // 4. 替换
    host.parentNode.insertBefore(pagesEl, host.nextSibling);
    host.parentNode.removeChild(host);

    window.__PAGES__ = all.length;
    window.__BODY_PAGES__ = all.length - front;
    window.__TOC_PAGES__ = tocPages.length;
    document.documentElement.setAttribute('data-pages', String(all.length));
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; });
  }

  window.PaginateReport = run;
  if (window.__AUTO_PAGINATE__ !== false) {
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(run);
    else run();
  }
})();
