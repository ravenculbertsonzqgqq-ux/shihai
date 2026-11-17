/* ============================================================
   识海 · AI 工程板块（v4）
   ㉑ 提示词工程 ｜ ㉒ 多 Agent 协作 ｜ ㉓ AI Agent 工程
   依据 2026 业界实践调研：ReAct / Reflexion / Plan-and-Execute /
   多 Agent 三拓扑 / Agentic RAG / Skills / 循环工程 / MCP·A2A
   ============================================================ */
window.SHIHAI_EXTENSIONS = (window.SHIHAI_EXTENSIONS || []).concat([

  /* ═══════════ ㉑ 提示词工程 ═══════════ */
  { parent: 'root', children: [
    {
      id: 'prompt', text: '㉑ 提示词工程 · Prompt Engineering', color: 'method',
      note: '提示词是自然语言编程：结构决定输出质量。好的提示词 = 角色 + 任务 + 上下文 + 示例 + 格式 + 约束。',
      children: [
        {
          id: 'pr-anatomy', text: '提示词解剖 · 六大构件',
          children: [
            { text: '角色设定：你是谁、什么风格', note: '角色决定视角与知识激活范围；越具体越好（「资深风控官」＞「专家」）' },
            { text: '任务定义：动词+对象+目标', note: '「分析…给出…以达成…」；一个提示一个主任务' },
            { text: '上下文注入：背景与资料', note: '相关信息前置；长资料分段标注来源；关键信息放首尾（Lost in the Middle）' },
            { text: '示例示范（Few-shot）', note: '2-5 个输入输出对；示例质量＞数量；覆盖边界情况' },
            { text: '输出格式：结构化约束', note: 'JSON Schema / Markdown / 表格；先给格式模板再填内容' },
            { text: '约束与护栏：不做什么', note: '长度限制、禁止编造、不确定就说不知道；负面约束要具体' }
          ]
        },
        {
          id: 'pr-structure', text: '结构化技巧',
          children: [
            { text: 'XML 标签分段：<context><rules>', note: '标签边界让模型清晰区分指令与资料，抗注入' },
            { text: 'Markdown 层次：标题/列表/表格', note: '结构化输入促结构化输出' },
            { text: '输出 Schema：先定型后填值', note: '要求 JSON 时给出字段定义与示例值' },
            { text: '指令层级：系统＞开发者＞用户', note: '高优先级指令写在系统提示；引用外部文本用标签包裹' },
            { text: '模板变量：{{topic}} 占位', note: '提示词工程化管理，版本化' },
            { text: '预填（Prefill）：给模型开头', note: '预填「好的，分析如下：」锁定输出格式' }
          ]
        },
        {
          id: 'pr-cot', text: '思维链家族（CoT）',
          children: [
            { text: 'CoT 逐步推理：写中间步骤', note: '「让我们逐步思考」；数学/逻辑/多跳推理显著提升' },
            { text: 'Zero-shot CoT：一句话激活', note: '「Let\'s think step by step」无需示例' },
            { text: 'Self-Consistency：多路投票', note: '采样多条推理路径取多数答案，抗单次失误' },
            { text: 'ToT 思维树：分支+评估+回溯', note: '复杂问题生成候选步骤，评估后择优扩展' },
            { text: 'PoT 程序思维：写代码求解', note: '计算/符号问题让模型写程序执行结果' },
            { text: '结构化推理：MECE+假设检验', note: '先列假设再逐条验证，输出推理账本' }
          ]
        },
        {
          id: 'pr-agentic', text: 'Agentic 提示模式',
          children: [
            { text: 'ReAct：思考→行动→观察循环', note: '开放探索任务的默认模式；推理轨迹可调试' },
            { text: 'Reflexion：自我批评→修订', note: '生成→评审→改进，限 2-3 轮防成本失控' },
            { text: 'Plan-and-Execute：先规划后执行', note: '步骤可预列时用；顶层规划+每步 ReAct 最稳' },
            { text: 'Self-Ask：自动分解子问题', note: '「要回答这个，我需要先知道…」' },
            { text: '元提示词（Meta-Prompting）', note: '让模型先写提示词再执行；优化提示的提示' }
          ]
        },
        {
          id: 'pr-opt', text: '优化与评测工程',
          children: [
            { text: '迭代改写：失败案例驱动', note: '收集坏输出→归因→改提示→回归测试' },
            { text: '黄金集+回归测试', note: '固定 20-50 个典型输入，每次改提示跑一遍' },
            { text: 'LLM-as-Judge：模型当裁判', note: '用强模型按评分卡为弱模型输出打分' },
            { text: 'A/B 提示测试', note: '两版提示同题对比，用数据选' },
            { text: '提示词版本管理', note: '提示词=代码：命名、版本、变更记录、回滚' }
          ]
        },
        {
          id: 'pr-safety', text: '防御与安全',
          children: [
            { text: '提示注入防御', note: '用户内容用标签包裹；指令隔离；「忽略以上指令」类攻击识别' },
            { text: '最小权限原则', note: '工具按需授权；敏感操作加确认（HITL）' },
            { text: '输出过滤与校验', note: 'Schema 校验、敏感词、PII 脱敏后再展示' },
            { text: '越狱防护', note: '角色扮演类越狱检测；系统提示不回显' }
          ]
        }
      ]
    },

    /* ═══════════ ㉒ 多 Agent 协作 ═══════════ */
    {
      id: 'multi', text: '㉒ 多 Agent 协作 · Multi-Agent', color: 'war',
      note: 'Anthropic 研究：多 Agent 系统在并行探索型任务上比单 Agent 提升 90.2%，但 token 消耗约 15 倍——用对场景才值得。',
      children: [
        {
          id: 'mu-topo', text: '三大基础拓扑',
          children: [
            { text: '流水线：A→B→C 顺序传递', note: '步骤有依赖时用；上游质量决定下游上限' },
            { text: '主管+专家：协调者分派整合', note: '复杂任务+质量控制；主管不干活只编排' },
            { text: '并行+合并：独立子任务同时跑', note: '子任务互不读写即可并行；>3 路并行需协调者防冲突' }
          ]
        },
        {
          id: 'mu-pattern', text: '经典协作模式',
          children: [
            { text: '辩论模式：多视角交锋出真知', note: '正反双方辩论+裁判总结；对抗性盲区（识海圆桌即此模式）' },
            { text: '投票共识：多路答案取多数', note: 'Self-Consistency 的多 Agent 版' },
            { text: '黑板模式：共享状态协同', note: '所有 Agent 读写同一全局状态；防幻觉循环要状态更新' },
            { text: '批评者-执行者（Critic-Worker）', note: '工人报「完成」，批评者验证是否真达成；共享全局真相' },
            { text: '分层组织：主管→子主管→工人', note: '超大任务分治；层级深则通信开销大' },
            { text: '市场/拍卖：竞标领任务', note: '按能力与成本动态分配；适合异构 Agent 池' }
          ]
        },
        {
          id: 'mu-role', text: '角色设计',
          children: [
            { text: '规划者：拆解任务定路线' },
            { text: '执行者：调工具干实事' },
            { text: '批评者：按标准挑毛病' },
            { text: '研究者：检索收集证据' },
            { text: '总结者：聚合提炼结论' },
            { text: '裁判：终审与裁决分歧' },
            { text: '角色清晰三要素：职责/输入/交付物', note: '角色重叠=推诿；职责空白=漏项' }
          ]
        },
        {
          id: 'mu-comm', text: '状态与通信协议',
          children: [
            { text: '消息传递：结构化消息+会话线程' },
            { text: 'Handoff 交接：A 把控制权交给 B' },
            { text: '全局状态黑板：进度+事实+版本', note: '无进度跟踪 → 幻觉循环：重复步骤、丢失目标、假完成' },
            { text: 'MCP 模型上下文协议', note: '工具与数据源的标准化接入（类 USB-C）' },
            { text: 'A2A 代理互操作协议', note: 'Agent 间发现、协商、协作的开放标准' }
          ]
        },
        {
          id: 'mu-frame', text: '框架生态',
          children: [
            { text: 'LangGraph：状态图+循环+检查点', note: '需要状态机/条件分支时首选' },
            { text: 'AutoGen：对话式多 Agent 编排' },
            { text: 'CrewAI：角色团队高层抽象' },
            { text: 'OpenAI Agents SDK：轻量编排层' },
            { text: '选型：有状态复杂流→LangGraph；角色扮演→CrewAI；代码协作→AutoGen' }
          ]
        },
        {
          id: 'mu-rely', text: '可靠性与成本工程',
          children: [
            { text: '硬停止条件+最大步数', note: '生产失败首因：没有终止条件（步数 10-20 上限）' },
            { text: '幂等检测：同工具同参数两次即停' },
            { text: '检查点+断点恢复' },
            { text: '人在环（HITL）：高风险操作人审' },
            { text: '成本预算护栏：单任务 token 上限' },
            { text: '何时用多 Agent：并行探索/超单上下文；否则单 Agent+ReAct 起步' }
          ]
        }
      ]
    },

    /* ═══════════ ㉓ AI Agent 工程 ═══════════ */
    {
      id: 'agent', text: '㉓ AI Agent 工程 · Loop·Skills·RAG·长链', color: 'model',
      note: 'Agent = 模型 + 循环 + 工具 + 记忆。先单 Agent+ReAct 起步，撞到明确瓶颈再加复杂度。',
      children: [
        {
          id: 'ag-loop', text: 'Agent 核心循环',
          children: [
            { text: '感知→思考→行动→观察↻', note: 'while(目标未达成) { 思考; 行动; 观察; 更新状态 }' },
            { text: 'ReAct 是默认起点', note: '推理轨迹可调试；探索型任务首选（ALFWorld +34%）' },
            { text: '状态更新：每步对比原计划', note: '防止幻觉循环：重复步骤/丢失目标/假完成' },
            { text: '混合架构：顶层规划+步内 ReAct', note: '生产环境最稳：Plan-and-Execute 壳，ReAct 核' }
          ]
        },
        {
          id: 'ag-loopeng', text: '循环工程 · Loop Engineering',
          children: [
            { text: '硬停止条件：目标达成/步数/预算', note: '生产失败四因之首；无终止条件的循环必然失控' },
            { text: '最大步数 10-20 上限' },
            { text: '幂等检测与断路器', note: '同工具同参数调用两次 → 判定死循环强制跳出' },
            { text: '预算护栏：token/时间/金钱三维限额' },
            { text: '检查点：每步落盘，可恢复可审计' },
            { text: '双环控制：内环执行，外环战略重置', note: '策略失效时外环推倒重来（OODA+元认知）' }
          ]
        },
        {
          id: 'ag-reflex', text: 'Reflexion 反思环',
          children: [
            { text: '生成→批评→修订↻（限 2-3 轮）', note: 'HumanEval 80%→91%；无上限则成本爆炸' },
            { text: '批评要按显式标准', note: '评分卡/测试用例/事实核查清单' },
            { text: '自我批评+外部验证双保险', note: '自己挑不出的毛病交给测试器/强模型' },
            { text: '记忆注入：上次教训写入下次', note: '失败批评存入记忆，下次尝试前回顾' }
          ]
        },
        {
          id: 'ag-skills', text: 'Skills 技能设计',
          children: [
            { text: '渐进披露：按需加载能力', note: 'SKILL.md/AGENTS.md：入口索引+详情延迟读取' },
            { text: '能力封装：一个技能一个明确契约', note: '输入/输出/前置条件/失败模式写清' },
            { text: '组合与复用：技能拼装成工作流' },
            { text: '命名空间：避免技能名冲突' },
            { text: '项目记忆文件：CLAUDE.md/AGENTS.md', note: '把项目约定写成 Agent 可读的常驻指令' }
          ]
        },
        {
          id: 'ag-rag', text: 'RAG 检索增强',
          children: [
            { text: '分块策略：语义分块＞固定长度', note: '保留上下文完整性；重叠窗口防截断' },
            { text: '混合检索：向量+关键词（BM25）' },
            { text: '重排序（Rerank）：粗排后精排' },
            { text: '引用溯源：答案标注来源', note: '可核查是信任的前提' },
            { text: 'Agentic RAG：循环内动态检索', note: '不是一次查完：边推理边决定查什么（识海记忆索引即此模式）' },
            { text: '检索评估：召回率/精确率/忠实度' },
            { text: '知识保鲜：定期更新+过期标注' }
          ]
        },
        {
          id: 'ag-mem', text: '长链与记忆管理',
          children: [
            { text: '滑窗+摘要：滚动压缩历史', note: '上下文溢出是长会话失败四因之一' },
            { text: 'Scratchpad 暂存：中间结果外置' },
            { text: '外部记忆库：向量库/文件/图谱', note: '识海图谱 = 结构化长期记忆' },
            { text: '关键信息前置：首尾效应' },
            { text: 'Lost in the Middle：中段信息易被忽略', note: '重要指令放开头或结尾' },
            { text: '上下文分层：系统/任务/资料/历史' }
          ]
        },
        {
          id: 'ag-tools', text: '工具使用与质量工程',
          children: [
            { text: 'Function Calling：Schema 先行', note: '工具描述=提示词：名称/参数/返回/示例/边界' },
            { text: '并行工具调用：独立调用同时发' },
            { text: '错误恢复：失败重试+备选路径' },
            { text: '评估集+回归测试：改动必跑' },
            { text: 'Trace 全链路追踪：每步可回放' },
            { text: '成本延迟预算：质量×速度×价格三角' }
          ]
        },
        {
          id: 'ag-shihai', text: '识海实践 · 本图谱即示范',
          children: [
            { text: '记忆索引 = Agentic RAG', note: '每次提问对 1300+ 节点检索打分注入上下文' },
            { text: '顾问团 = 多 Agent 角色池', note: '161 位思想家即 161 个带角色设定的 Agent' },
            { text: '圆桌会议 = 辩论模式', note: '3 顾问并行应答+主持人综合（并行+合并拓扑）' },
            { text: '图谱指令 = Tool Use', note: 'AI 通过结构化 JSON 指令操控画布' },
            { text: '历史快照 = 检查点工程', note: '每次改动可回滚，Agent 操作同样受审计' }
          ]
        }
      ]
    },

    /* ── 补充：NLP / TRIZ / 顾问团小延伸 ── */
    { parent: 'psy-change', children: [
      { text: 'SOLER 全身心倾听', note: '面向对方/开放姿态/身体前倾/目光接触/放松——倾听即疗愈' },
      { text: '动机光谱（Miller）', note: '从 0 到 10 打分：「为什么不是更低？」——引出自己的改变理由' }
    ]},
    { parent: 'triz-tools', children: [
      { text: 'Triz 与其他法联用：九屏幕+思维树+第一性', note: '九屏幕法打开时空维度，再用矛盾矩阵定点爆破' }
    ]},
    { parent: 'th-how', children: [
      { text: '圆桌实操：3 位顾问+主持人综合', note: '用「🪑 圆桌会议」按钮：选 3 位不同领域思想家，看共识与分歧' }
    ]}
  ]}
]);
