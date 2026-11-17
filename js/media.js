/* ============================================================
   识海 · v5 媒体与模型 IO（借鉴 basketikun/infinite-canvas 工作台）
   —— 🧾 模型输入/输出日志面板 · 🎨 AI 生图（提示词+参考图→图片节点）·
      📎 图片随聊输入（多模态 image_url）· 「回答存为节点」
   ============================================================ */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  let APP = null;

  /* ================= 通用弹窗 ================= */
  function openModal(sel) {
    $('#modal-mask').classList.add('show');
    $(sel).classList.add('show');
  }
  function closeMine() {
    ['#gen-modal', '#io-modal'].forEach((s) => {
      const el = $(s);
      if (el) el.classList.remove('show');
    });
    $('#modal-mask').classList.remove('show');
  }

  /* ================= 🧾 模型输入/输出日志 ================= */
  function renderIO() {
    const box = $('#io-list');
    if (!box) return;
    const log = (window.__shihaiIOLog || []).slice().reverse();
    box.innerHTML = '';
    if (!log.length) {
      box.innerHTML = '<div class="hist-empty">还没有模型调用记录。发起一次 AI 对话 / 生图后，这里会显示完整的输入与输出。</div>';
      return;
    }
    log.forEach((e, i) => {
      const card = document.createElement('div');
      card.className = 'io-card' + (e.error ? ' io-err' : '');
      const head = document.createElement('div');
      head.className = 'io-head';
      const kind = e.kind === 'image' ? '🎨 生图' : '💬 对话';
      head.innerHTML = '<b>' + kind + '</b><span class="io-model"></span><span class="io-time"></span>';
      head.querySelector('.io-model').textContent = e.model || '';
      head.querySelector('.io-time').textContent =
        new Date(e.t).toLocaleTimeString('zh-CN', { hour12: false }) + ' · ' + e.ms + 'ms' +
        (e.usage ? ' · ' + (e.usage.prompt_tokens || '?') + 'in/' + (e.usage.completion_tokens || '?') + 'out' +
          (e.usage.total_tokens ? ' · ' + e.usage.total_tokens + 't' : '') : '');
      card.appendChild(head);

      if (e.kind === 'image') {
        const d = document.createElement('details');
        d.className = 'io-body';
        d.innerHTML = '<summary>输入（提示词' + (e.ref ? ' + 参考图' : '') + '）</summary>';
        const pre = document.createElement('div');
        pre.className = 'io-pre';
        pre.textContent = (e.prompt || '') + (e.size ? '\n[size: ' + e.size + ']' : '') +
          (e.ref ? '\n[参考图：已附加]' : '');
        d.appendChild(pre);
        card.appendChild(d);
      } else {
        const msgs = e.messages || [];
        const d = document.createElement('details');
        d.className = 'io-body';
        d.innerHTML = '<summary>输入（' + msgs.length + ' 条消息）</summary>';
        const pre = document.createElement('div');
        pre.className = 'io-pre';
        pre.textContent = msgs.map((m) => {
          let c = m.content;
          if (Array.isArray(c)) {
            c = c.map((p) => p.type === 'text' ? p.text
              : '[图片 ' + String(p.image_url && p.image_url.url || '').slice(0, 40) + '…]').join('\n');
          }
          return '【' + m.role + '】' + String(c || '').slice(0, 1200);
        }).join('\n\n');
        d.appendChild(pre);
        card.appendChild(d);
      }

      const out = document.createElement('details');
      out.className = 'io-body';
      out.open = true;
      out.innerHTML = '<summary>输出' + (e.error ? '（错误）' : '') + '</summary>';
      const op = document.createElement('div');
      op.className = 'io-pre';
      op.textContent = e.error ? ('⚠ ' + e.error) : String(e.reply || '').slice(0, 4000) || '(空)';
      out.appendChild(op);
      card.appendChild(out);
      box.appendChild(card);
    });
  }
  window.__shihaiIOUpdate = function () {
    const io = $('#io-modal');
    if (io && io.classList.contains('show')) renderIO();
  };

  /* ================= 🎨 AI 生图（输入→输出→图片节点） ================= */
  function refFromSelection() {
    const id = APP.getSelId();
    const imgs = window.ShihaiInteract.getImages();
    return id && imgs[id] ? imgs[id] : null;
  }

  async function urlToDataURL(u) {
    try {
      const r = await fetch(u);
      const b = await r.blob();
      return await new Promise((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(fr.result);
        fr.onerror = () => rej(new Error('转换失败'));
        fr.readAsDataURL(b);
      });
    } catch (e) { return u; } // 跨域取不到就直接用 URL
  }

  async function generateImage() {
    const prompt = $('#gen-prompt').value.trim();
    const model = $('#gen-model').value.trim() || 'gpt-image-1';
    const size = $('#gen-size').value;
    const refEl = $('#gen-ref-img');
    const ref = refEl && refEl.src ? refEl.src : null;
    if (!prompt) return APP.toast('请填写生图提示词');
    const s = window.ShihaiAI.getSettings();
    if (!s.apiKey) return APP.toast('未配置 API Key（⚙ 设置）');
    const btn = $('#gen-run');
    btn.disabled = true;
    btn.textContent = '⏳ 生成中…（约 10-60 秒）';
    const t0 = Date.now();
    const ioLog = (window.__shihaiIOLog = window.__shihaiIOLog || []);
    const ioEntry = { t: t0, kind: 'image', model, prompt, ref: !!ref, size, reply: '', ms: 0, error: '' };
    try {
      const base = s.baseUrl.replace(/\/+$/, '');
      let res;
      if (ref) {
        // 参考图编辑：/images/edits（OpenAI 兼容 multipart）
        const blob = await (await fetch(ref)).blob();
        const fd = new FormData();
        fd.append('image', blob, 'reference.png');
        fd.append('prompt', prompt);
        fd.append('model', model);
        fd.append('n', '1');
        if (size) fd.append('size', size);
        res = await fetch(base + '/images/edits', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + s.apiKey },
          body: fd
        });
      } else {
        res = await fetch(base + '/images/generations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + s.apiKey },
          body: JSON.stringify({ model, prompt, n: 1, size })
        });
      }
      if (!res.ok) {
        const t = await res.text().catch(() => '');
        throw new Error('HTTP ' + res.status + '：' + t.slice(0, 200));
      }
      const data = await res.json();
      const item = data && data.data && data.data[0];
      if (!item) throw new Error('返回中没有图片数据');
      let durl = item.b64_json ? ('data:image/png;base64,' + item.b64_json) : item.url;
      if (!durl) throw new Error('返回中没有 b64_json / url');
      if (!/^data:/.test(durl)) durl = await urlToDataURL(durl);
      const c = APP.view && window.ShihaiInteract.screenToWorld;
      // 输出即入画布：落为图片节点（标题=提示词摘要）
      const vp = $('#viewport').getBoundingClientRect();
      const wc = window.ShihaiInteract.screenToWorld(vp.left + vp.width / 2, vp.top + vp.height / 2);
      const id = window.ShihaiInteract.placeImageNode(durl, wc.x - 120, wc.y - 90, '🎨 ' + prompt.slice(0, 22));
      ioEntry.reply = '已生成图片 → 节点 ' + id;
      APP.toast('🎨 生图完成，已落到画布中央');
      closeMine();
    } catch (e) {
      ioEntry.error = e.message;
      $('#gen-error').textContent = '⚠ ' + e.message;
      $('#gen-error').style.display = 'block';
      APP.toast('⚠ 生图失败：' + e.message.slice(0, 80));
    }
    ioEntry.ms = Date.now() - t0;
    ioLog.push(ioEntry);
    if (ioLog.length > 30) ioLog.shift();
    window.__shihaiIOUpdate();
    btn.disabled = false;
    btn.textContent = '⚡ 开始生成';
  }

  function openGen() {
    $('#gen-error').style.display = 'none';
    // 默认带入选中图片节点作为参考图
    const ref = refFromSelection();
    const refImg = $('#gen-ref-img');
    const refEmpty = $('#gen-ref-empty');
    if (ref) { refImg.src = ref; refImg.style.display = 'block'; refEmpty.style.display = 'none'; }
    else { refImg.removeAttribute('src'); refImg.style.display = 'none'; refEmpty.style.display = 'block'; }
    openModal('#gen-modal');
  }

  /* ================= 📎 图片随聊输入 ================= */
  const chatImgs = () => (window.__shihaiChatImages = window.__shihaiChatImages || []);
  function renderChips() {
    const box = $('#img-chips');
    if (!box) return;
    box.innerHTML = '';
    chatImgs().forEach((u, i) => {
      const chip = document.createElement('span');
      chip.className = 'img-chip';
      const im = document.createElement('img');
      im.src = u;
      const x = document.createElement('span');
      x.className = 'img-chip-x';
      x.textContent = '✕';
      x.onclick = () => { chatImgs().splice(i, 1); renderChips(); };
      chip.appendChild(im);
      chip.appendChild(x);
      box.appendChild(chip);
    });
  }

  async function attachFiles(files) {
    const list = [...files].filter((f) => /image\//.test(f.type)).slice(0, 4);
    for (const f of list) {
      try {
        const d = await window.ShihaiInteract.fileToDataURL(f, 1024);
        chatImgs().push(d);
      } catch (e) { APP.toast('⚠ 图片附加失败'); }
    }
    renderChips();
    if (list.length) APP.toast('📎 已附加 ' + list.length + ' 张图片，随下一条消息发送');
  }

  function attachSelected() {
    const id = APP.getSelId();
    const imgs = window.ShihaiInteract.getImages();
    if (!id || !imgs[id]) return APP.toast('请先选中一个图片节点');
    chatImgs().push(imgs[id]);
    renderChips();
    APP.toast('📎 已附加选中节点的图片');
  }

  /* ================= 「回答存为节点」 ================= */
  function saveReplyToNode(text) {
    const nodes = APP.getNodes();
    const sel = APP.getSelId();
    const pid = (sel && nodes[sel]) ? sel : APP.getRootId();
    const ids = APP.addChildrenTo(pid, [String(text).slice(0, 40) || 'AI 回答']);
    if (ids && ids[0]) {
      const n = nodes[ids[0]];
      n.note = String(text).slice(0, 2000);
      n.color = 'model';
      APP.render();
      window.ShihaiInteract.redrawEdges();
      APP.save();
      APP.toast('✅ 回答已存为节点（完整内容在备注里）');
    }
  }

  // 监听 AI 气泡生成（ui.js 动态 append），给回答气泡加「存为节点」按钮
  function watchBubbles() {
    const log = $('#ai-log');
    if (!log) return;
    const mo = new MutationObserver((muts) => {
      muts.forEach((m) => {
        m.addedNodes.forEach((nd) => {
          if (nd.nodeType !== 1 || !nd.classList || !nd.classList.contains('msg')) return;
          const bubble = nd.querySelector('.bubble');
          if (!bubble || nd.classList.contains('user') || bubble.querySelector('.to-node-btn')) return;
          const btn = document.createElement('button');
          btn.className = 'to-node-btn';
          btn.textContent = '⬇ 存为节点';
          btn.onclick = () => saveReplyToNode(bubble.innerText.replace(/⬇ 存为节点$/, '').trim());
          bubble.appendChild(btn);
        });
      });
    });
    mo.observe(log, { childList: true });
  }

  /* ================= 启动 ================= */
  function boot() {
    APP = window.ShihaiApp;
    if (!APP) return;

    // 禁缩放/禁平移劫持区域（借鉴 data-canvas-no-zoom）
    document.querySelectorAll(
      '#topbar, #info-panel, #ai-panel, #minimap, #modal-mask, #settings-modal, #history-modal, ' +
      '#roundtable-modal, #help-modal, #gen-modal, #io-modal, #legend, #toast'
    ).forEach((el) => el.setAttribute('data-canvas-no-zoom', ''));

    const bind = (id, fn) => { const el = $(id); if (el) el.onclick = fn; };
    bind('#btn-gen', openGen);
    bind('#gen-close', closeMine);
    bind('#gen-run', generateImage);
    bind('#btn-io', () => { renderIO(); openModal('#io-modal'); });
    bind('#io-close', closeMine);
    bind('#io-refresh', renderIO);

    // 参考图上传/清除
    const refFile = $('#gen-ref-file');
    bind('#gen-ref-pick', () => refFile && refFile.click());
    if (refFile) refFile.onchange = async () => {
      if (!refFile.files.length) return;
      try {
        const d = await window.ShihaiInteract.fileToDataURL(refFile.files[0], 1024);
        const img = $('#gen-ref-img');
        img.src = d; img.style.display = 'block';
        $('#gen-ref-empty').style.display = 'none';
      } catch (e) { APP.toast('⚠ 参考图读取失败'); }
      refFile.value = '';
    };
    bind('#gen-ref-clear', () => {
      const img = $('#gen-ref-img');
      img.removeAttribute('src'); img.style.display = 'none';
      $('#gen-ref-empty').style.display = 'block';
    });

    // 📎 随聊附图
    const attFile = $('#file-attach');
    bind('#btn-attach', () => attFile && attFile.click());
    if (attFile) attFile.onchange = () => { attachFiles(attFile.files); attFile.value = ''; };
    bind('#btn-attach-sel', attachSelected);

    watchBubbles();
    renderChips();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(boot, 50));
  } else {
    setTimeout(boot, 50);
  }
})();
