/* ============================================================
   识海 · 图谱扩展层（迭代延伸）
   合并进默认图谱：{ parent: 父节点id, children: [新节点...] }
   ============================================================ */
window.SHIHAI_EXTENSIONS = [

  /* ── ① 公理：实战延伸 ── */
  { parent: 'ax', children: [
    { id: 'ax-link', text: '公理联动 · 典型组合', note: '多条公理联合使用的真实场景',
      children: [
        { text: '创业押注：3生存×7杠杆×6二阶' },
        { text: '择业比较：5机会成本×4复利' },
        { text: '投资配置：3杠铃×2概率×7约束' },
        { text: '争论判断：1真实×2概率' }
      ] }
  ]},
  { parent: 'ax1', children: [{ text: '实战：写下「我可能错，因为…」' }] },
  { parent: 'ax2', children: [{ text: '实战：判断记分卡（Brier 分数）' }] },
  { parent: 'ax3', children: [{ text: '实战：给自己写「永不」清单' }] },
  { parent: 'ax4', children: [{ text: '实战：复利日记（每天进步 1%）' }] },
  { parent: 'ax5', children: [{ text: '实战：日程机会成本审计' }] },
  { parent: 'ax6', children: [{ text: '实战：决策前写「二阶后果」' }] },
  { parent: 'ax7', children: [{ text: '实战：每周问「瓶颈在哪」' }] },

  /* ── ② 认知：结构化工具与偏差延伸 ── */
  { parent: 'cog', children: [
    { id: 'cog-more', text: '结构化与决策补充工具',
      children: [
        { text: '金字塔原理：结论先行，以上统下' },
        { text: 'MECE 检查：不重不漏的拆分' },
        { text: '5W2H：何事何因何时何地何人如何多少' },
        { text: '假设驱动：先立假设再验证' },
        { text: 'KT 决策法：界定-原因-方案-预防' },
        { text: '决策树：概率×收益分叉求期望' }
      ] }
  ]},
  { parent: 'cog-bias', children: [
    { text: '光环效应→分维度独立打分' },
    { text: '基本归因错误→情境归因三分' },
    { text: '框架效应→换表述再判断' },
    { text: '双曲贴现→给未来价值加权' }
  ]},

  /* ── ③ 价值：冲突与承诺 ── */
  { parent: 'val', children: [
    { id: 'val-conflict', text: '价值观冲突解决卡',
      children: [
        { text: '冲突时先回北极星排序' },
        { text: '长短期冲突用 10/10/10 裁决' },
        { text: '与人冲突：求同存异+边界' }
      ] },
    { id: 'val-year', text: '年度承诺设计',
      children: [
        { text: '一年只立 3 个承诺' },
        { text: '承诺必须可检验（数量/日期）' },
        { text: '季度对齐宪法复审' }
      ] }
  ]},

  /* ── ④ 决策：信息价值 ── */
  { parent: 'dec', children: [
    { id: 'dec-evsi', text: '情报与信息价值（EVSI）',
      children: [
        { text: '信息价值=决策改善−获取成本' },
        { text: '先问「能改变决策吗」再查' },
        { text: '关键未知优先调查' }
      ] }
  ]},

  /* ── ⑤ 解题：商业工程工具 ── */
  { parent: 'sol', children: [
    { id: 'sol-more', text: '商业与工程拆解工具',
      children: [
        { text: '波特五力：竞争结构五要素' },
        { text: 'PEST：政治经济社会技术环境' },
        { text: 'SWOT：优势劣势机会威胁' },
        { text: '麦肯锡 7S：软硬要素对齐' },
        { text: '六顶思考帽：平行思考不争吵' }
      ] }
  ]},

  /* ── ⑥ 执行：GTD ── */
  { parent: 'exe', children: [
    { id: 'exe-gtd', text: 'GTD 五步',
      children: [
        { text: '收集-理清-组织-回顾-执行' },
        { text: '清空大脑：一切进收件箱' },
        { text: '下一步动作永远具体可做' }
      ] }
  ]},

  /* ── ⑦ 复盘：十问清单 ── */
  { parent: 'rev', children: [
    { id: 'rev-ten', text: '复盘十问清单',
      children: [
        { text: '目标达成了吗？差多少？' },
        { text: '最大变量是什么？' },
        { text: '哪一步可以省略？' },
        { text: '下次同类事第一个动作？' }
      ] }
  ]},

  /* ── ⑧ 模型格栅：信息计算复杂 + 心理补充 ── */
  { parent: 'mdl', children: [
    { id: 'mdl-info', text: '信息 · 计算 · 复杂',
      children: [
        { text: '香农信息论：信息=消除不确定性' },
        { text: '维纳控制论：反馈即调节' },
        { text: '哥德尔不完备：系统内有真不可证' },
        { text: '图灵可计算：问题有解的边界' },
        { text: '一般系统论：整体＞部分之和' },
        { text: '复杂适应系统：适应性造就复杂' }
      ] }
  ]},
  { parent: 'mdl-psy', children: [
    { text: '心理账户：钱看标签不看价值' },
    { text: '双曲贴现：现在远比将来诱人' },
    { text: '宜家效应：自己做的更珍爱' },
    { text: '禀赋效应：拥有即高估' }
  ]},

  /* ── ⑨ 场景：通用流程 ── */
  { parent: 'scn', children: [
    { id: 'scn-general', text: '万能流程：宪法→5问→主回路→复盘',
      note: '任何场景先跑一遍：对齐宪法、万能 5 问过滤、七步主回路执行、决策日志复盘。' }
  ]},

  /* ── ⑪ 日常：晨晚程序 ── */
  { parent: 'life', children: [
    { id: 'life-ampm', text: '晨间与晚间程序',
      children: [
        { text: '晨：静坐5分+三件事+一次5问' },
        { text: '晚：三记（决策/收获/感恩）' },
        { text: '睡前禁屏 30 分钟' }
      ] }
  ]},

  /* ── ⑫ 思维方法：信息论·哥德尔·因果 ── */
  { parent: 'mth', children: [
    { id: 'mth-info', text: '信息论与控制论',
      children: [
        { text: '信息熵：不确定性度量' },
        { text: '冗余：抗噪的代价与必要' },
        { text: '反馈控制：目标-比较-校正' }
      ] },
    { id: 'mth-incomplete', text: '哥德尔与知识边界',
      children: [
        { text: '足够强系统必有真不可证' },
        { text: '谦逊：承认公理的局限' },
        { text: '升维：跳出系统看问题' }
      ] },
    { id: 'mth-causal', text: '因果推断',
      children: [
        { text: '相关≠因果：找混杂变量' },
        { text: '反事实：若没做会怎样' },
        { text: '自然实验/双重差分思路' }
      ] }
  ]},
  { parent: 'mth-tri', children: [{ text: '休谟问题：归纳没有逻辑保证' }] },

  /* ── ⑬ 兵书策论：深度延伸 ── */
  { parent: 'war', children: [
    { id: 'war-indirect', text: '战略：间接路线（利德尔·哈特）',
      children: [
        { text: '正面强攻是最下策' },
        { text: '打击心理与补给线' },
        { text: '先瓦解抵抗意志再决战' }
      ] },
    { id: 'war-yue', text: '素书（张良得之兴汉）',
      children: [
        { text: '道德仁义礼五者一体' },
        { text: '潜居抱道，以待其时' },
        { text: '绝嗜禁欲，所以除累' }
      ] },
    { id: 'war-fanjing', text: '反经（赵蕤）· 长短术',
      children: [
        { text: '量才用人：长短相济' },
        { text: '时宜则变，无常势' },
        { text: '名实相副，赏罚有信' }
      ] },
    { id: 'war-jomini', text: '战争艺术概论（约米尼）',
      children: [
        { text: '内线作战，各个击破' },
        { text: '补给线即生命线' },
        { text: '战略原则可学习' }
      ] },
    { id: 'war-schelling', text: '冲突的战略（谢林）',
      children: [
        { text: '威慑：可信承诺与边缘策略' },
        { text: '谢林点：默契聚焦的均衡' },
        { text: '让对手知道你的底线' }
      ] },
    { id: 'war-protracted', text: '论持久战',
      children: [
        { text: '阶段论：防御-相持-反攻' },
        { text: '积小胜为大胜' },
        { text: '统一战线：朋友多多益善' }
      ] }
  ]},
  { parent: 'war-sun', children: [
    { text: '总纲：胜兵先胜而后求战', note: '先创造必胜条件，再与敌交战——呼应公理3生存第一与军形篇' }
  ]},

  /* ── ⑭ 东方智慧：庄子·心经·了凡·太极 ── */
  { parent: 'east', children: [
    { id: 'east-zhuang', text: '庄子：逍遥与齐物',
      children: [
        { text: '逍遥游：无待的自由' },
        { text: '齐物论：是非相对，跳出立场' },
        { text: '无用之用：保全与超越' },
        { text: '庖丁解牛：依乎天理游刃有余' }
      ] },
    { id: 'east-heart', text: '心经 · 金刚经精要',
      children: [
        { text: '色即是空：现象无自性' },
        { text: '应无所住而生其心' },
        { text: '凡所有相皆是虚妄' }
      ] },
    { id: 'east-liaofan', text: '了凡四训：命由我作',
      children: [
        { text: '立命：命运可改（主动论）' },
        { text: '改过：从心上改最上' },
        { text: '积善与谦德之效' }
      ] },
    { id: 'east-taiji', text: '太极与武道',
      children: [
        { text: '舍己从人：借力打力' },
        { text: '以柔克刚：四两拨千斤' },
        { text: '松静自然：慢练入道' }
      ] }
  ]},

  /* ── ⑮ 西方智慧：尼采·叔本华·笛卡尔·休谟·康德·管理 ── */
  { parent: 'west', children: [
    { id: 'west-nietzsche', text: '尼采：强力意志',
      children: [
        { text: '超人：自我超越的价值创造' },
        { text: '永恒回归：热爱命运的试金石' },
        { text: '杀不死我的使我更强' }
      ] },
    { id: 'west-schop', text: '叔本华：意志与幸福',
      children: [
        { text: '人生钟摆：痛苦与无聊之间' },
        { text: '幸福=少痛苦而非多快乐' },
        { text: '艺术与沉思的解脱' }
      ] },
    { id: 'west-descartes', text: '笛卡尔与怀疑方法',
      children: [
        { text: '我思故我在（不可怀疑的起点）' },
        { text: '方法怀疑：系统性质疑一切' },
        { text: '明晰清楚才接受' }
      ] },
    { id: 'west-hume', text: '休谟：因果与归纳',
      children: [
        { text: '因果只是习惯性联想' },
        { text: '归纳问题：太阳明天也升起？' },
        { text: '休谟铡刀：应然推不出实然' }
      ] },
    { id: 'west-kant2', text: '康德：理性批判',
      children: [
        { text: '物自体不可知，人自带滤镜' },
        { text: '绝对命令：可普遍化准则' },
        { text: '人为自然立法' }
      ] },
    { id: 'west-mgmt', text: '现代管理智慧',
      children: [
        { text: '德鲁克：做正确的事＞正确做事' },
        { text: '圣吉：第五项修炼（系统思考）' },
        { text: '明茨伯格：战略手艺化' },
        { text: '心智模式与共同愿景' }
      ] }
  ]},

  /* ── ⑯ 处世典籍：原则·快慢·影响力·乌合·刻意练习·心流·枪炮·基因·史记 ── */
  { parent: 'book', children: [
    { id: 'bk-principles', text: '原则（达利欧）',
      children: [
        { text: '痛苦＋反思＝进步' },
        { text: '极度透明与极度真实' },
        { text: '五步：目标-问题-诊断-方案-执行' }
      ] },
    { id: 'bk-thinking', text: '思考，快与慢（卡尼曼）',
      children: [
        { text: '系统1快直觉，系统2慢理性' },
        { text: '锚定/可得性/损失厌恶三件套' },
        { text: '峰终定律与经验自我' }
      ] },
    { id: 'bk-influence', text: '影响力（西奥迪尼）',
      children: [
        { text: '互惠·承诺一致·社会认同' },
        { text: '喜好·权威·稀缺六原则' },
        { text: '防御：识别顺从武器' }
      ] },
    { id: 'bk-crowd', text: '乌合之众（勒庞）',
      children: [
        { text: '群体智力低于个体，情绪传染' },
        { text: '断言·重复·传染三传播法' },
        { text: '领袖的威望与动员术' }
      ] },
    { id: 'bk-deliberate', text: '刻意练习（埃里克森）',
      children: [
        { text: '舒适区边缘的针对练习' },
        { text: '心理表征：高手的内部模型' },
        { text: '导师反馈不可省' }
      ] },
    { id: 'bk-flow', text: '心流（契克森米哈赖）',
      children: [
        { text: '挑战≈技能时进入心流' },
        { text: '明确目标＋即时反馈' },
        { text: '自成目标：过程即奖励' }
      ] },
    { id: 'bk-guns', text: '枪炮、病菌与钢铁（戴蒙德）',
      children: [
        { text: '地理环境塑造历史路径' },
        { text: '病菌：征服的隐形武器' },
        { text: '路径依赖的宏观案例' }
      ] },
    { id: 'bk-selfish', text: '自私的基因（道金斯）',
      children: [
        { text: '基因视角：我们是生存机器' },
        { text: '模因：文化复制子' },
        { text: '利他=亲缘选择＋互惠' }
      ] },
    { id: 'bk-shiji', text: '史记 · 资治通鉴案例库',
      children: [
        { text: '卧薪尝胆：延迟满足与复国' },
        { text: '鸿门宴：信息与先手' },
        { text: '淝水之战：以少胜多的心理战' }
      ] }
  ]},

  /* ── ⑩ 反模式：补充 ── */
  { parent: 'anti', children: [
    { text: '升级承诺：为证明过去对而加码→换人复盘' },
    { text: '规划谬误→premortem＋外部基准' }
  ]}
];
