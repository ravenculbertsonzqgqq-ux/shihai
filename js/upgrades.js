/* ============================================================
   识海 · v4 升级模块（独立增强，不动核心）
   调研落地：小地图雷达 · 视口虚拟化 · Ctrl+K 命令面板 ·
   平滑动画视图 · 选中路径高亮 · 折叠管理 ·
   🪑 圆桌会议（多 Agent 并行+合并）· 🔬 深度反思（Reflexion 3 轮）
   ============================================================ */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  let APP = null;
  let mmCanvas = null, mmBox = null;

  /* ================= 视图同步（与 app.js applyView 一致） ================= */
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
    drawMinimap();
  }

  /* ================= 视口虚拟化（性能：离屏节点隐藏） ================= */
  function cull() {
    const layer = $('#nodes');
    if (!layer) return;
    const v = APP.view();
    const r = $('#viewport').getBoundingClientRect();
    const pad = 260;
    const x0 = -v.x / v.s - pad, y0 = -v.y / v.s - pad;
    const x1 = (r.width - v.x) / v.s + pad, y1 = (r.height - v.y) / v.s + pad;
    const nodes = APP.getNodes();
    const els = layer.querySelectorAll('.node');
    for (let i = 0; i < els.length; i++) {
      const el = els[i];
      const n = nodes[el.dataset.id];
      if (!n) continue;
      const on = n.x >= x0 && n.x <= x1 && n.y >= y0 && n.y <= y1;
      if (el.classList.contains('culled') === on) el.classList.toggle('culled', !on);
    }
  }

  /* ================= 小地图雷达（MindCanvas 式：点击/拖拽跳转） ================= */
  function drawMinimap() {
    if (!mmCanvas) return;
    const ctx = mmCanvas.getContext('2d');
    const W = mmCanvas.width, H = mmCanvas.height;
    ctx.clearRect(0, 0, W, H);
    const nodes = APP.getNodes();
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, any = false;
    for (const id in nodes) {
      const n = nodes[id];
      any = true;
      if (n.x < x0) x0 = n.x;
      if (n.x > x1) x1 = n.x;
      if (n.y < y0) y0 = n.y;
      if (n.y > y1) y1 = n.y;
    }
    if (!any) return;
    const pad = 60;
    x0 -= pad; y0 -= pad; x1 += pad; y1 += pad;
    const s = Math.min(W / (x1 - x0), H / (y1 - y0));
    const ox = (W - (x1 - x0) * s) / 2, oy = (H - (y1 - y0) * s) / 2;
    mmBox = { x0, y0, s, ox, oy };
    const rootId = APP.getRootId();
    for (const id in nodes) {
      const n = nodes[id];
      const px = ox + (n.x - x0) * s, py = oy + (n.y - y0) * s;
      ctx.fillStyle = id === rootId ? '#b39dff' : 'rgba(110,168,255,0.75)';
      const sz = id === rootId ? 5 : 2.2;
      ctx.fillRect(px - sz / 2, py - sz / 2, sz, sz);
    }
    // 当前视口矩形（金色雷达框）
    const v = APP.view();
    const r = $('#viewport').getBoundingClientRect();
    const wx0 = -v.x / v.s, wy0 = -v.y / v.s;
    const wx1 = (r.width - v.x) / v.s, wy1 = (r.height - v.y) / v.s;
    ctx.strokeStyle = '#f5c451';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(
      ox + (wx0 - x0) * s, oy + (wy0 - y0) * s,
      Math.max(4, (wx1 - wx0) * s), Math.max(4, (wy1 - wy0) * s)
    );
  }

  function minimapJump(e) {
    if (!mmBox) return;
    const r = mmCanvas.getBoundingClientRect();
    const px = e.clientX - r.left, py = e.clientY - r.top;
    const wx = (px - mmBox.ox) / mmBox.s + mmBox.x0;
    const wy = (py - mmBox.oy) / mmBox.s + mmBox.y0;
    const v = APP.view();
    const vr = $('#viewport').getBoundingClientRect();
    v.x = vr.width / 2 - wx * v.s;
    v.y = vr.height / 2 - wy * v.s;
    applyWorld();
    syncTick();
  }

  /* ================= 平滑动画视图（Animated fit） ================= */
  function animateView(tx, ty, ts) {
    const f0 = APP.view();
    const fx = f0.x, fy = f0.y, fs = f0.s;
    const t0 = performance.now();
    (function step(t) {
      const k = Math.min(1, (t - t0) / 380);
      const e = 1 - Math.pow(1 - k, 3);
      const v = APP.view();
      v.x = fx + (tx - fx) * e;
      v.y = fy + (ty - fy) * e;
      v.s = fs + (ts - fs) * e;
      applyWorld();
      if (k < 1) requestAnimationFrame(step);
    })(t0);
  }

  function nodeWidth(n) {
    let w = 30;
    for (const ch of n.text) w += ch.charCodeAt(0) > 255 ? 14.5 : 7.4;
    return Math.max(110, Math.min(340, w));
  }

  function smoothFit() {
    const nodes = APP.getNodes();
    const ids = Object.keys(nodes).filter((id) => {
      let p = nodes[id].parent;
      while (p) { if (nodes[p].collapsed) return false; p = nodes[p].parent; }
      return true;
    });
    if (!ids.length) return;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const id of ids) {
      const n = nodes[id];
      const w = nodeWidth(n);
      x0 = Math.min(x0, n.x - w / 2); x1 = Math.max(x1, n.x + w / 2);
      y0 = Math.min(y0, n.y - 20); y1 = Math.max(y1, n.y + 20);
    }
    const r = $('#viewport').getBoundingClientRect();
    const s = Math.max(0.05, Math.min(1.35,
      (r.width * 0.88) / (x1 - x0), (r.height * 0.84) / (y1 - y0)));
    animateView(r.width / 2 - ((x0 + x1) / 2) * s, r.height / 2 - ((y0 + y1) / 2) * s, s);
  }

  /* ================= 选中路径高亮（金色链条） ================= */
  function highlightPath(id) {
    document.querySelectorAll('.node.onpath').forEach((el) => el.classList.remove('onpath'));
    if (!id) return;
    const nodes = APP.getNodes();
    let cur = id, guard = 0;
    while (cur && guard++ < 64) {
      const el = document.querySelector(`#nodes .node[data-id="${cur}"]`);
      if (el) el.classList.add('onpath');
      cur = nodes[cur] ? nodes[cur].parent : null;
    }
  }

  /* ================= 折叠管理（🪗 保留前两层 / 🧺 全展） ================= */
  function setFold(flag) {
    APP.pushHistory(flag ? '折叠全部' : '展开全部');
    const nodes = APP.getNodes();
    (function walk(id, depth) {
      const n = nodes[id];
      if (!n || !n.children.length) return;
      n.collapsed = flag ? depth >= 2 : false;
      n.children.forEach((c) => walk(c, depth + 1));
    })(APP.getRootId(), 0);
    APP.render();
    APP.save();
    APP.toast(flag ? '🪗 已折叠（保留前两层）' : '🧺 已全部展开');
    setTimeout(smoothFit, 80);
  }

  /* ================= 圆桌会议（多 Agent 并行+主持人合并） ================= */
  let rtBuilt = false;
  function buildRoundtable() {
    const modal = $('#roundtable-modal');
    if (!modal || rtBuilt) return;
    rtBuilt = true;
    const defaults = ['sun-tzu', 'kahneman', 'wang-yangming'];
    const groups = {};
    (window.SHIHAI_ADVISORS || []).forEach((a) => {
      (groups[a.domain_zh] = groups[a.domain_zh] || []).push(a);
    });
    [1, 2, 3].forEach((i) => {
      const sel = modal.querySelector('#rt-advisor-' + i);
      if (!sel) return;
      Object.keys(groups).forEach((dz) => {
        const og = document.createElement('optgroup');
        og.label = dz;
        groups[dz].forEach((a) => {
          const opt = document.createElement('option');
          opt.value = a.id;
          opt.textContent = a.name_zh + '（' + a.era + '）';
          og.appendChild(opt);
        });
        sel.appendChild(og);
      });
      sel.value = defaults[i - 1] || '';
    });
  }

  async function runRoundtable() {
    const modal = $('#roundtable-modal');
    const ids = [1, 2, 3]
      .map((i) => modal.querySelector('#rt-advisor-' + i).value)
      .filter(Boolean);
    const q = ($('#rt-question').value.trim() || $('#ai-input').value.trim());
    if (!q) return APP.toast('请先填写圆桌议题');
    if (!ids.length) return APP.toast('请至少选择一位顾问');
    closeMine();
    $('#modal-mask').classList.remove('show');
    $('#ai-panel').classList.add('open');
    const log = $('#ai-log');
    const userDiv = document.createElement('div');
    userDiv.className = 'msg user';
    userDiv.innerHTML = '<div class="bubble"></div>';
    userDiv.querySelector('.bubble').textContent = '🪑 圆桌议题：' + q;
    log.appendChild(userDiv);
    const thinking = document.createElement('div');
    thinking.className = 'msg ai';
    thinking.innerHTML = '<div class="bubble">🪑 圆桌进行中……（' + ids.length + ' 位顾问并行应答，主持人随后综合）</div>';
    log.appendChild(thinking);
    log.scrollTop = log.scrollHeight;
    try {
      const res = await window.ShihaiAI.roundtable(q, ids, APP);
      thinking.remove();
      res.panels.forEach((p) => {
        const div = document.createElement('div');
        div.className = 'msg ai';
        div.innerHTML = '<div class="bubble rt-panel"><b>🎓 ' + p.name + '（' + p.era + '）</b><br></div>';
        div.querySelector('.bubble').appendChild(document.createTextNode(p.reply));
        log.appendChild(div);
      });
      const syn = document.createElement('div');
      syn.className = 'msg ai';
      syn.innerHTML = '<div class="bubble rt-synth"><b>⚖️ 主持人综合</b><br></div>';
      syn.querySelector('.bubble').appendChild(document.createTextNode(res.synthesis));
      log.appendChild(syn);
    } catch (e) {
      thinking.querySelector('.bubble').textContent = '⚠ 圆桌失败：' + e.message;
    }
    log.scrollTop = log.scrollHeight;
  }

  /* ================= 深度反思模式（Reflexion：初稿→批评→修订） ================= */
  async function deepSend() {
    const input = $('#ai-input');
    const text = input.value.trim();
    if (!text) return;
    const advisorSel = $('#ai-advisor');
    const advisorId = advisorSel ? advisorSel.value : '';
    input.value = '';
    const log = $('#ai-log');
    const u = document.createElement('div');
    u.className = 'msg user';
    u.innerHTML = '<div class="bubble"></div>';
    u.querySelector('.bubble').textContent = '🔬 ' + text;
    log.appendChild(u);
    const t = document.createElement('div');
    t.className = 'msg ai';
    t.innerHTML = '<div class="bubble">🔬 深度模式 ① 初稿生成中…</div>';
    log.appendChild(t);
    log.scrollTop = log.scrollHeight;
    try {
      const draft = await window.ShihaiAI.chatOnce(text, APP, advisorId);
      t.querySelector('.bubble').textContent = '🔬 深度模式 ② 自我批评中…';
      const crit = await window.ShihaiAI.critique(text, draft.reply, APP);
      t.querySelector('.bubble').textContent = '🔬 深度模式 ③ 修订终稿中…';
      const fin = await window.ShihaiAI.revise(text, draft.reply, crit, APP);
      t.remove();
      const d = document.createElement('div');
      d.className = 'msg ai';
      d.innerHTML =
        '<div class="bubble">' +
        '<details class="deep-d"><summary>📄 初稿（展开查看）</summary><div class="deep-body"></div></details>' +
        '<details class="deep-c"><summary>🔍 批评意见（展开查看）</summary><div class="deep-body"></div></details>' +
        '<b>✨ 修订终稿</b><br><span class="deep-final"></span></div>';
      d.querySelector('.deep-d .deep-body').textContent = draft.reply;
      d.querySelector('.deep-c .deep-body').textContent = crit;
      d.querySelector('.deep-final').textContent = fin;
      log.appendChild(d);
    } catch (e) {
      t.querySelector('.bubble').textContent = '⚠ 深度模式失败：' + e.message;
    }
    log.scrollTop = log.scrollHeight;
  }

  /* ================= 弹窗管理 ================= */
  function closeMine() {
    const rt = $('#roundtable-modal');
    if (rt) rt.classList.remove('show');
    const hp = $('#help-modal');
    if (hp) hp.classList.remove('show');
  }
  function toggleHelp() {
    const m = $('#help-modal');
    if (!m) return;
    const show = !m.classList.contains('show');
    $('#modal-mask').classList.toggle('show', show);
    m.classList.toggle('show', show);
    if (show) {
      const rt = $('#roundtable-modal');
      if (rt) rt.classList.remove('show');
    }
  }

  /* ================= 主循环：DOM 签名轮询（虚拟化+小地图+路径） ================= */
  let lastViewSig = '', lastDomSig = '', lastSel = '';
  function syncTick() {
    const v = APP.view();
    const domSig = APP.nodeCount() + '|' + ($('#nodes').childElementCount);
    const sel = APP.getSelId() || '';
    if (domSig !== lastDomSig) {
      lastDomSig = domSig;
      cull();
      drawMinimap();
    }
    const viewSig = v.x + ',' + v.y + ',' + v.s;
    if (viewSig !== lastViewSig) {
      lastViewSig = viewSig;
      cull();
      drawMinimap();
    }
    if (sel !== lastSel) {
      lastSel = sel;
      highlightPath(sel);
    }
    requestAnimationFrame(syncTick);
  }

  /* ================= 启动 ================= */
  function boot() {
    APP = window.ShihaiApp;
    if (!APP) return;

    // 工具栏 → 平滑动画全览
    APP.fitView = smoothFit;

    // 小地图交互
    mmCanvas = $('#minimap');
    if (mmCanvas) {
      let mmDrag = false;
      mmCanvas.addEventListener('pointerdown', (e) => {
        mmDrag = true;
        minimapJump(e);
        mmCanvas.setPointerCapture(e.pointerId);
      });
      mmCanvas.addEventListener('pointermove', (e) => { if (mmDrag) minimapJump(e); });
      mmCanvas.addEventListener('pointerup', () => { mmDrag = false; });
    }

    // 新按钮
    const bind = (id, fn) => { const el = $(id); if (el) el.onclick = fn; };
    bind('#btn-collapse-all', () => setFold(true));
    bind('#btn-expand-all', () => setFold(false));
    bind('#btn-roundtable', () => {
      buildRoundtable();
      const q = $('#ai-input').value.trim();
      if (q && !$('#rt-question').value.trim()) $('#rt-question').value = q;
      $('#modal-mask').classList.add('show');
      $('#roundtable-modal').classList.add('show');
    });
    bind('#btn-help', toggleHelp);
    bind('#help-close', () => { closeMine(); $('#modal-mask').classList.remove('show'); });
    bind('#rt-close', () => { closeMine(); $('#modal-mask').classList.remove('show'); });
    bind('#rt-run', runRoundtable);
    // 点遮罩也关掉我的弹窗（ui.js 会关它自己的）
    const mask = $('#modal-mask');
    if (mask) mask.addEventListener('click', closeMine);

    // 深度模式：切换发送行为（按钮 + 输入框 Enter 均拦截）
    const deepToggle = $('#deep-toggle');
    const sendBtn = $('#ai-send');
    if (deepToggle && sendBtn) {
      const origSend = sendBtn.onclick; // ui.js 绑定的普通发送
      deepToggle.addEventListener('change', () => {
        sendBtn.onclick = deepToggle.checked ? deepSend : origSend;
        APP.toast(deepToggle.checked
          ? '🔬 深度反思模式已开启（初稿→批评→修订）'
          : '↩ 已回到普通模式');
      });
      // 捕获阶段拦截 Enter，避免走 ui.js 的普通发送
      document.addEventListener('keydown', (e) => {
        if (deepToggle.checked && e.key === 'Enter' && !e.shiftKey &&
            e.target && e.target.id === 'ai-input') {
          e.preventDefault();
          e.stopPropagation();
          deepSend();
        }
      }, true);
    }

    // 快捷键：Ctrl+K 命令面板 · ? 帮助
    document.addEventListener('keydown', (e) => {
      const typing = /INPUT|TEXTAREA/.test(e.target.tagName) || e.target.isContentEditable;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        const s = $('#search');
        if (s) { s.focus(); s.select(); APP.toast('🔍 命令面板：输入关键词，Enter 跳转'); }
      } else if (e.key === '?' && !typing) {
        e.preventDefault();
        toggleHelp();
      }
    });

    // 初始渲染
    lastDomSig = APP.nodeCount() + '|' + ($('#nodes').childElementCount);
    cull();
    drawMinimap();
    syncTick();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(boot, 30));
  } else {
    setTimeout(boot, 30);
  }
})();
