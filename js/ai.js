/* ============================================================
   识海 · AI 模块 v2 —— 自定义 OpenAI 兼容 API
   ① 记忆上下文索引：把思维导图作为长期记忆，自动检索注入
   ② 图谱操控指令：AI 通过结构化命令直接编辑思维导图
   默认：https://apihub.agnes-ai.com/v1 ｜ agnes-2.5-flash
   ============================================================ */
(function () {
  'use strict';

  const LS_KEY = 'shihai.ai.v1';
  // ⚠ 公开部署时此处的 Key 会暴露在网页源码中 —— 请使用限额 Key，可随时在「⚙ AI 设置」中更换
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
    const t0 = Date.now();
    const ioLog = (window.__shihaiIOLog = window.__shihaiIOLog || []);
    const ioEntry = { t: t0, kind: 'chat', model: body.model, messages, reply: '', usage: null, ms: 0, error: '' };
    const pushIO = () => {
      ioEntry.ms = Date.now() - t0;
      ioLog.push(ioEntry);
      if (ioLog.length > 30) ioLog.shift();
      if (window.__shihaiIOUpdate) window.__shihaiIOUpdate();
    };
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
      ioEntry.error = '网络/CORS 错误：' + e.message;
      pushIO();
      throw new Error('网络/CORS 错误：' + e.message + '（请检查端点是否支持浏览器跨域）');
    }
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      ioEntry.error = 'HTTP ' + res.status + '：' + t.slice(0, 180);
      pushIO();
      throw new Error('API 错误 HTTP ' + res.status + '：' + t.slice(0, 180));
    }
    const data = await res.json();
    const content = data && data.choices && data.choices[0] && data.choices[0].message
      ? data.choices[0].message.content : '';
    ioEntry.reply = (content || '').trim();
    ioEntry.usage = data && data.usage ? data.usage : null;
    pushIO();
    return (content || '').trim();
  }

  /* ============================================================
     ① 记忆上下文索引 —— 图谱即记忆
     用查询词对全部节点（标题/说明/路径）打分检索，注入对话上下文
     ============================================================ */
  function tokenize(q) {
    const tokens = [];
    const ascii = q.toLowerCase().match(/[a-z0-9]+/g) || [];
    tokens.push(...ascii);
    // CJK 二元组
    const cjk = q.replace(/[^\u4e00-\u9fff]/g, '');
    for (let i = 0; i < cjk.length - 1; i++) tokens.push(cjk.slice(i, i + 2));
    if (cjk.length === 1) tokens.push(cjk);
    return [...new Set(tokens)].filter((t) => t.length > 1 || /[\u4e00-\u9fff]/.test(t));
  }

  function retrieveContext(query, ctx, topN) {
    topN = topN || 8;
    const nodes = ctx.getNodes();
    const tokens = tokenize(query || '');
    if (!tokens.length) return [];
    const rootId = ctx.getRootId();
    const scored = [];
    for (const id of Object.keys(nodes)) {
      const n = nodes[id];
      const text = n.text.toLowerCase();
      const note = (n.note || '').toLowerCase();
      let score = 0;
      for (const t of tokens) {
        if (text.includes(t)) score += 3;
        if (note.includes(t)) score += 1.2;
        // 祖先路径加分（主题归属）
        let p = n.parent;
        while (p) {
          if ((nodes[p].text || '').toLowerCase().includes(t)) { score += 0.5; break; }
          p = nodes[p].parent;
        }
      }
      if (score > 0) scored.push({ id, score, n });
    }
    scored.sort((a, b) => b.score - a.score);
    // 去掉被更高分祖先覆盖的重复
    const picked = [];
    const pickedIds = new Set();
    for (const s of scored) {
      if (picked.length >= topN) break;
      if (pickedIds.has(s.id)) continue;
      picked.push(s);
      pickedIds.add(s.id);
    }
    return picked.map((s) => ({
      id: s.id,
      path: ctx.getPath(s.id).join(' › '),
      text: s.n.text,
      note: (s.n.note || '').slice(0, 120)
    }));
  }

  function formatMemory(hits) {
    if (!hits.length) return '';
    return '【识海记忆索引 · 图谱相关节点】\n' +
      hits.map((h, i) =>
        `${i + 1}. [${h.id}] ${h.path}` +
        (h.note ? `\n   说明：${h.note}` : '')
      ).join('\n') +
      '\n（以上是从用户思维导图记忆库中检索到的相关内容，可引用；引用时给出节点路径。）';
  }

  /* ============================================================
     ② 图谱操控指令协议
     AI 在回复后附加 ```shihai 代码块，内为 JSON 命令
     ============================================================ */
  const CMD_SPEC =
    '你可以操控用户的思维导图。需要编辑图谱时，在文字回答之后附加一个 ```shihai 代码块，' +
    '内容为 JSON（单个对象或数组，可多条命令）：\n' +
    '{"cmd":"add","target":"节点id或标题关键词","items":["要点1","要点2"]}  // 给目标节点添加子节点\n' +
    '{"cmd":"select","target":"..."}        // 选中并聚焦节点\n' +
    '{"cmd":"rename","target":"...","text":"新标题"}\n' +
    '{"cmd":"note","target":"...","text":"说明文字"}\n' +
    '{"cmd":"delete","target":"..."}        // 删除节点\n' +
    '{"cmd":"color","target":"...","color":"axiom|cog|value|decide|solve|exec|review|model|scene|anti|life|method|war|east|west|book"}\n' +
    '{"cmd":"link","target":"...","to":"..."}   // 建立联想连接\n' +
    '{"cmd":"collapse","target":"..."} 或 {"cmd":"uncollapse","target":"..."}\n' +
    '{"cmd":"layout"}    // 重新整理布局\n' +
    '{"cmd":"search","query":"..."}   // 高亮搜索\n' +
    'target 可用节点 id（记忆索引里有 [id]）或标题关键词，省略则作用于当前选中节点。';

  function extractCommands(reply) {
    const cmds = [];
    const re = /```shihai\s*([\s\S]*?)```/g;
    let m;
    while ((m = re.exec(reply)) !== null) {
      try {
        let raw = m[1].trim();
        // 容错：截取第一个 { 或 [ 到最后一个 } 或 ]
        const s1 = raw.search(/[{[]/);
        const e1 = Math.max(raw.lastIndexOf('}'), raw.lastIndexOf(']'));
        if (s1 >= 0 && e1 > s1) raw = raw.slice(s1, e1 + 1);
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) cmds.push(...parsed);
        else if (parsed && parsed.cmd) cmds.push(parsed);
        else if (parsed && Array.isArray(parsed.cmds)) cmds.push(...parsed.cmds);
      } catch (e) { /* 解析失败跳过该块 */ }
    }
    return cmds.filter((c) => c && c.cmd);
  }

  function stripCommands(reply) {
    return reply.replace(/```shihai\s*[\s\S]*?```/g, '').trim();
  }

  /* 执行命令（在 ui.js 中调用），返回执行结果描述数组 */
  function executeCommands(cmds, ctx) {
    const results = [];
    for (const c of cmds) {
      try {
        const target = c.target ? (ctx.findNode(c.target) || ctx.getSelected()) : ctx.getSelected();
        switch (c.cmd) {
          case 'add': {
            const t = target || ctx.findNode(ctx.getRootId());
            if (!t) { results.push({ ok: false, msg: '找不到目标节点' }); break; }
            const items = (Array.isArray(c.items) ? c.items : [c.text]).filter(Boolean).map(String);
            if (!items.length) { results.push({ ok: false, msg: 'add 缺少 items' }); break; }
            const ids = ctx.addChildrenTo(t.id, items);
            results.push({ ok: true, msg: `✅ 已在「${t.text}」下添加 ${ids.length} 个子节点` });
            break;
          }
          case 'select': {
            if (!target) { results.push({ ok: false, msg: '找不到节点' }); break; }
            ctx.selectNode(target.id);
            ctx.centerOn(target.id, 0.55);
            results.push({ ok: true, msg: `🎯 已聚焦「${target.text}」` });
            break;
          }
          case 'rename': {
            if (!target || !c.text) { results.push({ ok: false, msg: 'rename 参数不足' }); break; }
            ctx.renameNode(target.id, c.text);
            results.push({ ok: true, msg: `✏️ 已改名为「${c.text}」` });
            break;
          }
          case 'note': {
            if (!target) { results.push({ ok: false, msg: '找不到节点' }); break; }
            ctx.setNote(target.id, c.text || '');
            results.push({ ok: true, msg: `📝 已更新「${target.text}」的说明` });
            break;
          }
          case 'delete': {
            if (!target) { results.push({ ok: false, msg: '找不到节点' }); break; }
            if (target.id === ctx.getRootId()) { results.push({ ok: false, msg: '根节点不可删' }); break; }
            const name = target.text;
            ctx.deleteById(target.id);
            results.push({ ok: true, msg: `🗑 已删除「${name}」` });
            break;
          }
          case 'color': {
            if (!target || !c.color) { results.push({ ok: false, msg: 'color 参数不足' }); break; }
            ctx.setColor(target.id, c.color);
            results.push({ ok: true, msg: `🎨 已给「${target.text}」上色（${c.color}）` });
            break;
          }
          case 'link': {
            const to = c.to ? ctx.findNode(c.to) : null;
            if (!target || !to) { results.push({ ok: false, msg: 'link 需要 target 与 to' }); break; }
            ctx.addLink(target.id, to.id);
            results.push({ ok: true, msg: `🔗 已连接「${target.text}」→「${to.text}」` });
            break;
          }
          case 'collapse': case 'uncollapse': {
            if (!target) { results.push({ ok: false, msg: '找不到节点' }); break; }
            ctx.setCollapsed(target.id, c.cmd === 'collapse');
            results.push({ ok: true, msg: `${c.cmd === 'collapse' ? '📁 折叠' : '📂 展开'}「${target.text}」` });
            break;
          }
          case 'layout': {
            ctx.layout(); ctx.render(); ctx.save();
            results.push({ ok: true, msg: '✦ 已重新整理布局' });
            break;
          }
          case 'search': {
            const hits = ctx.search(c.query || '');
            results.push({ ok: true, msg: `🔍 搜索「${c.query}」命中 ${hits.length} 处` });
            break;
          }
          default:
            results.push({ ok: false, msg: '未知指令：' + c.cmd });
        }
      } catch (e) {
        results.push({ ok: false, msg: '执行出错：' + e.message });
      }
    }
    return results;
  }

  /* ============================================================
     对话主入口：记忆注入 + 操控协议
     ============================================================ */
  const chatLog = [];

  async function chatOnce(userText, ctx, advisorId) {
    const s = getSettings();
    if (!s.apiKey) {
      if (window.ShihaiUI && window.ShihaiUI.openSettings) window.ShihaiUI.openSettings();
      throw new Error('未配置 API Key');
    }
    const sel = ctx.getSelected();
    const hits = retrieveContext(userText, ctx, 8);
    const mapOverview = (() => {
      const nodes = ctx.getNodes();
      const root = nodes[ctx.getRootId()];
      return '当前图谱「' + root.text + '」共 ' + ctx.nodeCount() + ' 个节点，一级分支：' +
        root.children.map((c) => nodes[c].text).join('、');
    })();

    // 顾问团模式：代入思想家角色设定
    const advisor = advisorId
      ? (window.SHIHAI_ADVISORS || []).find((a) => a.id === advisorId)
      : null;
    const baseSystem = advisor
      ? `你是「识海思想家顾问团」成员——${advisor.name_zh}（${advisor.era}，${advisor.domain_zh}）。\n` +
        `你的角色设定（必须严格以这位思想家的学说、认知偏好、原理与思维方式作答）：\n${advisor.prompt}\n` +
        `要求：用中文回答；始终保持该思想家的视角与方法论；可以适当引用其核心概念；` +
        `如该思想家会质疑问题本身（如苏格拉底），就大胆质疑。必要时也可给出图谱指令。`
      : '你是「识海」内置思考助手。识海是一张神经元风格的思维导图，也是用户的长期记忆库与思考决策系统' +
        '（内核公理：真实优先、概率思维、生存第一、复利与反馈、机会成本、二阶思维、约束与杠杆）。' +
        '回答要求：系统、有条理、精炼，必要时给可执行的下一步。' +
        '优先利用【识海记忆索引】中检索到的图谱内容作答，帮助提问者；与图谱冲突时如实指出。';

    const msgs = [{
      role: 'system',
      content: baseSystem + '\n\n' + mapOverview + '\n\n' + CMD_SPEC
    }];
    if (hits.length) msgs.push({ role: 'system', content: formatMemory(hits) });
    if (sel) {
      msgs.push({
        role: 'system',
        content: '当前选中节点：[' + sel.id + ']「' + sel.text + '」' + (sel.note ? '（说明：' + sel.note.slice(0, 150) + '）' : '')
      });
    }
    chatLog.slice(-10).forEach((m) => msgs.push(m));
    // 图片输入（多模态）：若 AI 输入区附加了图片，组装为 image_url 内容块
    const chatImgs = (window.__shihaiChatImages || []).slice();
    window.__shihaiChatImages = [];
    if (chatImgs.length) {
      const parts = [{ type: 'text', text: userText }];
      chatImgs.forEach((u) => parts.push({ type: 'image_url', image_url: { url: u } }));
      msgs.push({ role: 'user', content: parts });
    } else {
      msgs.push({ role: 'user', content: userText });
    }

    const reply = await callChat(msgs, { temperature: 0.7, maxTokens: 1200 });
    chatLog.push({ role: 'user', content: userText });
    chatLog.push({ role: 'assistant', content: reply });
    if (chatLog.length > 20) chatLog.splice(0, chatLog.length - 20);

    // 解析并执行图谱指令
    const cmds = extractCommands(reply);
    const cleanReply = stripCommands(reply) || '(已执行图谱操作)';
    const cmdResults = cmds.length ? executeCommands(cmds, ctx) : [];
    return { reply: cleanReply, cmdResults, memoryHits: hits, advisor: advisor ? advisor.name_zh : null };
  }

  /* ---------- 从模型输出稳健地抽出 JSON 数组（AI 扩展用） ---------- */
  function extractList(text) {
    if (!text) return [];
    let t = text.replace(/```(?:json)?/gi, '');
    const m = t.match(/\[[\s\S]*\]/);
    if (m) {
      try {
        const arr = JSON.parse(m[0]);
        if (Array.isArray(arr)) {
          return arr.map((x) => (typeof x === 'string' ? x : (x && (x.text || x.title || x.name)) || '')).filter(Boolean);
        }
      } catch (e) { /* 兜底 */ }
    }
    return t.split(/\n+/)
      .map((l) => l.replace(/^[\s\-\*\d\.、\)）]+/, '').replace(/^["'「]|["'」]$/g, '').trim())
      .filter((l) => l && l.length < 80);
  }

  /* ---------- ✨ 一键 AI 扩展节点 ---------- */
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
            '精炼、并列、层级清晰、彼此不重复。不要输出任何 JSON 之外的文字。'
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
      ctx.toast('✨ 已生成 ' + items.length + ' 个子节点（可撤销）');
    } catch (e) {
      ctx.toast('AI 扩展失败：' + e.message);
    }
  }

  /* ============================================================
     圆桌会议：多 Agent 并行+合并（辩论模式）
     ============================================================ */
  async function roundtable(question, advisorIds, ctx) {
    const s = getSettings();
    if (!s.apiKey) throw new Error('未配置 API Key');
    const hits = retrieveContext(question, ctx, 6);
    const mem = formatMemory(hits);
    const advisors = advisorIds
      .map((id) => (window.SHIHAI_ADVISORS || []).find((a) => a.id === id))
      .filter(Boolean);
    const panels = await Promise.all(advisors.map(async (a) => {
      const msgs = [
        {
          role: 'system',
          content:
            `你是「识海思想家顾问团」圆桌成员——${a.name_zh}（${a.era}，${a.domain_zh}）。\n` +
            `角色设定：${a.prompt}\n` +
            '要求：用中文以该思想家的学说视角简明作答（150 字以内），直陈观点、可与其他观点交锋。'
        },
        ...(mem ? [{ role: 'system', content: mem }] : []),
        { role: 'user', content: question }
      ];
      try {
        const reply = await callChat(msgs, { temperature: 0.8, maxTokens: 500 });
        return { name: a.name_zh, era: a.era, reply: (reply || '').trim() };
      } catch (e) {
        return { name: a.name_zh, era: a.era, reply: '（该顾问应答失败：' + e.message + '）' };
      }
    }));
    let synthesis = '';
    try {
      synthesis = (await callChat([
        {
          role: 'system',
          content: '你是圆桌主持人。综合各位思想家观点：① 提炼共识 ② 点明分歧 ③ 给出可执行结论。中文，条理清晰，200 字以内。'
        },
        {
          role: 'user',
          content: '议题：' + question + '\n\n' + panels.map((p) => `【${p.name}】${p.reply}`).join('\n\n')
        }
      ], { temperature: 0.5, maxTokens: 700 })).trim();
    } catch (e) {
      synthesis = '（综合失败：' + e.message + '）';
    }
    return { panels, synthesis, memoryHits: hits };
  }

  /* ============================================================
     深度反思（Reflexion）：初稿 → 批评 → 修订
     ============================================================ */
  async function critique(question, draft, ctx) {
    return (await callChat([
      {
        role: 'system',
        content: '你是苛刻的评审。指出回答的 3 个具体不足（事实/逻辑/可执行性），每条一句话，只输出不足清单。'
      },
      { role: 'user', content: '问题：' + question + '\n\n回答初稿：' + draft }
    ], { temperature: 0.5, maxTokens: 400 })).trim();
  }

  async function revise(question, draft, crit, ctx) {
    return (await callChat([
      {
        role: 'system',
        content: '根据批评意见修订回答，输出最终版（中文，保留优点，补足缺陷，条理清晰）。只输出修订后的回答。'
      },
      { role: 'user', content: '问题：' + question + '\n\n初稿：' + draft + '\n\n批评意见：' + crit }
    ], { temperature: 0.5, maxTokens: 900 })).trim();
  }

  window.ShihaiAI = {
    getSettings, saveSettings, callChat, expandNode, chatOnce,
    retrieveContext, extractCommands, executeCommands,
    roundtable, critique, revise, DEFAULTS
  };
})();
