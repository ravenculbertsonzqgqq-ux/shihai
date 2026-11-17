/* ============================================================
   识海 · ShiHai —— 无限画布思维导图核心引擎 v2
   画布 / 布局 / 编辑 / 持久化 / 历史快照回滚 / AI 操控接口
   ============================================================ */
(function () {
  'use strict';

  const LS_MAP = 'shihai.map.v2';
  const LS_SNAPS = 'shihai.snapshots.v1';
  const LS_HIST = 'shihai.history.v1';
  const VGAP = 12, RH = 38, HGAP = 80;
  const UNDO_MAX = 30, SNAP_MAX = 12;

  // ---------- 状态 ----------
  let nodes = {};
  let rootId = 'root';
  let order = [];
  let selId = null;
  let view = { x: 0, y: 0, s: 1 };
  let idSeq = 0;

  // ---------- 历史 ----------
  let undoStack = [];   // [{label, time, state}]
  let redoStack = [];
  let snapshots = [];   // [{id, name, time, count, state}]

  // ---------- DOM ----------
  const $ = (s) => document.querySelector(s);
  const viewport = $('#viewport');
  const world = $('#world');
  const edgeG = $('#edge-g');
  const nodeLayer = $('#nodes');

  // ============================================================
  //  数据结构
  // ============================================================
  function buildFromNested(root) {
    nodes = {}; order = []; idSeq = 0;
    (function walk(n, parentId) {
      const id = n.id || ('n' + (++idSeq));
      const parentColor = parentId ? nodes[parentId].color : 'cog';
      nodes[id] = {
        id,
        text: String(n.text || '未命名'),
        note: String(n.note || ''),
        color: n.color || parentColor,
        x: 0, y: 0,
        parent: parentId,
        children: [],
        collapsed: !!n.collapsed,
        link: n.link || null
      };
      if (parentId) nodes[parentId].children.push(id);
      order.push(id);
      (n.children || []).forEach((c) => walk(c, id));
    })(root, null);
    rootId = root.id || order[0];
  }

  function toNested(id) {
    const n = nodes[id];
    return {
      id: n.id, text: n.text, note: n.note, color: n.color,
      collapsed: n.collapsed, link: n.link,
      x: Math.round(n.x), y: Math.round(n.y),
      children: n.children.map(toNested)
    };
  }

  function cloneState() { return JSON.stringify(toNested(rootId)); }

  /* ---------- 扩展层合并（迭代延伸内容） ---------- */
  function applyExtensions(nested) {
    const exts = window.SHIHAI_EXTENSIONS || [];
    if (!exts.length) return nested;
    const byId = {};
    (function idx(n) { byId[n.id] = n; (n.children || []).forEach(idx); })(nested);
    for (const e of exts) {
      const p = byId[e.parent];
      if (!p) continue;
      p.children = p.children || [];
      for (const c of (e.children || [])) {
        p.children.push(c);
        (function idx(n) { if (n.id) byId[n.id] = n; (n.children || []).forEach(idx); })(c);
      }
    }
    return nested;
  }

  function freshDefault() {
    // 深拷贝默认图谱并合并扩展层，避免污染源数据
    const base = JSON.parse(JSON.stringify(window.SHIHAI_DEFAULT_MAP));
    return applyExtensions(base);
  }

  // ============================================================
  //  布局（左右双侧整齐树 —— 大脑左右半球）
  // ============================================================
  function sizeOf(n) {
    let w = 30;
    for (const ch of n.text) w += ch.charCodeAt(0) > 255 ? 14.5 : 7.4;
    return { w: Math.max(110, Math.min(340, w)), h: RH };
  }

  function subHeight(id) {
    const n = nodes[id];
    if (n.collapsed || n.children.length === 0) return RH + VGAP;
    return n.children.reduce((s, c) => s + subHeight(c), 0);
  }

  function place(id, x, top, dir) {
    const n = nodes[id];
    const sz = sizeOf(n);
    n.x = x;
    n.y = top + subHeight(id) / 2;
    if (n.collapsed) return;
    let cy = top;
    for (const c of n.children) {
      const cs = sizeOf(nodes[c]);
      place(c, x + dir * ((sz.w + cs.w) / 2 + HGAP), cy, dir);
      cy += subHeight(c);
    }
  }

  function layout() {
    const root = nodes[rootId];
    root.x = 0; root.y = 0;
    if (root.collapsed) return;
    const kids = root.children.map((id) => ({ id, h: subHeight(id) }));
    kids.sort((a, b) => b.h - a.h);
    const sides = [{ dir: 1, h: 0, list: [] }, { dir: -1, h: 0, list: [] }];
    for (const k of kids) {
      const s = sides[0].h <= sides[1].h ? sides[0] : sides[1];
      s.list.push(k.id); s.h += k.h;
    }
    for (const s of sides) {
      let top = -s.h / 2;
      for (const id of s.list) {
        const sz = sizeOf(nodes[id]);
        const rs = sizeOf(root);
        place(id, s.dir * ((rs.w + sz.w) / 2 + HGAP), top, s.dir);
        top += subHeight(id);
      }
    }
  }

  // ============================================================
  //  渲染
  // ============================================================
  function isVisible(id) {
    let p = nodes[id].parent;
    while (p) { if (nodes[p].collapsed) return false; p = nodes[p].parent; }
    return true;
  }

  function render() {
    nodeLayer.innerHTML = '';
    for (const id of order) {
      if (!isVisible(id)) continue;
      nodeLayer.appendChild(buildNodeEl(nodes[id]));
    }
    renderEdges();
    updateSel();
  }

  function buildNodeEl(n) {
    const el = document.createElement('div');
    el.className = 'node c-' + n.color;
    el.dataset.id = n.id;
    el.style.left = n.x + 'px';
    el.style.top = n.y + 'px';
    if (n.id === rootId) el.classList.add('is-root');

    const title = document.createElement('div');
    title.className = 'title';
    title.textContent = n.text;
    el.appendChild(title);

    if (n.note) {
      const nd = document.createElement('span');
      nd.className = 'note-dot';
      nd.title = n.note;
      el.appendChild(nd);
    }

    if (n.children.length) {
      const badge = document.createElement('span');
      badge.className = 'collapse-badge';
      badge.title = '折叠 / 展开';
      badge.textContent = n.collapsed ? '＋' + countSub(n.id) : '－';
      badge.addEventListener('pointerdown', (e) => e.stopPropagation());
      badge.addEventListener('click', (e) => {
        e.stopPropagation();
        pushHistory((n.collapsed ? '展开: ' : '折叠: ') + n.text);
        n.collapsed = !n.collapsed;
        render(); save();
      });
      el.appendChild(badge);
    }

    const tools = document.createElement('div');
    tools.className = 'tools';
    tools.innerHTML =
      '<span class="tool t-child" title="加子节点 (Tab)">＋</span>' +
      '<span class="tool t-sib" title="加同级 (Enter)">＋＋</span>' +
      '<span class="tool t-edit" title="编辑 (F2)">✎</span>' +
      '<span class="tool t-ai" title="AI 扩展 (✨)">✨</span>' +
      '<span class="tool t-del" title="删除 (Del)">✕</span>';
    tools.addEventListener('pointerdown', (e) => e.stopPropagation());
    tools.addEventListener('click', (e) => {
      e.stopPropagation();
      const t = e.target.classList;
      if (t.contains('t-child')) addChild(n.id);
      else if (t.contains('t-sib')) addSibling(n.id);
      else if (t.contains('t-edit')) startEdit(n.id);
      else if (t.contains('t-del')) delNode(n.id);
      else if (t.contains('t-ai')) window.ShihaiAI && window.ShihaiAI.expandNode(n.id, apiCtx());
    });
    el.appendChild(tools);
    return el;
  }

  function countSub(id) {
    return nodes[id].children.reduce((s, c) => s + 1 + countSub(c), 0);
  }

  function renderEdges() {
    let html = '';
    for (const id of order) {
      const n = nodes[id];
      if (!n.parent || !isVisible(id)) continue;
      const p = nodes[n.parent];
      const ps = sizeOf(p), cs = sizeOf(n);
      const dir = n.x >= p.x ? 1 : -1;
      const x1 = p.x + dir * ps.w / 2, y1 = p.y;
      const x2 = n.x - dir * cs.w / 2, y2 = n.y;
      const dx = Math.max(30, Math.abs(x2 - x1) * 0.48);
      const d = `M ${x1} ${y1} C ${x1 + dir * dx} ${y1}, ${x2 - dir * dx} ${y2}, ${x2} ${y2}`;
      html += `<path class="edge-glow" d="${d}"/>`;
      html += `<path class="edge" d="${d}"/>`;
      html += `<path class="edge-flow" d="${d}"/>`;
    }
    for (const id of order) {
      const n = nodes[id];
      if (!n.link || !nodes[n.link] || !isVisible(id) || !isVisible(n.link)) continue;
      const t = nodes[n.link];
      const mx = (n.x + t.x) / 2, my = (n.y + t.y) / 2 - 60 - Math.abs(n.x - t.x) * 0.12;
      html += `<path class="edge-link" d="M ${n.x} ${n.y} Q ${mx} ${my}, ${t.x} ${t.y}"/>`;
    }
    edgeG.innerHTML = html;
  }

  // ============================================================
  //  视图
  // ============================================================
  function applyView() {
    world.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.s})`;
    const g = 32 * view.s;
    viewport.style.backgroundSize = `${g}px ${g}px`;
    viewport.style.backgroundPosition = `${view.x}px ${view.y}px`;
    $('#zoom-label').textContent = Math.round(view.s * 100) + '%';
  }

  function zoomAt(cx, cy, factor) {
    const r = viewport.getBoundingClientRect();
    const px = cx - r.left, py = cy - r.top;
    const ns = Math.min(2.5, Math.max(0.05, view.s * factor));
    const k = ns / view.s;
    view.x = px - (px - view.x) * k;
    view.y = py - (py - view.y) * k;
    view.s = ns;
    applyView();
  }

  function fitView() {
    const ids = order.filter(isVisible);
    if (!ids.length) return;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const id of ids) {
      const n = nodes[id], sz = sizeOf(n);
      x0 = Math.min(x0, n.x - sz.w / 2); x1 = Math.max(x1, n.x + sz.w / 2);
      y0 = Math.min(y0, n.y - 20); y1 = Math.max(y1, n.y + 20);
    }
    const r = viewport.getBoundingClientRect();
    const s = Math.min(1.35, (r.width * 0.88) / (x1 - x0), (r.height * 0.84) / (y1 - y0));
    view.s = Math.max(0.05, s);
    view.x = r.width / 2 - ((x0 + x1) / 2) * view.s;
    view.y = r.height / 2 - ((y0 + y1) / 2) * view.s;
    applyView();
  }

  function centerOn(id, minScale) {
    const n = nodes[id];
    if (!n) return;
    const r = viewport.getBoundingClientRect();
    if (minScale && view.s < minScale) view.s = minScale;
    view.x = r.width / 2 - n.x * view.s;
    view.y = r.height / 2 - n.y * view.s;
    applyView();
  }

  // ============================================================
  //  编辑操作（全部走 pushHistory 以便回滚）
  // ============================================================
  function makeNode(text, parentId) {
    const id = 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    nodes[id] = {
      id, text: String(text || '新节点'), note: '',
      color: nodes[parentId] ? nodes[parentId].color : 'cog',
      x: 0, y: 0, parent: parentId, children: [], collapsed: false, link: null
    };
    order.push(id);
    nodes[parentId].children.push(id);
    return id;
  }

  function placeNear(id) {
    const n = nodes[id], p = nodes[n.parent];
    if (!p) return;
    const idx = p.children.indexOf(id);
    const ps = sizeOf(p), cs = sizeOf(n);
    const dir = p.x >= nodes[rootId].x ? 1 : -1;
    n.x = p.x + dir * ((ps.w + cs.w) / 2 + HGAP);
    const sib = p.children[idx - 1];
    n.y = sib ? nodes[sib].y + RH + VGAP : p.y + (idx + 1) * (RH + VGAP);
  }

  function addChild(pid) {
    const p = nodes[pid];
    if (!p) return;
    pushHistory('添加子节点 → ' + p.text);
    if (p.collapsed) p.collapsed = false;
    const id = makeNode('新节点', pid);
    placeNear(id);
    render(); save();
    selectNode(id);
    startEdit(id);
  }

  function addSibling(id) {
    const n = nodes[id];
    if (!n) return;
    if (!n.parent) return addChild(id);
    pushHistory('添加同级 → ' + n.text);
    const nid = makeNode('新节点', n.parent);
    const arr = nodes[n.parent].children;
    arr.splice(arr.indexOf(nid), 1);
    arr.splice(arr.indexOf(id) + 1, 0, nid);
    placeNear(nid);
    render(); save();
    selectNode(nid);
    startEdit(nid);
  }

  function delNode(id) {
    if (id === rootId) return toast('根节点不能删除');
    const n = nodes[id];
    if (!n) return;
    if (countSub(id) > 0 && !confirm('删除该节点及其 ' + countSub(id) + ' 个后代？')) return;
    deleteById(id, '删除: ' + n.text);
  }

  function deleteById(id, label) {
    if (id === rootId || !nodes[id]) return false;
    const n = nodes[id];
    pushHistory(label || ('删除: ' + n.text));
    (function rm(i) {
      nodes[i].children.slice().forEach(rm);
      delete nodes[i];
      order = order.filter((x) => x !== i);
    })(id);
    const arr = nodes[n.parent].children;
    const idx = arr.indexOf(id);
    if (idx >= 0) arr.splice(idx, 1);
    if (selId === id) selId = null;
    render(); save();
    return true;
  }

  function startEdit(id) {
    const el = nodeLayer.querySelector(`.node[data-id="${id}"] .title`);
    if (!el) return;
    selectNode(id);
    el.contentEditable = 'true';
    el.classList.add('editing');
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = getSelection(); sel.removeAllRanges(); sel.addRange(range);
    const commit = (ok) => {
      el.contentEditable = 'false';
      el.classList.remove('editing');
      el.removeEventListener('blur', onBlur);
      el.removeEventListener('keydown', onKey);
      const val = el.textContent.trim() || '未命名';
      if (ok && val !== nodes[id].text) {
        pushHistory('改名: ' + nodes[id].text);
        nodes[id].text = val;
        save();
      }
      render();
    };
    const onBlur = () => commit(true);
    const onKey = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit(true); }
      else if (e.key === 'Escape') { e.preventDefault(); commit(false); }
      e.stopPropagation();
    };
    el.addEventListener('blur', onBlur);
    el.addEventListener('keydown', onKey);
  }

  function selectNode(id) {
    selId = id;
    updateSel();
    if (window.ShihaiUI && window.ShihaiUI.onSelect) window.ShihaiUI.onSelect(nodes[id]);
  }

  function updateSel() {
    nodeLayer.querySelectorAll('.node').forEach((el) => {
      el.classList.toggle('selected', el.dataset.id === selId);
    });
  }

  /* ---------- AI/外部操控接口 ---------- */
  function renameNode(id, text) {
    if (!nodes[id]) return false;
    pushHistory('AI 改名: ' + nodes[id].text);
    nodes[id].text = String(text || '未命名');
    render(); save();
    return true;
  }

  function setNote(id, text) {
    if (!nodes[id]) return false;
    pushHistory('AI 备注: ' + nodes[id].text);
    nodes[id].note = String(text || '');
    render(); save();
    return true;
  }

  function setColor(id, color) {
    if (!nodes[id]) return false;
    pushHistory('AI 上色: ' + nodes[id].text);
    nodes[id].color = color;
    render(); save();
    return true;
  }

  function addLink(fromId, toId) {
    if (!nodes[fromId] || !nodes[toId]) return false;
    pushHistory('AI 联想: ' + nodes[fromId].text);
    nodes[fromId].link = toId;
    render(); save();
    return true;
  }

  function setCollapsed(id, collapsed) {
    if (!nodes[id]) return false;
    nodes[id].collapsed = !!collapsed;
    render(); save();
    return true;
  }

  function findNode(ref) {
    if (!ref) return null;
    ref = String(ref).trim();
    if (nodes[ref]) return nodes[ref];
    const low = ref.toLowerCase();
    // 精确标题 → 标题包含 → 路径包含
    let hit = order.map((i) => nodes[i]).find((n) => n.text === ref);
    if (hit) return hit;
    hit = order.map((i) => nodes[i]).find((n) => n.text.toLowerCase().includes(low));
    if (hit) return hit;
    hit = order.map((i) => nodes[i]).find((n) => n.note && n.note.toLowerCase().includes(low));
    return hit || null;
  }

  function expandAll() {
    order.forEach((id) => { nodes[id].collapsed = false; });
    render(); save();
  }

  // ============================================================
  //  历史快照 / 回滚
  // ============================================================
  function pushHistory(label) {
    try {
      undoStack.push({ label: label || '修改', time: Date.now(), state: cloneState() });
      if (undoStack.length > UNDO_MAX) undoStack.shift();
      redoStack = [];
      persistHist();
    } catch (e) { /* 内存异常忽略 */ }
  }

  function undo() {
    if (!undoStack.length) { toast('没有可撤销的操作'); return false; }
    const entry = undoStack.pop();
    redoStack.push({ label: entry.label, time: Date.now(), state: cloneState() });
    if (redoStack.length > UNDO_MAX) redoStack.shift();
    applyState(entry.state);
    toast('↩ 已撤销：' + entry.label);
    persistHist();
    return true;
  }

  function redo() {
    if (!redoStack.length) { toast('没有可重做的操作'); return false; }
    const entry = redoStack.pop();
    undoStack.push({ label: entry.label, time: Date.now(), state: cloneState() });
    applyState(entry.state);
    toast('↪ 已重做：' + entry.label);
    persistHist();
    return true;
  }

  function applyState(stateStr) {
    try {
      const nested = JSON.parse(stateStr);
      buildFromNested(nested);
      render();
      if (selId && nodes[selId]) selectNode(selId);
      save();
    } catch (e) { toast('状态恢复失败'); }
  }

  function saveSnapshot(name) {
    const snap = {
      id: 's' + Date.now().toString(36),
      name: name || ('快照 ' + new Date().toLocaleString('zh-CN', { hour12: false })),
      time: Date.now(),
      count: order.length,
      state: cloneState()
    };
    snapshots.unshift(snap);
    if (snapshots.length > SNAP_MAX) snapshots.pop();
    persistSnaps();
    toast('📌 已保存快照：' + snap.name);
    return snap;
  }

  function restoreSnapshot(id) {
    const s = snapshots.find((x) => x.id === id);
    if (!s) return false;
    pushHistory('回滚前状态');
    applyState(s.state);
    toast('⏳ 已回滚到快照：' + s.name);
    return true;
  }

  function deleteSnapshot(id) {
    snapshots = snapshots.filter((x) => x.id !== id);
    persistSnaps();
  }

  function persistSnaps() {
    try {
      localStorage.setItem(LS_SNAPS, JSON.stringify(snapshots));
    } catch (e) {
      // 空间不足：丢最旧的
      while (snapshots.length > 2) {
        snapshots.pop();
        try { localStorage.setItem(LS_SNAPS, JSON.stringify(snapshots)); break; } catch (e2) { /* 继续丢 */ }
      }
    }
  }

  function persistHist() {
    try {
      localStorage.setItem(LS_HIST, JSON.stringify({
        undo: undoStack.slice(-12), redo: redoStack.slice(-12)
      }));
    } catch (e) { /* 忽略 */ }
  }

  function loadHist() {
    try {
      const d = JSON.parse(localStorage.getItem(LS_HIST) || '{}');
      undoStack = (d.undo || []).filter((x) => x && x.state);
      redoStack = (d.redo || []).filter((x) => x && x.state);
      snapshots = JSON.parse(localStorage.getItem(LS_SNAPS) || '[]')
        .filter((x) => x && x.state);
    } catch (e) {
      undoStack = []; redoStack = []; snapshots = [];
    }
  }

  // ============================================================
  //  持久化 / 导入导出 / 重置
  // ============================================================
  let saveTimer = null;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(LS_MAP, JSON.stringify({ root: toNested(rootId), view, selId }));
      } catch (err) { /* 忽略 */ }
    }, 300);
  }

  function load() {
    try {
      const raw = localStorage.getItem(LS_MAP);
      if (raw) {
        const d = JSON.parse(raw);
        if (d && d.root) {
          buildFromNested(d.root);
          if (d.view) view = d.view;
          if (d.selId && nodes[d.selId]) selId = d.selId;
          return true;
        }
      }
    } catch (err) { /* 回退默认 */ }
    return false;
  }

  function exportJSON() {
    const blob = new Blob([JSON.stringify({ app: 'shihai', version: 2, root: toNested(rootId) }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '识海图谱-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function importJSON(file) {
    const fr = new FileReader();
    fr.onload = () => {
      try {
        const d = JSON.parse(fr.result);
        const root = d.root || d;
        if (!root || !root.text) throw new Error('bad');
        pushHistory('导入图谱');
        buildFromNested(root);
        layout(); render(); save(); fitView();
        toast('导入成功');
      } catch (err) { toast('导入失败：JSON 格式不正确'); }
    };
    fr.readAsText(file);
  }

  function resetMap() {
    if (!confirm('重置为默认图谱（北极星系统＋人类智慧结晶＋扩展层）？当前修改将进入历史可回滚。')) return;
    pushHistory('重置前状态');
    localStorage.removeItem(LS_MAP);
    buildFromNested(freshDefault());
    layout(); render(); save(); fitView();
    toast('已重置为默认图谱');
  }

  // ============================================================
  //  搜索
  // ============================================================
  function search(q) {
    q = (q || '').trim().toLowerCase();
    nodeLayer.querySelectorAll('.node').forEach((el) => el.classList.remove('hit'));
    if (!q) return [];
    const hits = order.filter((id) => isVisible(id) &&
      (nodes[id].text.toLowerCase().includes(q) || nodes[id].note.toLowerCase().includes(q)));
    hits.forEach((id) => {
      const el = nodeLayer.querySelector(`.node[data-id="${id}"]`);
      if (el) el.classList.add('hit');
    });
    return hits;
  }

  // ============================================================
  //  Toast
  // ============================================================
  let toastTimer = null;
  function toast(msg) {
    let t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
  }

  // ============================================================
  //  对外 API
  // ============================================================
  function apiCtx() {
    return {
      getNodes: () => nodes,
      getRootId: () => rootId,
      getSelId: () => selId,
      getSelected: () => (selId ? nodes[selId] : null),
      getPath: (id) => {
        const arr = [];
        let cur = id;
        while (cur) { arr.unshift(nodes[cur].text); cur = nodes[cur].parent; }
        return arr;
      },
      addChildrenTo: (pid, texts) => {
        const p = nodes[pid];
        if (!p) return [];
        pushHistory('AI 扩展: ' + p.text);
        if (p.collapsed) p.collapsed = false;
        const ids = texts.map((t) => {
          const id = makeNode(String(t), pid);
          placeNear(id);
          return id;
        });
        render(); save();
        return ids;
      },
      renameNode, setNote, setColor, addLink, setCollapsed,
      deleteById: (id) => deleteById(id),
      findNode, expandAll, layout, render, save, toast,
      fitView, centerOn, selectNode, view: () => view,
      pushHistory, undo, redo,
      saveSnapshot, restoreSnapshot, deleteSnapshot,
      listSnapshots: () => snapshots,
      histInfo: () => ({
        undo: undoStack.map((x, i) => ({ i, label: x.label, time: x.time })),
        redo: redoStack.map((x, i) => ({ i, label: x.label, time: x.time }))
      }),
      restoreUndoAt: (i) => {
        // 回滚到历史栈第 i 条（0=最旧）
        if (i < 0 || i >= undoStack.length) return false;
        redoStack.push({ label: '回到历史点', time: Date.now(), state: cloneState() });
        const entry = undoStack[i];
        undoStack = undoStack.slice(0, i);
        applyState(entry.state);
        toast('⏳ 已回滚到：' + entry.label);
        persistHist();
        return true;
      },
      nodeCount: () => order.length
    };
  }

  // ============================================================
  //  启动
  // ============================================================
  function boot() {
    loadHist();
    const restored = load();
    if (!restored) buildFromNested(freshDefault());
    if (!restored || !view.s) layout();
    render();
    applyView();
    if (restored && (view.x !== 0 || view.y !== 0)) { /* 保留视角 */ }
    else fitView();
    if (selId && nodes[selId]) selectNode(selId);
  }

  window.ShihaiApp = Object.assign(apiCtx(), {
    exportJSON, importJSON, resetMap, search, boot, buildFromNested,
    addChildrenTo: apiCtx().addChildrenTo
  });

  document.addEventListener('DOMContentLoaded', () => {
    boot();
    if (window.ShihaiUI && window.ShihaiUI.init) window.ShihaiUI.init(window.ShihaiApp);
  });
})();
