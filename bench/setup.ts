// tests/bench/setup.ts
import { pinyinEngine } from '@/engine/pinyinEngine';

// ============================================================
// Mock plugin settings for match_() which internally calls usePlugin()
// ============================================================
import ThePlugin from '@/main';

// Create a minimal mock plugin instance so match_() doesn't throw
const mockPlugin = {
  settings: {
    global: {
      autoCaseSensitivity: false,
      closeWithBackspace: true,
    },
    fuzzy: { enabled: false, rules: {} },
    shuangpin: { scheme: '' },
    palladius: { enabled: false },
  },
  saveSettings: () => Promise.resolve(),
  loadData: () => Promise.resolve({}),
} as any;

// Inject mock plugin into ThePlugin's static instance
(ThePlugin as any).instance = mockPlugin;

export function initBenchmarkEnv() {
  // ============================================================
  // 拼音字典：加载约 500 个常见汉字
  // ============================================================
  const commonChars: Record<string, string[]> = {
    的: ['de', 'di'], 一: ['yi'], 是: ['shi'], 在: ['zai'], 不: ['bu'],
    了: ['le', 'liao'], 有: ['you'], 和: ['he', 'huo'], 人: ['ren'], 这: ['zhe'],
    中: ['zhong'], 大: ['da', 'dai'], 为: ['wei'], 上: ['shang'], 个: ['ge'],
    国: ['guo'], 我: ['wo'], 以: ['yi'], 要: ['yao'], 他: ['ta'],
    时: ['shi'], 来: ['lai'], 用: ['yong'], 们: ['men'], 生: ['sheng'],
    到: ['dao'], 作: ['zuo'], 地: ['di', 'de'], 于: ['yu'], 出: ['chu'],
    会: ['hui', 'kuai'], 分: ['fen'], 对: ['dui'], 成: ['cheng'],
    学: ['xue'], 下: ['xia'], 就: ['jiu'], 年: ['nian'], 发: ['fa'],
    文: ['wen'], 部: ['bu'], 方: ['fang'], 新: ['xin'], 开: ['kai'],
    定: ['ding'], 前: ['qian'], 理: ['li'], 现: ['xian'], 体: ['ti'],
    加: ['jia'], 都: ['dou', 'du'], 量: ['liang'], 机: ['ji'], 法: ['fa'],
    所: ['suo'], 自: ['zi'], 心: ['xin'], 力: ['li'], 本: ['ben'],
    面: ['mian'], 高: ['gao'], 长: ['chang', 'zhang'], 实: ['shi'], 者: ['zhe'],
    月: ['yue'], 天: ['tian'], 头: ['tou'], 家: ['jia'], 点: ['dian'],
    其: ['qi'], 去: ['qu'], 许: ['xu'], 进: ['jin'], 明: ['ming'],
    道: ['dao'], 工: ['gong'], 名: ['ming'], 样: ['yang'], 重: ['zhong', 'chong'],
    关: ['guan'], 日: ['ri'], 经: ['jing'], 通: ['tong'], 结: ['jie'],
    品: ['pin'], 代: ['dai'], 政: ['zheng'], 建: ['jian'], 手: ['shou'],
    相: ['xiang'], 全: ['quan'], 等: ['deng'], 战: ['zhan'], 回: ['hui'],
    行: ['xing', 'hang'], 处: ['chu'], 世: ['shi'], 说: ['shuo'], 东: ['dong'],
    正: ['zheng'], 同: ['tong'], 能: ['neng'], 多: ['duo'], 完: ['wan'],
    少: ['shao'], 子: ['zi'], 意: ['yi'], 只: ['zhi'], 主: ['zhu'],
    物: ['wu'], 被: ['bei'], 合: ['he'], 内: ['nei'], 场: ['chang'],
    从: ['cong'], 总: ['zong'], 放: ['fang'], 管: ['guan'], 条: ['tiao'],
    数: ['shu'], 论: ['lun'], 资: ['zi'], 比: ['bi'], 程: ['cheng'],
    问: ['wen'], 将: ['jiang'], 反: ['fan'], 最: ['zui'], 变: ['bian'],
    把: ['ba'], 两: ['liang'], 达: ['da'], 花: ['hua'], 原: ['yuan'],
    门: ['men'], 此: ['ci'], 组: ['zu'], 系: ['xi'], 海: ['hai'],
    切: ['qie'], 每: ['mei'], 认: ['ren'], 真: ['zhen'], 视: ['shi'],
    具: ['ju'], 活: ['huo'], 领: ['ling'], 强: ['qiang'], 风: ['feng'],
    改: ['gai'], 好: ['hao'], 度: ['du'], 更: ['geng'],
    表: ['biao'], 象: ['xiang'], 知: ['zhi'], 区: ['qu'],
    权: ['quan'], 先: ['xian'], 解: ['jie'], 拉: ['la'], 声: ['sheng'],
    接: ['jie'], 教: ['jiao'], 导: ['dao'], 百: ['bai'], 报: ['bao'],
    规: ['gui'], 热: ['re'], 色: ['se'], 节: ['jie'],
    记: ['ji'], 任: ['ren'], 受: ['shou'], 极: ['ji'], 连: ['lian'],
    求: ['qiu'], 万: ['wan'], 光: ['guang'], 医: ['yi'], 造: ['zao'],
    感: ['gan'], 清: ['qing'], 治: ['zhi'], 神: ['shen'],
    林: ['lin'], 研: ['yan'], 即: ['ji'], 术: ['shu'], 布: ['bu'],
    提: ['ti'], 写: ['xie'], 证: ['zheng'], 难: ['nan'], 统: ['tong'],
    界: ['jie'], 层: ['ceng'], 片: ['pian'], 创: ['chuang'], 复: ['fu'],
    指: ['zhi'], 第: ['di'], 七: ['qi'], 慢: ['man'], 排: ['pai'],
    书: ['shu'], 望: ['wang'], 路: ['lu'], 格: ['ge'], 交: ['jiao'],
    集: ['ji'], 空: ['kong'], 半: ['ban'], 始: ['shi'], 随: ['sui'],
    宜: ['yi'], 育: ['yu'], 站: ['zhan'], 史: ['shi'], 存: ['cun'],
    远: ['yuan'], 字: ['zi'], 形: ['xing'], 红: ['hong'], 深: ['shen'],
    石: ['shi'], 务: ['wu'], 微: ['wei'], 步: ['bu'], 调: ['tiao', 'diao'],
    单: ['dan'], 整: ['zheng'], 联: ['lian'], 传: ['chuan', 'zhuan'], 志: ['zhi'],
    华: ['hua'], 备: ['bei'], 骨: ['gu'], 巴: ['ba'], 列: ['lie'],
    马: ['ma'], 兴: ['xing'], 五: ['wu'], 思: ['si'],
    县: ['xian'], 识: ['shi'], 防: ['fang'], '6': ['6'], '7': ['7'],
    根: ['gen'], 八: ['ba'], 快: ['kuai'], 需: ['xu'],
    及: ['ji'], 克: ['ke'], 该: ['gai'], 设: ['she'],
    社: ['she'], 公: ['gong'], 确: ['que'], 院: ['yuan'], 张: ['zhang'],
    观: ['guan'], 南: ['nan'], 科: ['ke'], 告: ['gao'],
    十: ['shi'], 打: ['da'], 效: ['xiao'], 收: ['shou'], 标: ['biao'],
    增: ['zeng'], 眼: ['yan'], 断: ['duan'], 算: ['suan'], 产: ['chan'],
    转: ['zhuan'], 持: ['chi'], 基: ['ji'],
    己: ['ji'], 很: ['hen'], 伤: ['shang'], 商: ['shang'], 例: ['li'],
    选: ['xuan'], 直: ['zhi'],
    究: ['jiu'], 着: ['zhe', 'zhao'], 叫: ['jiao'], 山: ['shan'], 影: ['ying'],
    停: ['ting'], 题: ['ti'], 压: ['ya'],
    白: ['bai'], 服: ['fu'], 早: ['zao'], 它: ['ta'], 注: ['zhu'],
    培: ['pei'], 群: ['qun'], 装: ['zhuang'], 元: ['yuan'], 质: ['zhi'],
    团: ['tuan'], 老: ['lao'], 按: ['an'], 验: ['yan'], 够: ['gou'],
    火: ['huo'], 施: ['shi'], 维: ['wei'], 英: ['ying'],
    获: ['huo'], 坚: ['jian'], 味: ['wei'], 策: ['ce'], 号: ['hao'],
    独: ['du'], 优: ['you'], 营: ['ying'], 历: ['li'],
    木: ['mu'], 售: ['shou'], 劳: ['lao'], 响: ['xiang'], 含: ['han'],
    约: ['yue'], 故: ['gu'], 监: ['jian'], 显: ['xian'], 消: ['xiao'],
    继: ['ji'], 紧: ['jin'], 判: ['pan'], 送: ['song'], 归: ['gui'],
    置: ['zhi'], 律: ['lv'], 雷: ['lei'], 护: ['hu'], 买: ['mai'],
    落: ['luo', 'la'], 预: ['yu'], 卫: ['wei'], 跑: ['pao'], 破: ['po'],
    专: ['zhuan'], 云: ['yun'], 命: ['ming'], 息: ['xi'],
    积: ['ji'], 况: ['kuang'], 差: ['cha', 'chai'],
    往: ['wang'], 曾: ['ceng', 'zeng'], 何: ['he'],
    铁: ['tie'], 准: ['zhun'], 乐: ['le', 'yue'],
    待: ['dai'], 校: ['xiao', 'jiao'], 各: ['ge'], 特: ['te'],
    图: ['tu'], 网: ['wang'], 取: ['qu'], 胜: ['sheng'],
    推: ['tui'], 谈: ['tan'],
    留: ['liu'], 委: ['wei'],
    北: ['bei'], 金: ['jin'], 致: ['zhi'], 演: ['yan'],
    久: ['jiu'], 讲: ['jiang'], 精: ['jing'], 充: ['chong'],
    划: ['hua'], 食: ['shi'], 升: ['sheng'],
    省: ['sheng', 'xing'], 配: ['pei'], 女: ['nv'], 述: ['shu'],
    口: ['kou'], 离: ['li'], 据: ['ju'], 段: ['duan'],
    员: ['yuan'], 便: ['bian', 'pian'], 案: ['an'],
    她: ['ta'], 夜: ['ye'], 际: ['ji'],
    围: ['wei'], 板: ['ban'], 草: ['cao'], 助: ['zhu'],
    夫: ['fu'], 九: ['jiu'], 议: ['yi'], 境: ['jing'], 轻: ['qing'],
    似: ['si', 'shi'], 吃: ['chi'],
    欧: ['ou'], 仅: ['jin'],
    票: ['piao'], 千: ['qian'], 阵: ['zhen'], 笑: ['xiao'], 米: ['mi'],
    苏: ['su'], 春: ['chun'], 树: ['shu'], 航: ['hang'],
    害: ['hai'], 革: ['ge'], 脑: ['nao'],
    首: ['shou'], 台: ['tai'], 飞: ['fei'], 兰: ['lan'],
    星: ['xing'], 衣: ['yi'], 双: ['shuang'], 余: ['yu'],
    失: ['shi'], 客: ['ke'], 修: ['xiu'], 纸: ['zhi'],
    否: ['fou'], 展: ['zhan'], 鲜: ['xian'], 尺: ['chi'], '8': ['8'],
    丰: ['feng'], 信: ['xin'], 宝: ['bao'], 亮: ['liang'], 假: ['jia'],
    执: ['zhi'], 冷: ['leng'], 纪: ['ji'], 谓: ['wei'], 径: ['jing'],
    青: ['qing'], 核: ['he'], 静: ['jing'],
    补: ['bu'], 菜: ['cai'], 找: ['zhao'],
    办: ['ban'], 父: ['fu'], 努: ['nu'],
    '9': ['9'],
  };

  pinyinEngine.loadBase(commonChars);
}

