/* ============================================================
   识海 · UI 模块 v2 —— 工具栏 / 面板 / 历史快照 / AI 交互
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

  function init(app) {
    APP = app;

    /* ---------- 工具栏 ---------- */
    $('#btn-add-child').onclick = () => {
      if (!APP.getSelId()) return APP.toast('请先选中一个节点');
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    };
    $('#btn-add-sib').onclick = () => {
      if (!APP.getSelId()) return APP.toast('请先选中一个节点');
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    };
    $('#btn-edit').onclick = () => {
      if (APP.getSelId()) document.dispatchEvent(new KeyboardEvent('keydown', { key: 'F2', bubbles: true }));
      else APP.toast('请先选中一个节点');
    };
    $('#btn-del').onclick = () => {
      if (APP.getSelId()) document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
    };
    $('#btn-layout').onclick = () => {
      APP.pushHistory('整理布局');
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
    $('#btn-ai').onclick = () => $('#ai-panel').classList.toggle('open');

    /* ---------- 历史 / 快照 ---------- */
    $('#btn-undo').onclick = () => { APP.undo(); refreshHistPanel(); };
    $('#btn-redo').onclick = () => { APP.redo(); refreshHistPanel(); };
    $('#btn-history').onclick = () => {
      refreshHistPanel();
      $('#modal-mask').classList.add('show');
      $('#history-modal').classList.add('show');
    };
    $('#hist-close').onclick = closeModal;
    $('#hist-save').onclick = () => {
      const name = $('#hist-name').value.trim();
      APP.saveSnapshot(name || undefined);
      $('#hist-name').value = '';
      refreshHistPanel();
    };
    $('#modal-mask').onclick = closeModal;

    /* ---------- 搜索 ---------- */
    const searchBox = $('#search');
    let hits = [], hitIdx = 0;
    searchBox.addEventListener('input', () => {
      hits = APP.search(searchBox.value.trim());
      $('#search-count').textContent = searchBox.value.trim() ? `${hits.length} 结果` : '';
    });
    searchBox.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && hits.length) {
        e.preventDefault();
        const id = hits[hitIdx % hits.length];
        hitIdx++;
        APP.centerOn(id, 0.6);
      }
    });

    /* ---------- 缩放 ---------- */
    $('#zoom-in').onclick = () => zoomBtn(1.3);
    $('#zoom-out').onclick = () => zoomBtn(0.77);

    /* ---------- 设置 ---------- */
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

    /* ---------- AI 面板 ---------- */
    $('#ai-expand').onclick = () => {
      const id = APP.getSelId();
      if (!id) return APP.toast('请先选中要扩展的节点');
      window.ShihaiAI.expandNode(id, ctx());
    };
    $('#ai-send').onclick = sendChat;
    $('#ai-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); }
    });

    /* ---------- 节点信息面板 ---------- */
    $('#info-save').onclick = () => {
      const id = APP.getSelId();
      if (!id) return;
      const nodes = ctx().getNodes();
      const t = $('#info-text').value.trim() || '未命名';
      const n = $('#info-note').value.trim();
      const c = $('#info-color').value;
      if (t !== nodes[id].text) { APP.pushHistory('改名: ' + nodes[id].text); nodes[id].text = t; }
      if (n !== nodes[id].note) { APP.pushHistory('改备注: ' + nodes[id].text); nodes[id].note = n; }
      if (c !== nodes[id].color) { APP.pushHistory('改颜色: ' + nodes[id].text); nodes[id].color = c; }
      APP.render(); APP.save();
      APP.toast('节点已保存（可撤销）');
    };

    /* ---------- 快捷键：撤销 / 重做 ---------- */
    document.addEventListener('keydown', (e) => {
      const typing = /INPUT|TEXTAREA/.test(e.target.tagName) || e.target.isContentEditable;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z' && !typing) {
        e.preventDefault();
        if (e.shiftKey) APP.redo(); else APP.undo();
        refreshHistPanel();
      } else if (mod && e.key.toLowerCase() === 'y' && !typing) {
        e.preventDefault(); APP.redo(); refreshHistPanel();
      } else if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault(); APP.exportJSON();
      }
    });

    fillSettings(window.ShihaiAI.getSettings());
    buildLegend();
  }

  function zoomBtn(f) {
    const v = APP.view();
    const r = document.querySelector('#viewport').getBoundingClientRect();
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
    return APP; // ShihaiApp 即完整 ctx（含 findNode / 历史 / 快照 API）
  }

  /* ---------------- 选中节点 → 信息面板 ---------------- */
  function onSelect(node) {
    if (!node) return;
    $('#info-text').value = node.text;
    $('#info-note').value = node.note;
    $('#info-color').value = node.color;
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
    $('#history-modal').classList.remove('show');
  }
  function fillSettings(s) {
    $('#set-url').value = s.baseUrl || '';
    $('#set-model').value = s.model || '';
    $('#set-key').value = s.apiKey || '';
    $('#set-temp').value = s.temperature != null ? s.temperature : 0.7;
  }

  /* ---------------- 历史面板 ---------------- */
  function refreshHistPanel() {
    const info = APP.histInfo();
    const snaps = APP.listSnapshots();
    const fmt = (t) => new Date(t).toLocaleString('zh-CN', { hour12: false });

    const undoBox = $('#hist-undo');
    undoBox.innerHTML = info.undo.length ? '' : '<div class="hist-empty">暂无可回滚的操作记录</div>';
    // 最新在上
    [...info.undo].reverse().forEach((h) => {
      const div = document.createElement('div');
      div.className = 'hist-item';
      div.innerHTML =
        `<span class="hist-label">${esc(h.label)}</span>` +
        `<span class="hist-time">${fmt(h.time)}</span>` +
        `<button class="btn mini hist-restore" data-i="${h.i}">回滚到此</button>`;
      div.querySelector('.hist-restore').onclick = () => {
        APP.restoreUndoAt(h.i);
        refreshHistPanel();
      };
      undoBox.appendChild(div);
    });

    const snapBox = $('#hist-snaps');
    snapBox.innerHTML = snaps.length ? '' : '<div class="hist-empty">暂无命名快照 —— 点上方「📌 保存当前为快照」创建</div>';
    snaps.forEach((s) => {
      const div = document.createElement('div');
      div.className = 'hist-item';
      div.innerHTML =
        `<span class="hist-label">📌 ${esc(s.name)} <em>(${s.count} 节点)</em></span>` +
        `<span class="hist-time">${fmt(s.time)}</span>` +
        `<button class="btn mini hist-restore">恢复</button>` +
        `<button class="btn mini hist-del">删除</button>`;
      div.querySelector('.hist-restore').onclick = () => {
        APP.restoreSnapshot(s.id);
        refreshHistPanel();
      };
      div.querySelector('.hist-del').onclick = () => {
        APP.deleteSnapshot(s.id);
        refreshHistPanel();
      };
      snapBox.appendChild(div);
    });
    $('#hist-count').textContent =
      `撤销栈 ${info.undo.length} 步 · 重做栈 ${info.redo.length} 步 · 快照 ${snaps.length} 个`;
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  /* ---------------- AI 对话：支持操控图谱 ---------------- */
  async function sendChat() {
    const input = $('#ai-input');
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    appendMsg('user', text);
    const thinking = appendMsg('ai', '思考中…（正在检索识海记忆索引）');
    try {
      const res = await window.ShihaiAI.chatOnce(text, ctx());
      thinking.querySelector('.bubble').textContent = res.reply;

      // 记忆索引指示
      if (res.memoryHits && res.memoryHits.length) {
        const mem = document.createElement('div');
        mem.className = 'mem-hits';
        mem.innerHTML = '🗂 已调用记忆索引：' +
          res.memoryHits.slice(0, 5).map((h) => `<span class="mem-chip" title="${esc(h.path)}">${esc(h.text)}</span>`).join('');
        $('#ai-log').insertBefore(mem, thinking.nextSibling);
      }
      // 指令执行结果
      if (res.cmdResults && res.cmdResults.length) {
        const box = document.createElement('div');
        box.className = 'cmd-results';
        res.cmdResults.forEach((r) => {
          const chip = document.createElement('div');
          chip.className = 'cmd-chip ' + (r.ok ? 'ok' : 'fail');
          chip.textContent = r.msg;
          box.appendChild(chip);
        });
        const undoBtn = document.createElement('button');
        undoBtn.className = 'btn mini';
        undoBtn.textContent = '↩ 撤销这些操作';
        undoBtn.onclick = () => { APP.undo(); refreshHistPanel(); APP.toast('已撤销 AI 的图谱操作'); };
        box.appendChild(undoBtn);
        $('#ai-log').appendChild(box);
      }
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
