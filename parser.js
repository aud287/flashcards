/* محلل الملفات: بيقسم أي نص لأقسام وكروت من غير ما يغيّر ولا يضيف حرف على نص الملف */
(function (root) {
  'use strict';

  var BUL = /^([-•●▪◦·*–—])\s+(.+)$/;
  var END_PUNCT = /[.،؛!؟?…:：]$/;

  function hash(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(36);
  }

  function cls(l) {
    if (l.indexOf('\t') !== -1) return { t: 'row', cells: l.split('\t').map(function (s) { return s.trim(); }) };
    var m;
    if ((m = l.match(/^#{1,6}\s+(.+)$/))) return { t: 'head', title: m[1].trim() };
    if ((m = l.match(/^(\d{1,3})[.)]\s+(.+)$/))) {
      var body = m[2].trim();
      if (!END_PUNCT.test(body) && body.length <= 100) return { t: 'head', num: m[1], title: body };
      return { t: 'item', text: l };
    }
    if ((m = l.match(BUL))) return { t: 'bul', text: m[2] };
    if (/[:：]$/.test(l)) return { t: 'label', text: l };
    if (l.length <= 70 && !END_PUNCT.test(l)) return { t: 'cand', text: l };
    return { t: 'p', text: l };
  }

  function parse(raw, fileName) {
    var lines = String(raw).replace(/\r/g, '').split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
    var toks = lines.map(cls);

    // سطر قصير من غير علامة ترقيم وبعده سطر مش قصير زيه = عنوان قسم
    for (var i = 0; i < toks.length; i++) {
      if (toks[i].t === 'cand') {
        var nx = toks[i + 1];
        if (nx && nx.t !== 'cand') toks[i] = { t: 'head', title: toks[i].text };
        else toks[i] = { t: 'p', text: toks[i].text };
      }
    }

    var secs = [];
    var cur = { num: null, title: fileName || 'الملف', blocks: [] };
    var openG = null, openT = null;
    function push() { if (cur.blocks.length) secs.push(cur); }

    toks.forEach(function (k) {
      if (k.t === 'head') { push(); cur = { num: k.num || null, title: k.title, blocks: [] }; openG = openT = null; }
      else if (k.t === 'p') { cur.blocks.push({ type: 'p', text: k.text }); openG = openT = null; }
      else if (k.t === 'label') { openG = { type: 'group', label: k.text, items: [] }; cur.blocks.push(openG); openT = null; }
      else if (k.t === 'bul' || k.t === 'item') {
        if (!openG) { openG = { type: 'group', label: null, items: [] }; cur.blocks.push(openG); }
        openG.items.push(k.text); openT = null;
      } else if (k.t === 'row') {
        if (!openT) { openT = { type: 'table', rows: [] }; cur.blocks.push(openT); }
        openT.rows.push(k.cells); openG = null;
      }
    });
    push();

    // عنوان فرعي من غير عناصر = فقرة عادية
    secs.forEach(function (s) {
      s.blocks = s.blocks.map(function (b) {
        return (b.type === 'group' && !b.items.length) ? { type: 'p', text: b.label } : b;
      });
    });

    // جدول الأولويات: لو أول عمود رقم، نربطه برقم القسم
    var prio = {};
    secs.forEach(function (s) {
      s.blocks.forEach(function (b) {
        if (b.type !== 'table') return;
        b.rows.slice(1).forEach(function (r) {
          if (r.length >= 3 && /^\d+$/.test(r[0])) prio[r[0]] = r[r.length - 1];
        });
      });
    });
    secs.forEach(function (s) { s.badge = s.num && prio[s.num] ? prio[s.num] : null; });

    var cards = [];
    secs.forEach(function (s, si) {
      var groups = s.blocks.filter(function (b) { return b.type === 'group'; });
      var single = s.blocks.length === 1;
      if (single && groups.length === 1 && groups[0].label) {
        cards.push(mk(s, si, 'group', groups[0].label, s.blocks));
      } else if (single && groups.length === 1) {
        cards.push(mk(s, si, 'section', null, s.blocks));
      } else {
        cards.push(mk(s, si, 'section', null, s.blocks));
        if (groups.length > 1 || (groups.length === 1 && s.blocks.length > 1)) {
          groups.forEach(function (g) { if (g.label) cards.push(mk(s, si, 'group', g.label, [g])); });
        }
      }
    });

    function mk(s, si, kind, label, blocks) {
      return {
        id: hash(si + '|' + kind + '|' + (label || '') + '|' + s.title),
        sec: si, num: s.num, title: s.title, badge: s.badge,
        kind: kind, label: label, blocks: blocks
      };
    }

    return { sections: secs.map(function (s, i) { return { idx: i, num: s.num, title: s.title, badge: s.badge }; }), cards: cards };
  }

  var api = { parse: parse };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MQ = api;
})(typeof window !== 'undefined' ? window : globalThis);