// ============================================================
// 中文词素库：用于组合生成真实感的中文文件名
// ============================================================
const MORPHEMES_1 = [
  '设', '置', '面', '板', '文', '件', '编', '辑', '查', '看',
  '帮', '助', '中', '国', '人', '民', '银', '行', '大', '学',
  '上', '海', '新', '山', '水', '管', '理', '系', '统', '工',
  '程', '项', '目', '计', '划', '报', '告', '分', '析', '数',
  '据', '库', '网', '络', '安', '全', '服', '务', '器', '客',
  '户', '端', '页', '开', '发', '测', '试', '部', '署', '维',
  '护', '更', '配', '置', '优', '化', '性', '能', '监', '控',
  '日', '志', '异', '常', '错', '误', '警', '通', '知', '权',
  '限', '角', '色', '用', '接', '口', '协', '议', '缓', '存',
  '消', '队', '列', '调', '度', '负', '均', '衡', '容', '灾',
  '备', '份', '恢', '迁', '移', '扩', '缩', '版', '更', '迭',
  '代', '回', '滚', '蓝', '绿', '金', '丝', '雀', '灰', '度',
  '验', '压', '基', '准', '方', '案', '计', '架', '构',
  '模', '式', '策', '略', '规', '范', '标', '准', '指', '南',
  '最', '佳', '实', '践', '反', '重', '构', '技', '术', '债',
  '需', '求', '评', '审', '估', '优', '先', '级', '排', '期',
  '迭', '冲', '刺', '站', '燃', '尽', '看', '任', '务', '故',
  '跟', '踪', '源', '码', '仓', '分', '支', '拉', '请', '弹',
  '性', '计', '算', '存', '对', '象', '块', '共', '享', '私',
  '虚', '拟', '容', '器', '集', '群', '边', '缘', '云', '原',
];

