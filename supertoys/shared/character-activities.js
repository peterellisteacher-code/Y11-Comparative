/* ================================================================
   character-activities.js — Shared logic for all character pages
   Super-Toys Last All Summer Long | Aldiss Intertextual Unit
   ================================================================ */
(function () {
  'use strict';

  /* ── Sprite Animation ──────────────────────────────────────── */
  function initSprite (cfg) {
    var wrap = document.getElementById('sprite-wrap');
    if (!wrap || !cfg) return;

    var basePath  = cfg.basePath;
    var animation = cfg.animation;
    var direction = cfg.direction;
    var frames    = cfg.frames;
    var fps       = cfg.fps;

    // Build source paths
    var sources = [];
    for (var i = 0; i < frames; i++) {
      sources.push(basePath + '/animations/' + animation + '/' + direction + '/frame_' + String(i).padStart(3, '0') + '.png');
    }

    // Pre-load all frames as Image objects (4 HTTP requests total, then done)
    var loaded = 0;
    var imgs = sources.map(function (src) {
      var img = new Image();
      img.onload = function () {
        loaded++;
        if (loaded === frames) startAnimation();
      };
      img.src = src;
      return img;
    });

    // Canvas avoids repeated HTTP requests during animation — draws from memory
    var canvas = document.createElement('canvas');
    canvas.width  = 248;
    canvas.height = 248;
    canvas.setAttribute('aria-hidden', 'true');
    wrap.appendChild(canvas);
    var ctx = canvas.getContext('2d');

    var frame = 0;
    function startAnimation () {
      function tick () {
        ctx.clearRect(0, 0, 248, 248);
        ctx.drawImage(imgs[frame], 0, 0, 248, 248);
        frame = (frame + 1) % frames;
      }
      tick();
      setInterval(tick, Math.round(1000 / fps));
    }
  }

  /* ── Tab Switching ─────────────────────────────────────────── */
  function initTabs () {
    var btns   = document.querySelectorAll('.tab-btn');
    var panels = document.querySelectorAll('.tab-panel');

    btns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        btns.forEach(function (b) {
          b.classList.remove('active');
          b.setAttribute('aria-selected', 'false');
        });
        panels.forEach(function (p) {
          p.classList.remove('active');
          p.setAttribute('aria-hidden', 'true');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-selected', 'true');
        var panel = document.getElementById(btn.dataset.tab);
        if (panel) {
          panel.classList.add('active');
          panel.setAttribute('aria-hidden', 'false');
        }
      });
    });
  }

  /* ── Auto-Save (localStorage) ──────────────────────────────── */
  function initAutoSave (charId) {
    var prefix = 'supertoys-' + charId;

    // Restore saved values on load
    document.querySelectorAll('[data-save]').forEach(function (el) {
      var key   = prefix + '-' + el.dataset.save;
      var saved = localStorage.getItem(key);
      if (saved !== null) el.value = saved;
    });

    // Save on input (debounced 400 ms)
    var timer;
    document.addEventListener('input', function (e) {
      var el = e.target;
      if (!el.dataset || !el.dataset.save) return;
      clearTimeout(timer);
      timer = setTimeout(function () {
        var key = prefix + '-' + el.dataset.save;
        localStorage.setItem(key, el.value);
      }, 400);
    });
  }

  /* ── Word Chip Toggling (Activity 1) ───────────────────────── */
  function initChips () {
    document.querySelectorAll('.chip[data-word]').forEach(function (chip) {
      chip.addEventListener('click', function () {
        chip.classList.toggle('used');
      });
    });
  }

  /* ── Word Expansion (Activity 2) ───────────────────────────── */
  function initExpansion (charId) {
    var prefix = 'supertoys-' + charId + '-exp';

    function makeUserChip (word, cat) {
      var chip = document.createElement('button');
      chip.type        = 'button';
      chip.className   = 'chip chip-user';
      chip.textContent = word;
      chip.dataset.word = word;
      chip.title       = 'Click to remove';
      chip.addEventListener('click', function () {
        chip.remove();
        saveExpanded();
      });
      return chip;
    }

    function saveExpanded () {
      var data = {};
      document.querySelectorAll('.chip-cloud[data-expanded]').forEach(function (cloud) {
        var cat  = cloud.dataset.expanded;
        var words = Array.from(cloud.querySelectorAll('.chip-user')).map(function (c) { return c.textContent; });
        data[cat] = words;
      });
      localStorage.setItem(prefix, JSON.stringify(data));
    }

    function loadExpanded () {
      var raw = localStorage.getItem(prefix);
      if (!raw) return;
      try {
        var data = JSON.parse(raw);
        Object.keys(data).forEach(function (cat) {
          var cloud = document.querySelector('.chip-cloud[data-expanded="' + cat + '"]');
          if (cloud) data[cat].forEach(function (w) { cloud.appendChild(makeUserChip(w, cat)); });
        });
      } catch (e) { /* ignore corrupted data */ }
    }

    loadExpanded();

    document.querySelectorAll('.word-input').forEach(function (input) {
      var cat = input.dataset.category;

      function addWord () {
        var word = input.value.trim();
        if (!word) return;
        var cloud = document.querySelector('.chip-cloud[data-expanded="' + cat + '"]');
        if (cloud) {
          cloud.appendChild(makeUserChip(word, cat));
          saveExpanded();
        }
        input.value = '';
        input.focus();
      }

      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); addWord(); }
      });

      var btn = input.parentElement.querySelector('.add-btn');
      if (btn) btn.addEventListener('click', addWord);
    });
  }

  /* ── PDF Export ────────────────────────────────────────────── */
  function loadJsPdf (cb) {
    if (window.jspdf) { cb(); return; }
    var s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    s.onload = cb;
    document.head.appendChild(s);
  }

  function buildSuperToysPdf (charId) {
    var jsPDF = window.jspdf.jsPDF;
    var doc = new jsPDF({ unit: 'mm', format: 'a4' });
    var L = 20, W = 170, BOTTOM = 278;
    var y = 20;
    var charName = (document.querySelector('.page-title') || {}).textContent;
    charName = (charName || charId).trim();
    var prefix = 'supertoys-' + charId;

    function ensure (h) {
      if (y + h > BOTTOM) { doc.addPage(); y = 20; }
    }
    function rule () {
      ensure(4);
      doc.setDrawColor(190, 190, 190);
      doc.line(L, y, L + W, y);
      y += 5;
    }
    function section (title) {
      ensure(10);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(50, 50, 50);
      doc.text(title, L, y);
      y += 6;
      rule();
    }
    function subheading (label) {
      ensure(7);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(90, 90, 90);
      doc.text(label, L, y);
      y += 5;
    }
    function paragraph (text, opts) {
      opts = opts || {};
      var body = (text == null || text === '') ? '(nothing written yet)' : String(text);
      doc.setFont(opts.font || 'times', opts.style || 'normal');
      doc.setFontSize(opts.size || 11);
      doc.setTextColor(opts.r == null ? 25 : opts.r, opts.g == null ? 25 : opts.g, opts.b == null ? 25 : opts.b);
      var lines = doc.splitTextToSize(body, W - (opts.indent || 0));
      lines.forEach(function (line) {
        ensure(5.5);
        doc.text(line, L + (opts.indent || 0), y);
        y += 5.5;
      });
      y += 2;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(110, 110, 110);
    doc.text('SUPER-TOYS LAST ALL SUMMER LONG — CHARACTER STUDY', L, y);
    y += 7;

    doc.setFontSize(20);
    doc.setTextColor(30, 30, 30);
    doc.text(charName, L, y);
    y += 7;
    rule();

    // Activity 1 — Word Bank
    section('Activity 1 — Word Bank');
    var usedChips = Array.prototype.map.call(
      document.querySelectorAll('#activity1 .chip.used'),
      function (c) { return (c.dataset.word || c.textContent || '').trim(); }
    ).filter(Boolean);
    subheading('Words used from the bank');
    paragraph(usedChips.length ? usedChips.join(', ') : '(none selected)', { font: 'helvetica', size: 10 });

    [
      { key: 'a1-characteristics', label: 'Characteristics' },
      { key: 'a1-desires',         label: 'Desires' },
      { key: 'a1-goals',           label: 'Goals' },
      { key: 'a1-fears',           label: 'Fears' }
    ].forEach(function (row) {
      subheading(row.label);
      var ta = document.querySelector('[data-save="' + row.key + '"]');
      var val = ta ? ta.value : localStorage.getItem(prefix + '-' + row.key);
      paragraph(val);
    });

    // Activity 2 — Selected Lines
    section('Activity 2 — Selected Lines');
    var selectedIdxs = [];
    try { selectedIdxs = JSON.parse(localStorage.getItem(prefix + '-selected-lines') || '[]'); } catch (e) {}
    var lines = window.CHARACTER_LINES || [];
    if (!selectedIdxs.length) {
      paragraph('(no lines selected yet)', { font: 'helvetica', style: 'italic', size: 10, r: 110, g: 110, b: 110 });
    } else {
      selectedIdxs.forEach(function (idx, i) {
        var text = lines[idx];
        if (!text) return;
        paragraph((i + 1) + '. “' + text + '”');
      });
    }

    // Activity 3 — Reasons
    section('Activity 3 — Why These Lines');
    if (!selectedIdxs.length) {
      paragraph('(Activity 2 not completed)', { font: 'helvetica', style: 'italic', size: 10, r: 110, g: 110, b: 110 });
    } else {
      selectedIdxs.forEach(function (idx) {
        var text = lines[idx];
        if (!text) return;
        var key = prefix + '-a3-reason-' + idx;
        var liveTa = document.querySelector('[data-save="a3-reason-' + idx + '"]');
        var reason = liveTa ? liveTa.value : localStorage.getItem(key);
        subheading('“' + text + '”');
        paragraph(reason);
      });
    }

    // Activity 4 — Monologue
    section('Activity 4 — Monologue');
    var monoTa = document.querySelector('[data-save="a4-monologue"]');
    var mono = monoTa ? monoTa.value : localStorage.getItem(prefix + '-a4-monologue');
    paragraph(mono, { font: 'times', size: 12 });

    var slug = charName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || charId;
    doc.save(slug + '-character-study.pdf');
  }

  function initPdf (charId) {
    var btn = document.getElementById('pdf-btn');
    if (!btn) return;
    btn.addEventListener('click', function () {
      loadJsPdf(function () { buildSuperToysPdf(charId); });
    });
  }

  /* ══════════════════════════════════════════════════════════
     POS MAP — read Activity 1 word bank to categorise words
     ══════════════════════════════════════════════════════════ */
  function buildPosMap () {
    var map = {};
    var catMap = { verbs: 'verb', nouns: 'noun', adjectives: 'adj', adverbs: 'adv' };
    var cols = document.querySelectorAll('#activity1 .word-bank-grid > div');
    cols.forEach(function (col) {
      var header = col.querySelector('.word-col-header');
      if (!header) return;
      var key = catMap[header.textContent.trim().toLowerCase()];
      if (!key) return;
      col.querySelectorAll('.chip').forEach(function (chip) {
        var w = (chip.dataset.word || chip.textContent || '').trim().toLowerCase();
        if (w) map[w] = key;
      });
    });
    return map;
  }

  function highlightLine (text, posMap) {
    return text.replace(/([A-Za-z][A-Za-z']*)/g, function (w) {
      var key = w.toLowerCase();
      var pos = posMap[key];
      if (!pos) return w;
      return '<span class="pos-' + pos + '">' + w + '</span>';
    });
  }

  /* ══════════════════════════════════════════════════════════
     Activity 2 — Line Selection (up to 5)
     ══════════════════════════════════════════════════════════ */
  function initLineSelection (charId) {
    var list = document.getElementById('line-list');
    if (!list) return;

    var lines = window.CHARACTER_LINES || [];
    var max = Math.min(5, lines.length);
    var counter = document.getElementById('line-counter');
    var storeKey = 'supertoys-' + charId + '-selected-lines';

    // Build items
    lines.forEach(function (text, i) {
      var item = document.createElement('button');
      item.type = 'button';
      item.className = 'line-item';
      item.dataset.idx = String(i);
      var check = document.createElement('span');
      check.className = 'line-check';
      check.textContent = '✓';
      var span = document.createElement('span');
      span.className = 'line-text';
      span.textContent = text;
      item.appendChild(check);
      item.appendChild(span);
      list.appendChild(item);
    });

    function currentSelected () {
      return Array.from(list.querySelectorAll('.line-item.selected'))
        .map(function (el) { return parseInt(el.dataset.idx, 10); });
    }

    function updateCounter () {
      var n = currentSelected().length;
      if (counter) counter.textContent = n + ' of ' + max + ' selected';
      var full = n >= max;
      list.querySelectorAll('.line-item').forEach(function (el) {
        if (!el.classList.contains('selected')) {
          el.classList.toggle('disabled', full);
        }
      });
    }

    function save () {
      localStorage.setItem(storeKey, JSON.stringify(currentSelected()));
    }

    function load () {
      var raw = localStorage.getItem(storeKey);
      if (!raw) { updateCounter(); return; }
      try {
        JSON.parse(raw).forEach(function (i) {
          var el = list.querySelector('.line-item[data-idx="' + i + '"]');
          if (el) el.classList.add('selected');
        });
      } catch (e) { /* ignore */ }
      updateCounter();
    }

    list.addEventListener('click', function (e) {
      var item = e.target.closest('.line-item');
      if (!item) return;
      var isSelected = item.classList.contains('selected');
      if (!isSelected && item.classList.contains('disabled')) return;
      item.classList.toggle('selected');
      save();
      updateCounter();
    });

    load();
  }

  /* ══════════════════════════════════════════════════════════
     Activity 3 — populate highlight blocks + reason textareas
     ══════════════════════════════════════════════════════════ */
  function populateActivity3 (charId) {
    var container = document.getElementById('a3-highlight-list');
    if (!container) return;
    var selected = [];
    try { selected = JSON.parse(localStorage.getItem('supertoys-' + charId + '-selected-lines') || '[]'); } catch (e) {}
    var lines = window.CHARACTER_LINES || [];
    var posMap = window.__ST_POS_MAP || (window.__ST_POS_MAP = buildPosMap());

    container.innerHTML = '';
    if (!selected.length) {
      var empty = document.createElement('p');
      empty.className = 'a4-empty';
      empty.textContent = 'Go back to Activity 2 and select your lines first.';
      container.appendChild(empty);
      return;
    }

    selected.forEach(function (idx) {
      var text = lines[idx];
      if (!text) return;
      var block = document.createElement('div');
      block.className = 'highlight-block';
      var lineEl = document.createElement('div');
      lineEl.className = 'highlight-line';
      lineEl.innerHTML = highlightLine(text, posMap);
      var row = document.createElement('div');
      row.className = 'reason-row';
      var lbl = document.createElement('span');
      lbl.className = 'reason-label';
      lbl.textContent = 'Why is this line important to the character?';
      var ta = document.createElement('textarea');
      ta.dataset.save = 'a3-reason-' + idx;
      ta.placeholder = 'What do these heavy-lifting words reveal about them?';
      // restore saved value
      var saved = localStorage.getItem('supertoys-' + charId + '-' + ta.dataset.save);
      if (saved !== null) ta.value = saved;
      row.appendChild(lbl);
      row.appendChild(ta);
      block.appendChild(lineEl);
      block.appendChild(row);
      container.appendChild(block);
    });
  }

  /* ══════════════════════════════════════════════════════════
     Activity 4 — left panel: selected lines + reasons
     ══════════════════════════════════════════════════════════ */
  function populateActivity4 (charId) {
    var leftList = document.getElementById('a4-lines');
    if (!leftList) return;
    var selected = [];
    try { selected = JSON.parse(localStorage.getItem('supertoys-' + charId + '-selected-lines') || '[]'); } catch (e) {}
    var lines = window.CHARACTER_LINES || [];

    leftList.innerHTML = '';
    if (!selected.length) {
      var empty = document.createElement('p');
      empty.className = 'a4-empty';
      empty.textContent = 'Select lines in Activity 2 and add reasons in Activity 3 — they will appear here to anchor your monologue.';
      leftList.appendChild(empty);
      return;
    }

    selected.forEach(function (idx) {
      var text = lines[idx];
      if (!text) return;
      var reason = localStorage.getItem('supertoys-' + charId + '-a3-reason-' + idx) || '';
      var block = document.createElement('div');
      block.className = 'a4-lineblock';
      var l = document.createElement('div');
      l.className = 'a4-line';
      l.textContent = text;
      block.appendChild(l);
      if (reason.trim()) {
        var r = document.createElement('div');
        r.className = 'a4-reason';
        r.textContent = reason;
        block.appendChild(r);
      }
      leftList.appendChild(block);
    });
  }

  /* ══════════════════════════════════════════════════════════
     Tab-change hooks for activity 3 / 4 population + layout
     ══════════════════════════════════════════════════════════ */
  function initActivityHooks (charId) {
    var body = document.querySelector('.page-body');
    document.querySelectorAll('.tab-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var t = btn.dataset.tab;
        if (body) {
          body.classList.toggle('a4-active', t === 'activity4');
        }
        if (t === 'activity3') populateActivity3(charId);
        if (t === 'activity4') populateActivity4(charId);
      });
    });
  }

  /* ── Public Bootstrap ──────────────────────────────────────── */
  window.initCharacterPage = function (charId, spriteConfig) {
    initSprite(spriteConfig);
    initTabs();
    initAutoSave(charId);
    initChips();
    initLineSelection(charId);
    initActivityHooks(charId);
    initPdf(charId);
  };

}());
