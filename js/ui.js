/* ============================================================
   识海 · UI 模块 —— 工具栏 / 侧栏 / 设置 / AI 面板
   ============================================================ */
(function () {
  'use strict';

  let APP = null;
  const $ = (s) => document.querySelector(s);

  const COLOR_LABELS = {
    root: '根', axiom: '公理', cog: '认知', value: '价值', decide: '决策',
    solve: '解题', exec: '执行', review: '复盘', model: '模型', scene: '场景',
    anti: '反模式', life: '日常', method: '思维法', war: '兵书', east: '东方',
    west: '西方', book: '典籍'
  };

  /* ---------------- 初始化 ---------------- */
  function init(app) {
    APP = app;

    // 工具栏
    $('#btn-add-child').onclick = () => APP.getSelId() ? addChildViaUI() : APP.toast('请先选中一个节点');
    $('#btn-add-sib').onclick = () => {
      const id = APP.getSelId();
      if (!id) return APP.toast('请先选中一个节点');
      // 复用 app 内部逻辑：派发回车键等价操作
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    };
    $('#btn-edit').onclick = () => {
      const id = APP.getSelId();
      if (id) document.dispatchEvent(new KeyboardEvent('keydown', { key: 'F2', bubbles: true }));
      else APP.toast('请先选中一个节点');
    };
    $('#btn-del').onclick = () => {
      const id = APP.getSelId();
      if (id) document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
    };
    $('#btn-layout').onclick = () => {
      APP.layout(); APP.render(); APP.save(); APP.toast('已重新整理布局');
    };
    $('#btn-fit').onclick = () => APP.fitView();
    $('#btn-export').onclick = () => APP.exportJSON();
    $('#btn-import').onclick = () => $('#file-import').click();
    $('#file-import').onchange = (e) => {
      if (e.target.files[0]) APP.importJSON(e.target.files[0]);
      e.target.value = '';
    };
    $('#btn-reset').onclick = () => APP.resetMap();
    $('#btn-settings').onclick = openSettings;
    $('#btn-ai').onclick = () => {
      $('#ai-panel').classList.toggle('open');
    };

    // 搜索
    const searchBox = $('#search');
    let hits = [], hitIdx = 0;
    searchBox.addEventListener('input', () => {
      hits = APP.search(searchBox.value.trim());
      $('#search-count').textContent = searchBox.value.trim() ? `${hits.length} 个结果` : '';
    });
    searchBox.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && hits.length) {
        e.preventDefault();
        const id = hits[hitIdx % hits.length];
        hitIdx++;
        APP.centerOn(id, 0.6);
      }
    });

    // 缩放按钮
    $('#zoom-in').onclick = () => zoomBtn(1.3);
    $('#zoom-out').onclick = () => zoomBtn(0.77);

    // 设置面板
    $('#set-save').onclick = () => {
      const s = {
        baseUrl: $('#set-url').value.trim() || window.ShihaiAI.DEFAULTS.baseUrl,
        model: $('#set-model').value.trim() || window.ShihaiAI.DEFAULTS.model,
        apiKey: $('#set-key').value.trim(),
        temperature: parseFloat($('#set-temp').value) || 0.7
      };
      window.ShihaiAI.saveSettings(s);
      closeModal();
      APP.toast('✅ AI 设置已保存（存于本地浏览器）');
    };
    $('#set-default').onclick = () => fillSettings(window.ShihaiAI.DEFAULTS);
    $('#set-close').onclick = closeModal;
    $('#modal-mask').onclick = closeModal;

    // AI 面板
    $('#ai-expand').onclick = () => {
      const id = APP.getSelId();
      if (!id) return APP.toast('请先选中要扩展的节点');
      window.ShihaiAI.expandNode(id, ctx());
    };
    $('#ai-send').onclick = sendChat;
    $('#ai-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); }
    });

    // 节点信息面板
    $('#info-save').onclick = () => {
      const id = APP.getSelId();
      if (!id) return;
      const nodes = ctx().getNodes();
      nodes[id].text = $('#info-text').value.trim() || '未命名';
      nodes[id].note = $('#info-note').value.trim();
      nodes[id].color = $('#info-color').value;
      APP.render(); APP.save();
      APP.toast('节点已保存');
    };

    fillSettings(window.ShihaiAI.getSettings());
    buildLegend();
  }

  function addChildViaUI() {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
  }

  function zoomBtn(f) {
    const v = APP.view();
    const r = document.querySelector('#viewport').getBoundingClientRect();
    // 模拟一次缩放（直接改视图）
    const ns = Math.min(2.5, Math.max(0.05, v.s * f));
    const k = ns / v.s;
    v.x = r.width / 2 - (r.width / 2 - v.x) * k;
    v.y = r.height / 2 - (r.height / 2 - v.y) * k;
    v.s = ns;
    document.querySelector('#world').style.transform = `translate(${v.x}px, ${v.y}px) scale(${v.s})`;
    const g = 32 * v.s;
    const vp = document.querySelector('#viewport');
    vp.style.backgroundSize = `${g}px ${g}px`;
    vp.style.backgroundPosition = `${v.x}px ${v.y}px`;
    document.querySelector('#zoom-label').textContent = Math.round(v.s * 100) + '%';
  }

  function ctx() {
    // ShihaiApp 本身就是 ctx
    return {
      getNodes: APP.getNodes,
      getRootId: APP.getRootId,
      getSelId: APP.getSelId,
      getSelected: APP.getSelected,
      getPath: APP.getPath,
      addChildrenTo: APP.addChildrenTo,
      toast: APP.toast,
      render: APP.render
    };
  }

  /* ---------------- 选中节点 → 信息面板 ---------------- */
  function onSelect(node) {
    if (!node) return;
    $('#info-text').value = node.text;
    $('#info-note').value = node.note;
    const sel = $('#info-color');
    sel.value = node.color;
    $('#info-id').textContent = 'ID: ' + node.id + (node.link ? '　🔗 联想 → ' + node.link : '');
    $('#info-panel').style.display = 'block';
  }

  /* ---------------- 设置弹窗 ---------------- */
  function openSettings() {
    fillSettings(window.ShihaiAI.getSettings());
    $('#modal-mask').classList.add('show');
    $('#settings-modal').classList.add('show');
  }
  function closeModal() {
    $('#modal-mask').classList.remove('show');
    $('#settings-modal').classList.remove('show');
  }
  function fillSettings(s) {
    $('#set-url').value = s.baseUrl || '';
    $('#set-model').value = s.model || '';
    $('#set-key').value = s.apiKey || '';
    $('#set-temp').value = s.temperature != null ? s.temperature : 0.7;
  }

  /* ---------------- AI 对话 ---------------- */
  async function sendChat() {
    const input = $('#ai-input');
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    appendMsg('user', text);
    const thinking = appendMsg('ai', '思考中…');
    try {
      const reply = await window.ShihaiAI.chatOnce(text, ctx());
      thinking.querySelector('.bubble').textContent = reply;
    } catch (e) {
      thinking.querySelector('.bubble').textContent = '⚠ ' + e.message;
    }
    $('#ai-log').scrollTop = $('#ai-log').scrollHeight;
  }

  function appendMsg(role, text) {
    const div = document.createElement('div');
    div.className = 'msg ' + role;
    div.innerHTML = '<div class="bubble"></div>';
    div.querySelector('.bubble').textContent = text;
    $('#ai-log').appendChild(div);
    $('#ai-log').scrollTop = $('#ai-log').scrollHeight;
    return div;
  }

  /* ---------------- 图例 ---------------- */
  function buildLegend() {
    const box = $('#legend');
    Object.keys(COLOR_LABELS).forEach((k) => {
      const chip = document.createElement('span');
      chip.className = 'chip c-' + k;
      chip.textContent = COLOR_LABELS[k];
      box.appendChild(chip);
    });
  }

  window.ShihaiUI = { init, onSelect, openSettings };
})();