const MORPHEMES_2 = [
  '设置', '面板', '文件', '编辑', '查看', '帮助', '管理', '系统',
  '工程', '项目', '计划', '报告', '分析', '数据', '网络', '安全',
  '服务', '配置', '优化', '性能', '监控', '日志', '异常', '错误',
  '通知', '权限', '角色', '接口', '协议', '缓存', '消息', '队列',
  '调度', '负载', '均衡', '容灾', '备份', '恢复', '迁移', '版本',
  '回滚', '验证', '基准', '方案', '设计', '架构', '模式', '策略',
  '规范', '标准', '指南', '实践', '重构', '技术', '需求', '评估',
  '优先', '排序', '冲刺', '燃尽', '故事', '跟踪', '源码', '分支',
  '请求', '弹性', '计算', '存储', '对象', '共享', '虚拟', '容器',
  '集群', '边缘', '注册', '发现', '网关', '路由', '熔断', '限流',
  '指标', '追踪', '链路', '拓扑', '依赖', '降级', '开关',
  '功能', '测试', '单元', '集成', '端到', '回归', '冒烟', '探索',
  '文档', '索引', '搜索', '排序', '过滤', '聚合', '分页', '高亮',
  '导航', '菜单', '布局', '主题', '插件', '扩展', '模板', '脚本',
  '动画', '过渡', '响应', '适配', '深色', '浅色', '语言',
  '本地', '国际', '日期', '时间', '格式', '校验', '上传', '下载',
  '导入', '导出', '转换', '预览', '打印', '分享', '订阅', '评论',
  '投票', '排行', '推荐', '广告', '统计', '图表', '仪表', '工作',
];

