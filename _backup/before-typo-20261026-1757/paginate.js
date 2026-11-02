/* 构建期分页：把 .an-page 切成一页一 A4，页脚写真实页码 */
(function () {
  'use strict';

  function run() {
    var src = document.querySelector('.an-page');
    if (!src) { window.__PAGES__ = 0; return; }

    var pagesEl = document.createElement('div');
    pagesEl.className = 'pages';
    document.body.appendChild(pagesEl);
    src.style.display = 'none';
    var page = null, body = null;

    function newPage() {
      page = document.createElement('div');
      page.className = 'pg';
      body = document.createElement('div');
      body.className = 'pg-body';
      page.appendChild(body);
      pagesEl.appendChild(page);
    }

    function over() { return body.scrollHeight > body.clientHeight + 1; }

    function fixTables(el) {
      if (!el.querySelectorAll) return;
      Array.prototype.forEach.call(el.querySelectorAll('table'), function (t) {
        var wrap = t.parentElement;
        if (wrap && t.scrollWidth > wrap.clientWidth + 2) t.classList.add('fit-table');
      });
    }

    function fits(el) {
      body.appendChild(el);
      fixTables(el);
      if (over()) { body.removeChild(el); return false; }
      return true;
    }

    function clone(el) { return el.cloneNode(true); }

    function tableOf(card) {
      return card.querySelector ? card.querySelector('table') : null;
    }

    function tableHost(card, t) {
      var host = t;
      while (host.parentElement && host.parentElement !== card) host = host.parentElement;
      return host;
    }

    function rowsOf(t) {
      return t && t.tBodies && t.tBodies[0] ? Array.prototype.slice.call(t.tBodies[0].rows) : null;
    }

    // 每行被 rowspan 覆盖到的最远行号；cut after row i 安全 <=> cover[i] <= i
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
      for (var i = Math.min(to, cover.length - 1); i >= from; i--) {
        if (cover[i] <= i) return i + 1;
      }
      return 0;
    }

    function shellFor(card, t, host, cont) {
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
      var wrap = host.cloneNode(false);
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
      var host = tableHost(card, t);
      var cover = coverMap(rows);
      var notes = [];
      Array.prototype.slice.call(card.children).forEach(function (n) {
        if (n === host) return;
        if (n.matches && (n.matches('h4') || n.matches('.an-card-head-row'))) return;
        notes.push(clone(n));
      });
      var idx = 0, guard = 0;
      while (idx < rows.length && guard++ < 300) {
        var sh = shellFor(card, t, host, idx > 0);
        if (!fits(sh.card)) {
          if (body.childNodes.length) newPage();
          if (!fits(sh.card)) body.appendChild(sh.card);
        }
        var added = 0;
        while (idx + added < rows.length) {
          var tr = clone(rows[idx + added]);
          sh.tbody.appendChild(tr);
          if (over()) { sh.tbody.removeChild(tr); break; }
          added++;
        }
        if (added === 0) {
          sh.tbody.appendChild(clone(rows[idx]));
          added = 1;
        }
        if (idx + added < rows.length) {
          var safe = lastSafe(cover, idx, idx + added - 1);
          if (safe > idx && safe < idx + added) {
            var cut = idx + added - safe;
            for (var k = 0; k < cut; k++) sh.tbody.removeChild(sh.tbody.lastChild);
            added = safe - idx;
            // 去掉 cut 行后可能能多放，但不再回补，保证安全
          }
        }
        idx += added;
        if (idx < rows.length) newPage();
        else notes.forEach(function (n) { sh.card.appendChild(n); });
      }
      return true;
    }

    function explode(el) {
      var c = el.cloneNode(false);
      c.classList.add('stacked');
      Array.prototype.slice.call(el.children).forEach(function (n) { c.appendChild(clone(n)); });
      return Array.prototype.slice.call(c.children);
    }

    function placeBlock(el) {
      if (fits(el)) return true;
      if (!body.childNodes.length) {
        if (placeTableCard(el)) return true;
        var kids = explode(el);
        for (var i = 0; i < kids.length; i++) {
          if (!fits(kids[i])) { newPage(); body.appendChild(kids[i]); }
        }
        return true;
      }
      return false;
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
          if (!fits(row)) body.appendChild(row);
        }
      }
      return true;
    }

    // 尝试把一块内容放好：整块 -> 栅格按行 -> 长表按行
    function placeUnit(unit) {
      if (fits(unit)) return true;
      var cols = gridCols(unit);
      if (cols) return placeGrid(unit, cols);
      var t = tableOf(unit);
      if (t) {
        var rows = rowsOf(t);
        if (rows && rows.length >= 12) return placeTableCard(unit);
      }
      return false;
    }

    newPage();
    var cover = src.querySelector('.an-cover');
    if (cover) {
      var cov = clone(cover);
      if (!fits(cov)) newPage();
    }

    var chapters = src.querySelectorAll('.an-chapter');
    for (var ci = 0; ci < chapters.length; ci++) {
      var ch = chapters[ci];
      var head = ch.querySelector('.an-chapter-head');
      var headEl = head ? clone(head) : null;
      var placedAny = false;
      if (headEl) {
        if (!fits(headEl)) newPage();
      }
      var bodyEl = ch.querySelector('.an-chapter-body');
      var kids = bodyEl ? Array.prototype.slice.call(bodyEl.children) : [];
      for (var bi = 0; bi < kids.length; bi++) {
        var unit = clone(kids[bi]);
        if (placeUnit(unit)) { placedAny = true; continue; }
        // 换页；若本章还没放下任何内容，章标题一起搬到新页
        newPage();
        if (headEl && !placedAny && headEl.parentNode) headEl.parentNode.removeChild(headEl);
        if (headEl && !headEl.parentNode) body.appendChild(headEl);
        if (placeUnit(unit)) { placedAny = true; continue; }
        body.appendChild(unit);
        placedAny = true;
      }
    }

    var pages = Array.prototype.slice.call(pagesEl.querySelectorAll('.pg'));
    pages.forEach(function (p, i) {
      var f = document.createElement('div');
      f.className = 'pg-foot';
      f.textContent = '第 ' + (i + 1) + ' 页 / 共 ' + pages.length + ' 页';
      p.appendChild(f);
    });

    src.parentNode.removeChild(src);
    document.documentElement.setAttribute('data-pages', String(pages.length));
    window.__PAGES__ = pages.length;
  }

  if (document.fonts && document.fonts.ready) document.fonts.ready.then(run);
  else run();
})();



