/* ============================================================
   识海 · v5 交互引擎（充分借鉴 basketikun/infinite-canvas）
   —— 指数滚轮缩放（锚定光标）· 空格/Ctrl/中键/背景拖拽平移 ·
      节点拖拽（实时重连线/边缘自动平移/可撤销）· 双击编辑/新建 ·
      Tab/Enter/F2/Del/0 快捷键 · 触控双指缩放平移 ·
      图片上传（拖放/粘贴/工具栏）· 图片节点（缩放手柄）·
      导入导出含图片 · 模型输入输出日志入口
   ============================================================ */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  let APP = null;

  /* ================= 图片存储（旁路表，随节点 id 稳定持久化） ================= */
  const LS_IMG = 'shihai-imgs-v1', LS_META = 'shihai-imgmeta-v1';
  let IMG = {}, META = {};
  try { IMG = JSON.parse(localStorage.getItem(LS_IMG) || '{}') || {}; } catch (e) { IMG = {}; }
  try { META = JSON.parse(localStorage.getItem(LS_META) || '{}') || {}; } catch (e) { META = {}; }
  function saveImages() {
    try {
      localStorage.setItem(LS_IMG, JSON.stringify(IMG));
      localStorage.setItem(LS_META, JSON.stringify(META));
    } catch (e) {
      try { localStorage.setItem(LS_IMG, JSON.stringify(IMG)); } catch (e2) {
        APP && APP.toast('⚠ 图片存储空间不足，建议删除部分大图');
      }
    }
  }

  /* ================= 视图 ================= */
  function applyWorld() {
    const v = APP.view();
    const world = $('#world');
    if (world) world.style.transform = `translate(${v.x}px, ${v.y}px) scale(${v.s})`;
    const vp = $('#viewport');
    const g = 32 * v.s;
    vp.style.backgroundSize = `${g}px ${g}px`;
    vp.style.backgroundPosition = `${v.x}px ${v.y}px`;
    const zl = $('#zoom-label');
    if (zl) zl.textContent = Math.round(v.s * 100) + '%';
    if (window.ShihaiUpgrades && window.ShihaiUpgrades.drawMinimap) window.ShihaiUpgrades.drawMinimap();
    if (window.ShihaiUpgrades && window.ShihaiUpgrades.cullNow) window.ShihaiUpgrades.cullNow();
  }
  function screenToWorld(cx, cy) {
    const v = APP.view();
    const r = $('#viewport').getBoundingClientRect();
    return { x: (cx - r.left - v.x) / v.s, y: (cy - r.top - v.y) / v.s };
  }

  /* ================= 边渲染（带 data-nid，支持拖拽时局部刷新） ================= */
  function sizeOf(n) {
    let w = 30;
    for (const ch of n.text) w += ch.charCodeAt(0) > 255 ? 14.5 : 7.4;
    return { w: Math.max(110, Math.min(340, w)), h: 44 };
  }
  function edgeD(p, n) {
    const ps = sizeOf(p), cs = sizeOf(n);
    const dir = n.x >= p.x ? 1 : -1;
    const x1 = p.x + dir * ps.w / 2, y1 = p.y;
    const x2 = n.x - dir * cs.w / 2, y2 = n.y;
    const dx = Math.max(30, Math.abs(x2 - x1) * 0.48);
    return `M ${x1} ${y1} C ${x1 + dir * dx} ${y1}, ${x2 - dir * dx} ${y2}, ${x2} ${y2}`;
  }
  function visible(id, nodes) {
    let p = nodes[id].parent;
    while (p) { if (nodes[p].collapsed) return false; p = nodes[p].parent; }
    return true;
  }
  function redrawEdges() {
    const nodes = APP.getNodes();
    const g = $('#edge-g');
    if (!g) return;
    let html = '';
    for (const id in nodes) {
      const n = nodes[id];
      if (!n.parent || !visible(id, nodes)) continue;
      const p = nodes[n.parent];
      const d = edgeD(p, n);
      html += `<path class="edge-glow" data-nid="${id}" d="${d}"/>`;
      html += `<path class="edge" data-nid="${id}" d="${d}"/>`;
      html += `<path class="edge-flow" data-nid="${id}" d="${d}"/>`;
    }
    for (const id in nodes) {
      const n = nodes[id];
      if (!n.link || !nodes[n.link] || !visible(id, nodes) || !visible(n.link, nodes)) continue;
      const t = nodes[n.link];
      const mx = (n.x + t.x) / 2, my = (n.y + t.y) / 2 - 60 - Math.abs(n.x - t.x) * 0.12;
      html += `<path class="edge-link" data-lid="${id}" d="M ${n.x} ${n.y} Q ${mx} ${my}, ${t.x} ${t.y}"/>`;
    }
    g.innerHTML = html;
  }
  function updateEdgesOf(id) {
    const nodes = APP.getNodes();
    const g = $('#edge-g');
    if (!g) return;
    // 快速路径：只刷新自己+子女+联想边的几何；发现缺 data-nid 则整体重建
    const n = nodes[id];
    if (!n) { redrawEdges(); return; }
    let expected = 0, missing = false;
    const targets = [id].concat(n.children || []);
    targets.forEach((tid) => {
      const t = nodes[tid];
      if (!t || !t.parent || !visible(tid, nodes)) return;
      expected++;
      const paths = g.querySelectorAll(`path[data-nid="${tid}"]`);
      if (!paths.length) { missing = true; return; }
      const d = edgeD(nodes[t.parent], t);
      paths.forEach((pp) => pp.setAttribute('d', d));
    });
    if (n.link && nodes[n.link]) {
      const lp = g.querySelectorAll(`path[data-lid="${id}"]`);
      if (lp.length) {
        const t = nodes[n.link];
        const mx = (n.x + t.x) / 2, my = (n.y + t.y) / 2 - 60 - Math.abs(n.x - t.x) * 0.12;
        const d = `M ${n.x} ${n.y} Q ${mx} ${my}, ${t.x} ${t.y}`;
        lp.forEach((pp) => pp.setAttribute('d', d));
      }
    }
    if (missing) redrawEdges();
  }

  /* ================= 动画视图 ================= */
  function animateViewTo(tx, ty, ts, dur) {
    const f0 = APP.view();
    const fx = f0.x, fy = f0.y, fs = f0.s;
    const t0 = performance.now();
    const D = dur || 320;
    (function step(t) {
      const k = Math.min(1, (t - t0) / D);
      const e = 1 - Math.pow(1 - k, 3);
      const v = APP.view();
      v.x = fx + (tx - fx) * e;
      v.y = fy + (ty - fy) * e;
      v.s = fs + (ts - fs) * e;
      applyWorld();
      if (k < 1) requestAnimationFrame(step);
    })(t0);
  }
  function smoothZoomAt(cx, cy, factor, dur) {
    const v = APP.view();
    const r = $('#viewport').getBoundingClientRect();
    const px = cx - r.left, py = cy - r.top;
    const ns = Math.min(2.5, Math.max(0.05, v.s * factor));
    const fx = v.x, fy = v.y, fs = v.s;
    const t0 = performance.now();
    const D = dur || 170;
    (function step(t) {
      const k = Math.min(1, (t - t0) / D);
      const e = 1 - Math.pow(1 - k, 3);
      const s = fs + (ns - fs) * e;
      const vv = APP.view();
      vv.s = s;
      vv.x = px - (px - fx) * (s / fs);
      vv.y = py - (py - fy) * (s / fs);
      applyWorld();
      if (k < 1) requestAnimationFrame(step);
    })(t0);
  }

  /* ================= 滚轮：指数缩放 + Shift 横向平移（借鉴 Math.pow(1.1, δ/100)） ================= */
  function onWheel(e) {
    if (e.target.closest && e.target.closest('[data-canvas-no-zoom]')) return;
    e.preventDefault();
    const v = APP.view();
    if (e.shiftKey && !e.ctrlKey && !e.metaKey) {
      // Shift+滚轮：横向平移
      v.x -= e.deltaY || e.deltaX;
      applyWorld();
      return;
    }
    const delta = -e.deltaY;
    const factor = Math.pow(1.1, delta / 100);
    const ns = Math.min(2.5, Math.max(0.05, v.s * factor));
    const r = $('#viewport').getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    const wx = (mx - v.x) / v.s, wy = (my - v.y) / v.s;
    v.s = ns;
    v.x = mx - wx * ns;
    v.y = my - wy * ns;
    applyWorld();
  }

  /* ================= 平移 / 节点拖拽 / 双指缩放（panState 模式） ================= */
  const pan = { mode: null, startX: 0, startY: 0, initX: 0, initY: 0, moved: false, bg: false, id: null, offX: 0, offY: 0, ptr: -1 };
  const activePtrs = new Map();
  let pinch = null, spaceDown = false, edgeRAF = null, lastPtr = { x: 0, y: 0 };

  function isUI(el) {
    return el && el.closest && el.closest('[data-canvas-no-zoom]');
  }

  function onPointerDown(e) {
    if (isUI(e.target)) return;
    activePtrs.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // 双指触控 → 缩放/平移
    if (activePtrs.size === 2 && e.pointerType !== 'mouse') {
      pan.mode = null;
      const pts = [...activePtrs.values()];
      pinch = {
        dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y),
        mx: (pts[0].x + pts[1].x) / 2, my: (pts[0].y + pts[1].y) / 2
      };
      return;
    }
    if (pinch) return;

    lastPtr = { x: e.clientX, y: e.clientY };

    // 图片缩放手柄
    const rz = e.target.closest && e.target.closest('.img-resize');
    if (rz && e.button === 0) {
      e.preventDefault();
      e.stopPropagation();
      const nodeEl = rz.closest('.node');
      pan.mode = 'resize';
      pan.id = nodeEl.dataset.id;
      pan.startX = e.clientX; pan.startY = e.clientY;
      pan.initX = (META[pan.id] && META[pan.id].w) || 220;
      return;
    }

    const nodeEl = e.target.closest && e.target.closest('.node');
    const wantPan = e.button === 1 || (e.button === 0 && (spaceDown || e.ctrlKey || e.metaKey)) ||
      (e.button === 0 && !nodeEl);

    if (wantPan) {
      e.preventDefault();
      pan.mode = 'pan';
      pan.startX = e.clientX; pan.startY = e.clientY;
      const v = APP.view();
      pan.initX = v.x; pan.initY = v.y;
      pan.moved = false;
      pan.bg = !nodeEl && !spaceDown && !e.ctrlKey && !e.metaKey && e.button === 0;
      document.body.style.cursor = 'grabbing';
      return;
    }

    if (nodeEl && e.button === 0 && !e.target.closest('.tools') && !e.target.closest('.collapse-badge') && !e.target.closest('.title.editing')) {
      pan.mode = 'node';
      pan.id = nodeEl.dataset.id;
      pan.startX = e.clientX; pan.startY = e.clientY;
      pan.moved = false;
      const n = APP.getNodes()[pan.id];
      const w = screenToWorld(e.clientX, e.clientY);
      pan.initX = n.x; pan.initY = n.y;
      pan.offX = w.x - n.x; pan.offY = w.y - n.y;
      pan.ptr = e.pointerId;
    }
  }

  function onPointerMove(e) {
    if (activePtrs.has(e.pointerId)) activePtrs.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // 双指手势
    if (pinch && activePtrs.size >= 2 && e.pointerType !== 'mouse') {
      const pts = [...activePtrs.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const mx = (pts[0].x + pts[1].x) / 2, my = (pts[0].y + pts[1].y) / 2;
      const v = APP.view();
      const r = $('#viewport').getBoundingClientRect();
      if (pinch.dist > 0) {
        const f = dist / pinch.dist;
        const ns = Math.min(2.5, Math.max(0.05, v.s * f));
        const px = mx - r.left, py = my - r.top;
        const wx = (px - v.x) / v.s, wy = (py - v.y) / v.s;
        v.s = ns;
        v.x = px - wx * ns;
        v.y = py - wy * ns;
      }
      v.x += mx - pinch.mx;
      v.y += my - pinch.my;
      pinch.dist = dist; pinch.mx = mx; pinch.my = my;
      applyWorld();
      return;
    }

    lastPtr = { x: e.clientX, y: e.clientY };
    if (!pan.mode) return;

    if (pan.mode === 'resize') {
      const dx = (e.clientX - pan.startX + e.clientY - pan.startY) / 2;
      const w = Math.max(80, Math.min(900, pan.initX + dx * 1.4));
      META[pan.id] = META[pan.id] || {};
      META[pan.id].w = w;
      const el = document.querySelector(`#nodes .node[data-id="${pan.id}"] .node-img`);
      if (el) { el.style.width = w + 'px'; el.style.height = 'auto'; }
      return;
    }

    const dx = e.clientX - pan.startX, dy = e.clientY - pan.startY;
    if (!pan.moved && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
      pan.moved = true;
    }
    if (!pan.moved) return;

    if (pan.mode === 'pan') {
      const v = APP.view();
      // rAF 合帧（借鉴 nextViewportRef 模式）
      const tx = pan.initX + dx, ty = pan.initY + dy;
      if (pan._raf) cancelAnimationFrame(pan._raf);
      pan._raf = requestAnimationFrame(() => {
        const vv = APP.view();
        vv.x = tx; vv.y = ty;
        applyWorld();
      });
      return;
    }

    if (pan.mode === 'node') {
      const n = APP.getNodes()[pan.id];
      if (!n) return;
      const w = screenToWorld(e.clientX, e.clientY);
      n.x = w.x - pan.offX;
      n.y = w.y - pan.offY;
      const el = document.querySelector(`#nodes .node[data-id="${pan.id}"]`);
      if (el) {
        if (!el.classList.contains('dragging')) {
          el.classList.add('dragging');
          APP.pushHistory('移动: ' + n.text); // 拖拽记一次历史，可整体撤销
        }
        el.style.left = n.x + 'px';
        el.style.top = n.y + 'px';
      }
      updateEdgesOf(pan.id);
      if (window.ShihaiUpgrades && window.ShihaiUpgrades.drawMinimap) window.ShihaiUpgrades.drawMinimap();
      // 边缘自动平移（画布无限延伸的手感）
      const r = $('#viewport').getBoundingClientRect();
      const M = 56;
      let ax = 0, ay = 0;
      if (e.clientX - r.left < M) ax = 14;
      else if (r.right - e.clientX < M) ax = -14;
      if (e.clientY - r.top < M) ay = 14;
      else if (r.bottom - e.clientY < M) ay = -14;
      if ((ax || ay) && !edgeRAF) {
        const loop = () => {
          const vv = APP.view();
          vv.x += ax * (vv.s < 0.4 ? 1.6 : 1);
          vv.y += ay * (vv.s < 0.4 ? 1.6 : 1);
          applyWorld();
          const w2 = screenToWorld(lastPtr.x, lastPtr.y);
          const nn = APP.getNodes()[pan.id];
          if (nn) {
            nn.x = w2.x - pan.offX; nn.y = w2.y - pan.offY;
            const el2 = document.querySelector(`#nodes .node[data-id="${pan.id}"]`);
            if (el2) { el2.style.left = nn.x + 'px'; el2.style.top = nn.y + 'px'; }
            updateEdgesOf(pan.id);
          }
          if (pan.mode === 'node' && (ax || ay)) edgeRAF = requestAnimationFrame(loop);
          else edgeRAF = null;
        };
        edgeRAF = requestAnimationFrame(loop);
      }
    }
  }

  function onPointerUp(e) {
    activePtrs.delete(e.pointerId);
    if (pinch && activePtrs.size < 2) pinch = null;
    if (!pan.mode) return;

    if (pan.mode === 'resize') { saveImages(); pan.mode = null; return; }

    if (pan.mode === 'pan') {
      if (!pan.moved && pan.bg) {
        APP.selectNode(null); // 背景单击 = 取消选中（借鉴 onCanvasDeselect）
      }
      document.body.style.cursor = spaceDown ? 'grab' : '';
    }

    if (pan.mode === 'node') {
      const el = document.querySelector(`#nodes .node[data-id="${pan.id}"]`);
      if (el) el.classList.remove('dragging');
      if (!pan.moved) {
        APP.selectNode(pan.id); // 未移动 = 单击选中
      } else {
        APP.save();
        updateEdgesOf(pan.id);
      }
      if (edgeRAF) { cancelAnimationFrame(edgeRAF); edgeRAF = null; }
    }
    pan.mode = null;
  }

  /* ================= 双击：节点=编辑；背景=新建（借鉴 onCanvasDoubleClick） ================= */
  function onDblClick(e) {
    if (isUI(e.target)) return;
    const nodeEl = e.target.closest && e.target.closest('.node');
    if (nodeEl && !e.target.closest('.tools') && !e.target.closest('.img-resize')) {
      editTitle(nodeEl.dataset.id);
      return;
    }
    if (!nodeEl) {
      const w = screenToWorld(e.clientX, e.clientY);
      const nodes = APP.getNodes();
      const sel = APP.getSelId();
      const pid = (sel && nodes[sel]) ? sel : APP.getRootId();
      const ids = APP.addChildrenTo(pid, ['新节点']);
      if (ids && ids[0]) {
        const n = nodes[ids[0]];
        n.x = w.x; n.y = w.y;
        APP.render();
        redrawEdges();
        editTitle(ids[0]);
      }
    }
  }

  /* ================= 行内编辑（F2 / 双击） ================= */
  function editTitle(id) {
    const el = document.querySelector(`#nodes .node[data-id="${id}"] .title`);
    if (!el) return;
    APP.selectNode(id);
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
      const n = APP.getNodes()[id];
      if (ok && n && val !== n.text) APP.renameNode(id, val);
    };
    const onBlur = () => commit(true);
    const onKey = (ev) => {
      if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); ev.stopPropagation(); commit(true); }
      else if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); commit(false); }
      ev.stopPropagation();
    };
    el.addEventListener('blur', onBlur);
    el.addEventListener('keydown', onKey);
  }

  /* ================= 键盘（修复工具栏合成事件 + 真实键盘） ================= */
  function typing(e) {
    const t = e.target;
    return !t || (t.tagName && /INPUT|TEXTAREA|SELECT/.test(t.tagName)) || t.isContentEditable;
  }
  function onKeydown(e) {
    if (e.key === ' ' && !typing(e)) {
      if (!spaceDown) { spaceDown = true; document.body.style.cursor = 'grab'; }
      e.preventDefault();
      return;
    }
    if (typing(e)) return;
    const sel = APP.getSelId();
    const nodes = APP.getNodes();
    if (e.key === 'Tab') {
      e.preventDefault();
      const pid = sel || APP.getRootId();
      const ids = APP.addChildrenTo(pid, ['新节点']);
      if (ids && ids[0]) editTitle(ids[0]);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (!sel || !nodes[sel]) return;
      const pid = nodes[sel].parent || APP.getRootId();
      const ids = APP.addChildrenTo(pid, ['新节点']);
      if (ids && ids[0]) {
        const p = nodes[pid];
        const arr = p.children;
        arr.splice(arr.indexOf(ids[0]), 1);
        arr.splice(arr.indexOf(sel) + 1, 0, ids[0]);
        const n = nodes[ids[0]];
        n.x = nodes[sel].x;
        n.y = nodes[sel].y + 52;
        APP.render();
        redrawEdges();
        editTitle(ids[0]);
      }
    } else if (e.key === 'F2') {
      e.preventDefault();
      if (sel) editTitle(sel);
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      if (sel) APP.deleteById(sel);
    } else if (e.key === '0') {
      e.preventDefault();
      APP.fitView();
    } else if (e.key === 'Escape') {
      APP.selectNode(null);
    }
  }
  function onKeyUp(e) {
    if (e.key === ' ') {
      spaceDown = false;
      if (!pan.mode) document.body.style.cursor = '';
    }
  }

  /* ================= 图片：压缩 / 节点化 / 装饰 ================= */
  function compressImage(src, maxDim, quality) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        let { width: w, height: h } = img;
        const M = maxDim || 1280;
        const k = Math.min(1, M / Math.max(w, h));
        w = Math.round(w * k); h = Math.round(h * k);
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        const keepPng = (src.indexOf('data:image/png') === 0 && src.length < 160 * 1024);
        resolve(keepPng ? src : c.toDataURL('image/jpeg', quality || 0.85));
      };
      img.onerror = () => reject(new Error('图片解码失败'));
      img.src = src;
    });
  }

  async function fileToDataURL(file, maxDim) {
    const raw = await new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result);
      fr.onerror = () => rej(new Error('读取失败'));
      fr.readAsDataURL(file);
    });
    return compressImage(raw, maxDim, 0.85);
  }

  function placeImageNode(dataURL, wx, wy, name) {
    const nodes = APP.getNodes();
    const sel = APP.getSelId();
    const pid = (sel && nodes[sel]) ? sel : APP.getRootId();
    const ids = APP.addChildrenTo(pid, [name || '🖼 图片']);
    if (!ids || !ids[0]) return null;
    const id = ids[0];
    const n = nodes[id];
    n.x = wx; n.y = wy;
    n.color = 'scene';
    IMG[id] = dataURL;
    META[id] = META[id] || { w: 220 };
    APP.render();
    redrawEdges();
    decorateAll();
    saveImages();
    APP.save();
    return id;
  }

  function decorateAll() {
    document.querySelectorAll('#nodes .node').forEach((el) => {
      const id = el.dataset.id;
      const has = !!el.querySelector('.node-img');
      if (IMG[id] && !has) {
        el.classList.add('has-img');
        const img = document.createElement('img');
        img.className = 'node-img';
        img.src = IMG[id];
        img.draggable = false;
        img.style.width = ((META[id] && META[id].w) || 220) + 'px';
        el.insertBefore(img, el.firstChild);
        const rz = document.createElement('div');
        rz.className = 'img-resize';
        rz.title = '拖动缩放图片';
        el.appendChild(rz);
      } else if (!IMG[id] && has) {
        el.classList.remove('has-img');
        const img = el.querySelector('.node-img');
        if (img) img.remove();
        const rz = el.querySelector('.img-resize');
        if (rz) rz.remove();
      }
    });
  }

  async function addImageFiles(files, wx, wy) {
    const list = [...files].filter((f) => /image\//.test(f.type)).slice(0, 8);
    if (!list.length) return;
    let i = 0;
    for (const f of list) {
      try {
        const d = await fileToDataURL(f, 1280);
        placeImageNode(d, wx + i * 24, wy + i * 24, '🖼 ' + (f.name || '图片').slice(0, 24));
        i++;
      } catch (e) { APP.toast('⚠ 图片导入失败：' + e.message); }
    }
    if (i) APP.toast('🖼 已导入 ' + i + ' 张图片（拖动节点可移动，右下角手柄缩放）');
  }

  /* ================= 导入导出（含图片） ================= */
  function toNestedCopy(id) {
    const nodes = APP.getNodes();
    const n = nodes[id];
    return {
      id: n.id, text: n.text, note: n.note, color: n.color,
      collapsed: n.collapsed, link: n.link,
      x: Math.round(n.x), y: Math.round(n.y),
      children: n.children.map(toNestedCopy)
    };
  }
  function exportJSONv5() {
    const data = {
      app: 'shihai', version: 5,
      root: toNestedCopy(APP.getRootId()),
      images: IMG, imgMeta: META
    };
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '识海图谱-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    URL.revokeObjectURL(a.href);
    APP.toast('⬇ 已导出（含 ' + Object.keys(IMG).length + ' 张图片）');
  }
  function importJSONv5(file) {
    const fr = new FileReader();
    fr.onload = () => {
      try {
        const d = JSON.parse(fr.result);
        const root = d.root || d;
        if (!root || !root.text) throw new Error('bad');
        APP.pushHistory('导入图谱');
        APP.buildFromNested(root);
        if (d.images) IMG = d.images;
        if (d.imgMeta) META = d.imgMeta;
        APP.layout(); APP.render(); APP.save(); APP.fitView();
        redrawEdges(); decorateAll(); saveImages();
        APP.toast('导入成功' + (d.images ? '（含 ' + Object.keys(d.images).length + ' 张图片）' : ''));
      } catch (err) { APP.toast('导入失败：JSON 格式不正确'); }
    };
    fr.readAsText(file);
  }

  /* ================= 图片节点清理（随节点删除联动） ================= */
  function pruneImages() {
    const nodes = APP.getNodes();
    let dirty = false;
    Object.keys(IMG).forEach((id) => {
      if (!nodes[id]) { delete IMG[id]; delete META[id]; dirty = true; }
    });
    if (dirty) saveImages();
  }

  /* ================= 启动 ================= */
  function boot() {
    APP = window.ShihaiApp;
    if (!APP) return;
    const vp = $('#viewport');

    // 滚轮缩放（passive:false 才能 preventDefault）
    vp.addEventListener('wheel', onWheel, { passive: false });

    // 指针：平移 / 节点拖拽 / 缩放手柄
    vp.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    vp.addEventListener('dblclick', onDblClick);

    // 空格平移模式
    document.addEventListener('keydown', onKeydown);
    document.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', () => {
      spaceDown = false;
      pan.mode = null;
      pinch = null;
      document.body.style.cursor = '';
    });

    // 拖放图片 / 导入 JSON（借鉴 onDrop）
    vp.addEventListener('dragover', (e) => e.preventDefault());
    vp.addEventListener('drop', (e) => {
      e.preventDefault();
      if (isUI(e.target)) return;
      const w = screenToWorld(e.clientX, e.clientY);
      const fs = e.dataTransfer.files;
      if (!fs || !fs.length) return;
      const json = [...fs].find((f) => /json/.test(f.type) || /\.json$/i.test(f.name));
      if (json) { importJSONv5(json); return; }
      addImageFiles(fs, w.x, w.y);
    });

    // 粘贴图片 → 视图中心
    document.addEventListener('paste', (e) => {
      if (typing(e)) return;
      const items = e.clipboardData && e.clipboardData.items;
      if (!items) return;
      const imgs = [...items].filter((it) => /image\//.test(it.type));
      if (!imgs.length) return;
      e.preventDefault();
      const r = vp.getBoundingClientRect();
      const c = screenToWorld(r.left + r.width / 2, r.top + r.height / 2);
      addImageFiles(imgs.map((it) => it.getAsFile()).filter(Boolean), c.x - 110, c.y - 80);
    });

    // 工具栏 🖼 上传
    const upBtn = $('#btn-image');
    const upFile = $('#file-image');
    if (upBtn && upFile) {
      upBtn.onclick = () => upFile.click();
      upFile.onchange = () => {
        if (!upFile.files.length) return;
        const r = vp.getBoundingClientRect();
        const c = screenToWorld(r.left + r.width / 2, r.top + r.height / 2);
        addImageFiles(upFile.files, c.x - 110, c.y - 80);
        upFile.value = '';
      };
    }

    // 平滑缩放按钮（覆盖 ui.js 的瞬时缩放）
    const zin = $('#zoom-in'), zout = $('#zoom-out');
    if (zin) zin.onclick = () => {
      const r = vp.getBoundingClientRect();
      smoothZoomAt(r.left + r.width / 2, r.top + r.height / 2, 1.28);
    };
    if (zout) zout.onclick = () => {
      const r = vp.getBoundingClientRect();
      smoothZoomAt(r.left + r.width / 2, r.top + r.height / 2, 1 / 1.28);
    };

    // 搜索跳转 / minimap → 平滑动画（覆盖 centerOn）
    APP.centerOn = function (id, minScale) {
      const n = APP.getNodes()[id];
      if (!n) return;
      const r = vp.getBoundingClientRect();
      const v = APP.view();
      const s = (minScale && v.s < minScale) ? minScale : v.s;
      animateViewTo(r.width / 2 - n.x * s, r.height / 2 - n.y * s, s, 360);
    };

    // 导入导出含图片（覆盖 ui.js 按钮走的导出/导入）
    APP.exportJSON = exportJSONv5;
    APP.importJSON = importJSONv5;

    // 图片节点装饰轮询（app.js 内部 render 后自动补装饰）
    let lastDom = '';
    (function decTick() {
      const sig = APP.nodeCount() + '|' + $('#nodes').childElementCount;
      if (sig !== lastDom) {
        lastDom = sig;
        decorateAll();
        pruneImages();
      }
      requestAnimationFrame(decTick);
    })();

    // 初次
    decorateAll();
    redrawEdges();
  }

  // 供 media.js / 外部使用
  window.ShihaiInteract = {
    applyWorld, screenToWorld, redrawEdges, updateEdgesOf,
    animateViewTo, smoothZoomAt, placeImageNode, compressImage,
    fileToDataURL, decorateAll, saveImages, exportJSONv5, importJSONv5,
    getImages: () => IMG, getMeta: () => META
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(boot, 40));
  } else {
    setTimeout(boot, 40);
  }
})();