// ============================================================
// 随机种子工具：可重复的伪随机数生成（mulberry32）
// ============================================================
export function createRng(seed: number) {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ============================================================
// 中文名生成器
// ============================================================
export function generateChineseNames(
  count: number,
  seed: number = 42,
): string[] {
  const rng = createRng(seed);
  const names: string[] = [];
  const seen = new Set<string>();

  while (names.length < count) {
    const n = rng();
    let name: string;
    if (n < 0.2) {
      // 20%: 2 词素（4-5 字）
      const i = Math.floor(rng() * MORPHEMES_2.length);
      const j = Math.floor(rng() * MORPHEMES_2.length);
      name = MORPHEMES_2[i] + MORPHEMES_2[j];
    } else if (n < 0.5) {
      // 30%: 3 词素（5-7 字）
      const i = Math.floor(rng() * MORPHEMES_2.length);
      const j = Math.floor(rng() * MORPHEMES_2.length);
      const k = Math.floor(rng() * MORPHEMES_1.length);
      name = MORPHEMES_2[i] + MORPHEMES_2[j] + MORPHEMES_1[k];
    } else if (n < 0.8) {
      // 30%: 单字 × 3-5（3-5 字）
      const len = 3 + Math.floor(rng() * 3);
      const parts: string[] = [];
      for (let i = 0; i < len; i++) {
        parts.push(MORPHEMES_1[Math.floor(rng() * MORPHEMES_1.length)]);
      }
      name = parts.join('');
    } else {
      // 20%: 混合数字
      const i = Math.floor(rng() * MORPHEMES_2.length);
      const num = Math.floor(rng() * 100);
      name = MORPHEMES_2[i] + num;
    }

    if (!seen.has(name)) {
      seen.add(name);
      names.push(name);
    }
  }

  return names;
}

// ============================================================
// 预生成标准规模的数据集（由 seed 保证可重复）
// ============================================================
export const DATASETS = {
  /** 100 条 */
  small: generateChineseNames(100, 1),
  /** 500 条 */
  medium: generateChineseNames(500, 2),
  /** 1000 条 */
  large: generateChineseNames(1000, 3),
  /** 5000 条 */
  xlarge: generateChineseNames(5000, 4),
  /** 10000 条 */
  xxlarge: generateChineseNames(10000, 5),
  /** 50000 条 */
  huge: generateChineseNames(50000, 6),
} as const;
