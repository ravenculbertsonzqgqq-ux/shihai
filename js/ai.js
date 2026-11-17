/* ============================================================
   识海 · AI 模块 —— 自定义 OpenAI 兼容 API 集成
   默认：https://apihub.agnes-ai.com/v1 ｜ agnes-2.5-flash
   ============================================================ */
(function () {
  'use strict';

  const LS_KEY = 'shihai.ai.v1';
  // ⚠ 公开部署时此处的 Key 会暴露在网页源码中 —— 请使用限额 Key，并可随时在「⚙ AI 设置」中更换
  const DEFAULTS = {
    baseUrl: 'https://apihub.agnes-ai.com/v1',
    model: 'agnes-2.5-flash',
    apiKey: 'sk-PTEVeMdrAzWJRDn0IHBY8h0mnkKQoESoi6suC2BvAOrKMxiF',
    temperature: 0.7
  };

  function getSettings() {
    try {
      return Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem(LS_KEY) || '{}'));
    } catch (e) { return Object.assign({}, DEFAULTS); }
  }

  function saveSettings(s) {
    localStorage.setItem(LS_KEY, JSON.stringify(s));
    return s;
  }

  async function callChat(messages, opts) {
    const s = getSettings();
    opts = opts || {};
    if (!s.apiKey) throw new Error('未配置 API Key：点右上角「⚙ AI 设置」填写');
    const url = s.baseUrl.replace(/\/+$/, '') + '/chat/completions';
    const body = {
      model: s.model,
      temperature: opts.temperature != null ? opts.temperature : s.temperature,
      messages
    };
    if (opts.maxTokens) body.max_tokens = opts.maxTokens;
    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + s.apiKey
        },
        body: JSON.stringify(body)
      });
    } catch (e) {
      throw new Error('网络/CORS 错误：' + e.message + '（若跨域被拦截，请用支持 CORS 的端点）');
    }
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      throw new Error('API 错误 HTTP ' + res.status + '：' + t.slice(0, 180));
    }
    const data = await res.json();
    const content = data && data.choices && data.choices[0] && data.choices[0].message
      ? data.choices[0].message.content : '';
    return (content || '').trim();
  }

  /* ---------- 从模型输出稳健地抽出 JSON 数组 ---------- */
  function extractList(text) {
    if (!text) return [];
    // 去掉代码围栏
    let t = text.replace(/```(?:json)?/gi, '');
    const m = t.match(/\[[\s\S]*\]/);
    if (m) {
      try {
        const arr = JSON.parse(m[0]);
        if (Array.isArray(arr)) {
          return arr.map((x) => (typeof x === 'string' ? x : (x && (x.text || x.title || x.name)) || '')).filter(Boolean);
        }
      } catch (e) { /* 继续走行拆分 */ }
    }
    // 兜底：按行/序号拆
    return t.split(/\n+/)
      .map((l) => l.replace(/^[\s\-\*\d\.、\)）]+/, '').replace(/^["'「]|["'」]$/g, '').trim())
      .filter((l) => l && l.length < 80);
  }

  /* ---------- AI 扩展节点（生成子要点） ---------- */
  async function expandNode(nodeId, ctx) {
    const nodes = ctx.getNodes();
    const node = nodes[nodeId];
    if (!node) return;
    const path = ctx.getPath(nodeId).join(' → ');
    if (!getSettings().apiKey) {
      ctx.toast('请先在「⚙ AI 设置」中配置 API Key');
      if (window.ShihaiUI && window.ShihaiUI.openSettings) window.ShihaiUI.openSettings();
      return;
    }
    ctx.toast('✨ AI 正在扩展「' + node.text.slice(0, 12) + '」…');
    try {
      const out = await callChat([
        {
          role: 'system',
          content:
            '你是思维导图扩展助手，帮助用户以系统、有条理、分层的方式发散思考。' +
            '只输出一个 JSON 数组字符串，包含 3 到 6 个子要点；每条不超过 22 个字，' +
            '要求精炼、并列、层级清晰、彼此不重复。不要输出任何 JSON 之外的文字。'
        },
        {
          role: 'user',
          content:
            '思维导图祖先链：' + path + '\n' +
            '当前节点主题：' + node.text + '\n' +
            (node.note ? '当前节点说明：' + node.note.slice(0, 200) + '\n' : '') +
            '请为「当前节点」生成 3~6 个子要点（JSON 字符串数组）。'
        }
      ], { temperature: 0.8, maxTokens: 400 });

      const items = extractList(out).slice(0, 8);
      if (!items.length) throw new Error('模型未返回有效要点');
      ctx.addChildrenTo(nodeId, items);
      ctx.toast('✨ 已生成 ' + items.length + ' 个子节点');
    } catch (e) {
      ctx.toast('AI 扩展失败：' + e.message);
    }
  }

  /* ---------- AI 对话（带节点上下文） ---------- */
  const chatLog = [];
  async function chatOnce(userText, ctx) {
    const s = getSettings();
    if (!s.apiKey) {
      if (window.ShihaiUI && window.ShihaiUI.openSettings) window.ShihaiUI.openSettings();
      throw new Error('未配置 API Key');
    }
    const sel = ctx.getSelected();
    const sys =
      '你是「识海」内置思考助手，服务于一套人生思考决策系统（内核公理：真实优先、概率思维、生存第一、' +
      '复利与反馈、机会成本、二阶思维、约束与杠杆）。回答要系统、有条理、精炼，必要时给出可执行的下一步。';
    const msgs = [{ role: 'system', content: sys }];
    if (sel) {
      msgs.push({
        role: 'system',
        content: '当前用户选中的思维导图节点：「' + sel.text + '」' + (sel.note ? '（说明：' + sel.note.slice(0, 200) + '）' : '')
      });
    }
    chatLog.forEach((m) => msgs.push(m));
    msgs.push({ role: 'user', content: userText });
    const reply = await callChat(msgs, { temperature: 0.7, maxTokens: 900 });
    chatLog.push({ role: 'user', content: userText });
    chatLog.push({ role: 'assistant', content: reply });
    if (chatLog.length > 20) chatLog.splice(0, chatLog.length - 20);
    return reply;
  }

  window.ShihaiAI = {
    getSettings, saveSettings, callChat, expandNode, chatOnce,
    DEFAULTS
  };
})();
