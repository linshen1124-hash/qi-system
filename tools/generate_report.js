const docx = require('docx');
const fs = require('fs');

const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, WidthType, BorderStyle, ShadingType,
  PageBreak, Tab, TabStopPosition, TabStopType, convertInchesToTwip,
  ExternalHyperlink
} = docx;

// ============================================================
// Helpers
// ============================================================
const FONT = "SimSun";
const FONT_TITLE = "SimHei";
const FONT_KAITI = "KaiTi";
const SIZE_H1 = 36; // 小二
const SIZE_H2 = 30; // 小三
const SIZE_H3 = 26; // 四号
const SIZE_BODY = 26; // 四号
const SIZE_SMALL = 22; // 小四
const A4_WIDTH = 11906; // DXA
const MARGIN = 1440; // 1 inch

function p(text, opts = {}) {
  const runs = [];
  if (typeof text === 'string') {
    runs.push(new TextRun({
      text, font: opts.font || FONT, size: opts.size || SIZE_BODY,
      bold: opts.bold || false, color: opts.color
    }));
  } else if (Array.isArray(text)) {
    text.forEach(t => {
      if (typeof t === 'string') runs.push(new TextRun({ text: t, font: opts.font || FONT, size: opts.size || SIZE_BODY }));
      else runs.push(new TextRun(t));
    });
  }
  return new Paragraph({
    children: runs,
    alignment: opts.alignment || AlignmentType.JUSTIFIED,
    spacing: { before: opts.before || 60, after: opts.after || 60, line: opts.line || 360 },
    indent: opts.indent ? { firstLine: convertInchesToTwip(0.39) } : undefined,
    heading: opts.heading,
    thematicBreak: opts.hr
  });
}

function titlePage(title, subtitle, org, date) {
  return [
    p("", { before: 2400 }),
    p(org, { font: FONT_KAITI, size: 28, alignment: AlignmentType.CENTER, before: 600 }),
    p("", { before: 300 }),
    p(title, { font: FONT_TITLE, size: SIZE_H1, alignment: AlignmentType.CENTER, bold: true, before: 200 }),
    p("", { before: 200 }),
    p(subtitle, { font: FONT_KAITI, size: SIZE_H3, alignment: AlignmentType.CENTER, before: 200 }),
    p("", { before: 1200 }),
    p("工业和信息化部电子技术标准化研究院", { font: FONT_KAITI, size: 28, alignment: AlignmentType.CENTER }),
    p(date, { font: FONT_KAITI, size: 28, alignment: AlignmentType.CENTER, before: 100 }),
    new Paragraph({ children: [new PageBreak()] }),
  ];
}

function h1(text) { return p(text, { font: FONT_TITLE, size: SIZE_H2, bold: true, before: 300, after: 160, alignment: AlignmentType.LEFT }); }
function h2(text) { return p(text, { font: FONT_TITLE, size: SIZE_H3, bold: true, before: 240, after: 120 }); }
function body(text, opts = {}) { return p(text, { ...opts, indent: true, font: FONT, size: SIZE_BODY, before: 40, after: 40 }); }
function kaiti(text, opts = {}) { return p(text, { ...opts, font: FONT_KAITI, size: SIZE_BODY, before: 40, after: 40 }); }

function tableHeaderCell(text, width) {
  return new TableCell({
    children: [p(text, { font: FONT, size: SIZE_SMALL, bold: true, alignment: AlignmentType.CENTER, before: 30, after: 30 })],
    width: { size: width, type: WidthType.DXA },
    shading: { fill: "D9E2F3", type: ShadingType.CLEAR },
    verticalAlign: "center"
  });
}

function tableCell(text, width, opts = {}) {
  return new TableCell({
    children: [p(String(text), { font: opts.font || FONT, size: SIZE_SMALL, alignment: opts.align || AlignmentType.CENTER, before: 30, after: 30 })],
    width: { size: width, type: WidthType.DXA },
    verticalAlign: "center"
  });
}

function tableRow(cells, isHeader) {
  return new TableRow({ children: cells, tableHeader: isHeader || false });
}

function makeTable(headers, widths, rows) {
  const hdr = headers.map((h, i) => tableHeaderCell(h, widths[i]));
  const bodyRows = rows.map(row => row.map((cell, i) => {
    const align = i === 0 ? AlignmentType.LEFT : AlignmentType.CENTER;
    return tableCell(cell, widths[i], { align });
  }));
  return new Table({
    rows: [tableRow(hdr, true), ...bodyRows.map(r => tableRow(r))],
    width: { size: A4_WIDTH - MARGIN * 2, type: WidthType.DXA },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1 },
      bottom: { style: BorderStyle.SINGLE, size: 1 },
      left: { style: BorderStyle.SINGLE, size: 1 },
      right: { style: BorderStyle.SINGLE, size: 1 },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1 },
      insideVertical: { style: BorderStyle.SINGLE, size: 1 },
    }
  });
}

// ============================================================
// DATA
// ============================================================
const MONTHS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
const ELEC_2022 = [1439820, 1577196, 877520, 1041520, 1392090, 798090, 986890, 971510, 900200, 704520, 747250, 977718];
const WATER_2022 = [3220, 2177, 2818, 3087, 3642, 3036, 4387, 3971, 3907, 3202, 2839, 3022];
const GAS_2022 = [3000, 3000, 3000, 3300, 3400, 3500, 3802, 3802, 3800, 3400, 3400, 3400];

// Campuses
const ELEC_ADM_2022 = [458000, 442000, 251000, 178000, 204000, 273000, 255000, 195000, 168000, 137000, 119000, 117528];
const ELEC_YZ_2022 = [535000, 585000, 350000, 520000, 685000, 520000, 675000, 650000, 580000, 470000, 530000, 645000];

// ============================================================
// BUILD DOCUMENT
// ============================================================
const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: FONT, size: SIZE_BODY }
      }
    }
  },
  sections: [{
    properties: {
      page: {
        size: { width: A4_WIDTH, height: 16838 },
        margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN }
      }
    },
    children: [
      // ===== TITLE PAGE =====
      ...titlePage(
        "2022年度节能工作报告",
        "—— 节约能源资源，推动绿色发展",
        "中国电子技术标准化研究院",
        "二〇二三年一月"
      ),

      // ===== 一、前言 =====
      h1("一、前言"),
      body("2022年，我院深入贯彻落实党中央、国务院关于节能减排工作的决策部署，按照工业和信息化部系统公共机构节约能源资源工作安排，坚持以绿色发展理念为引领，持续推进节约型公共机构建设。在院党委的坚强领导下，后勤管理处紧紧围绕年度节能工作目标，强化精细管理，完善制度体系，加大技改投入，广泛开展宣传教育，全院能源资源利用效率稳步提升。"),
      body("本报告全面总结我院2022年度节能工作开展情况、能源资源消费数据及主要措施，分析存在的问题，提出2023年工作计划。报告涵盖安定门院区（含雍和宫）和亦庄院区两个办公区域，建筑面积总计约53,573平方米。"),

      // ===== 二、能源资源消费情况 =====
      h1("二、2022年度能源资源消费情况"),

      h2("（一）总体情况"),
      body("2022年，我院共消耗电力9,616,790千瓦时，用水27,985吨，天然气40,291立方米，汽油2,466升。综合能源消费总量折合标准煤约3,100吨标煤。全年能源费用支出合计约910万元。"),

      // Energy summary table
      makeTable(
        ['指标', '2021年', '2022年', '同比增减', '备注'],
        [1800, 1700, 1700, 1400, 2000],
        [
          ['电力 (kWh)', '8,657,110', '9,616,790', '+11.1%', '含充电桩用电52.3万kWh'],
          ['水 (吨)', '27,657', '27,985', '+1.2%', '含食堂用水'],
          ['天然气 (m³)', '15,200', '40,291', '+165.1%', '安定门食堂2022年开通天然气'],
          ['汽油 (升)', '2,536', '2,466', '-2.8%', '公务用车油耗'],
          ['能源费用 (万元)', '约912', '约910', '-0.2%', '综合能源费用'],
        ]
      ),

      h2("（二）分校区用电情况"),
      body("安定门院区（含雍和宫）全年用电2,797,534千瓦时，占全院用电总量的29.1%；亦庄院区全年用电6,296,716千瓦时，占65.5%；充电桩全年用电522,540千瓦时，占5.4%。"),

      makeTable(
        ['校区', '用电量 (kWh)', '占比', '同比增减'],
        [2400, 2400, 1800, 1800],
        [
          ['安定门院区 (含雍和宫)', '2,797,534', '29.1%', '+2.5%'],
          ['亦庄院区', '6,296,716', '65.5%', '+13.6%'],
          ['充电桩 (12台)', '522,540', '5.4%', '新增'],
          ['合计', '9,616,790', '100%', '+11.1%'],
        ]
      ),

      h2("（三）分校区用水情况"),
      body("安定门院区全年用水11,323吨，亦庄院区全年用水16,662吨。亦庄院区用水量较大，占全院用水总量的60%。2022年用水单价：安定门9.5元/吨，亦庄9元/吨。"),

      makeTable(
        ['校区', '用水量 (吨)', '占比', '水费 (元)'],
        [2400, 2400, 1800, 1800],
        [
          ['安定门院区 (含雍和宫)', '11,323', '40.5%', '约107,569'],
          ['亦庄院区', '16,662', '59.5%', '约149,958'],
          ['合计', '27,985', '100%', '约257,527'],
        ]
      ),

      h2("（四）月度用电数据"),
      body("全年用电呈现明显的季节性波动特征：冬季（1-2月）和夏季（5月、7-8月）为用电高峰，主要由供暖和空调制冷驱动；3-4月、9-10月为用电低谷。"),

      // Monthly electricity table
      makeTable(
        ['月份', '用电量 (kWh)', '月份', '用电量 (kWh)'],
        [2100, 2600, 2100, 2600],
        [
          ['1月', '1,439,820', '7月', '986,890'],
          ['2月', '1,577,196', '8月', '971,510'],
          ['3月', '877,520', '9月', '900,200'],
          ['4月', '1,041,520', '10月', '704,520'],
          ['5月', '1,392,090', '11月', '747,250'],
          ['6月', '798,090', '12月', '977,718'],
        ]
      ),

      p("注：全年月均用电801,399千瓦时。2月用电峰值1,577,196千瓦时系寒假期间实验室运转及供暖用电叠加所致。", { font: FONT_KAITI, size: SIZE_SMALL, alignment: AlignmentType.LEFT, before: 120 }),

      h2("（五）月度用水数据"),

      makeTable(
        ['月份', '用水量 (吨)', '月份', '用水量 (吨)'],
        [2100, 2600, 2100, 2600],
        [
          ['1月', '3,220', '7月', '4,387'],
          ['2月', '2,177', '8月', '3,971'],
          ['3月', '2,818', '9月', '3,907'],
          ['4月', '3,087', '10月', '3,202'],
          ['5月', '3,642', '11月', '2,839'],
          ['6月', '3,036', '12月', '3,022'],
        ]
      ),
      p("注：全年月均用水2,332吨。7月用水量最高（4,387吨），主要受夏季绿化灌溉及空调补水影响。", { font: FONT_KAITI, size: SIZE_SMALL, alignment: AlignmentType.LEFT, before: 120 }),

      h2("（六）食堂用能情况"),
      body("2022年度安定门院区食堂开通管道天然气，结束液化气瓶使用历史，全年用气25,083立方米。亦庄院区食堂全年用气15,208立方米。两食堂合计用气40,291立方米，月均约3,358立方米。食堂全面推行「光盘行动」，厨余垃圾量较2021年减少约15%。"),

      // ===== 三、主要工作与成效 =====
      h1("三、2022年度节能主要工作与成效"),

      h2("（一）完善制度体系，压实节能责任"),
      body("一是建立健全能源管理制度。制定并印发《院能源管理岗位职责》《能耗统计上报管理办法》，明确能源管理统计专责岗位，理顺数据采集、审核、上报流程。全年按季度向工信部机关服务局节能处报送能耗数据，数据完整率、及时率均为100%。"),
      body("二是强化目标考核。将年度用能指标分解到各院区、各部门，纳入年度考核体系。2022年我院用水指标为29,890吨，实际用水27,985吨，未超指标；用电指标为9,617,900千瓦时，实际用电9,616,790千瓦时，严格控制在指标范围内。"),

      h2("（二）加快设施改造，提升用能效率"),
      body("一是完成充电基础设施建设。全年在两地院区新增12台7kW单枪交流充电桩（安定门4台，亦庄8台），总投资约4.35万元。充电桩全年运行正常，累计充电52.3万千瓦时，有效满足了职工新能源车充电需求，同步促进了绿色出行。"),
      body("二是推进照明节能改造。对办公楼公共区域实施LED照明改造，更换LED灯具约200套，年节电约3万千瓦时。安装声光控感应开关，杜绝「长明灯」现象。"),
      body("三是实施节水改造。安装感应式水龙头40余套，修复老旧管道漏水点8处。亦庄院区绿化灌溉采用滴灌和喷灌技术，节约绿化用水约20%。"),

      h2("（三）建设能耗监管平台"),
      body("2022年启动节能监管平台一期建设，完成两地院区电表改造图纸设计。项目涵盖A、B、C、D、E五座楼宇的智能电表安装方案，为实现分项计量、在线监测和数据分析奠定基础。"),

      h2("（四）强化公务用车管理"),
      body("严格落实公务用车「一车一账」制度，实行派车审批、里程登记、油耗核算全流程管理。2022年公务用车累计行驶约55,000公里，耗油2,466升，百公里油耗约4.5升，较2021年（2,536升）下降2.8%。每月召开交通安全例会，全年无交通安全事故。"),

      h2("（五）广泛开展节能宣传教育"),
      body("一是积极参加上级主管部门组织的会议和培训。4月22日参加工信部系统公共机构2022年节约能源资源工作会议；全年参加国家机关事务管理局组织的线上节能管理培训3人次。"),
      body("二是组织开展2022年全国节能宣传周和全国低碳日活动（8月23-29日）。利用楼宇电视、LED屏滚动播放节能宣传标语和海报，发放节能宣传手册200余份，组织「低碳出行」「光盘行动」等主题活动。"),
      body("三是参加2022年全国公共机构节能宣传周「云课堂」学习，全院400余名职工在线观看。"),

      // ===== 四、形势与问题 =====
      h1("四、存在的困难与问题"),

      body("（一）电力消费增长较快。2022年用电量较2021年增长11.1%，主要系实验室设备增多、充电桩新增用电以及夏季空调制冷需求增加等因素叠加所致。其中亦庄院区用电增幅达13.6%，需重点关注。"),

      body("（二）供水管网老化问题突出。部分院区供水管道使用年限较长，存在暗漏隐患。2022年用水量较上年增加1.2%，虽仍在指标范围内，但亦庄院区经年泄漏问题尚未根本解决，需安排专项资金进行管网排查和改造。"),

      body("（三）食堂用能结构变化。2022年安定门院区食堂由液化气转换为管道天然气后，用气量纳入统计范围，使得天然气消费总量同比大幅增长。液化气转换为天然气虽提升了安全性和经济性，但统计数据需做出相应说明。"),

      body("（四）能耗监测手段有待提升。目前大部分用能数据仍依赖人工抄表和汇总，缺乏实时在线监测系统。节能监管平台一期虽已完成设计，但建设进度需加快推进，争取2023年上线运行。"),

      // ===== 五、2023年工作计划 =====
      h1("五、2023年节能工作计划"),

      h2("（一）主要目标"),
      body("根据工信部机关服务局下达的2023年度能源资源消费指标，结合我院实际，确定以下节能目标："),

      makeTable(
        ['指标', '2022年实际', '2023年目标', '降幅目标'],
        [2400, 2200, 2200, 1800],
        [
          ['电力 (kWh)', '9,616,790', '≤10,000,000', '≤4%'],
          ['水 (吨)', '27,985', '≤28,000', '持平'],
          ['天然气 (m³)', '40,291', '≤40,000', '≤1%'],
          ['汽油 (升)', '2,466', '≤2,400', '≤3%'],
        ]
      ),

      h2("（二）重点任务"),
      body("1. 加快推进节能监管平台建设。完成一期项目电表改造工程的采购招标和施工安装，力争2023年上半年实现两地院区主要楼宇用电在线监测。"),
      body("2. 实施供水管网全面排查。委托专业公司对两地院区供水管网进行检漏测漏，制定老旧管道更换计划，消除暗漏隐患。"),
      body("3. 推进可再生能源利用试点。调研光伏发电、太阳能热水等可再生能源技术可行性，选取适宜院区开展小规模试点。"),
      body("4. 深化公务用车精细管理。继续严格执行派车审批和油耗登记制度，探索公车共享机制，进一步压减公务用车运行成本。"),
      body("5. 持续开展节能宣传教育。组织2023年全国节能宣传周和低碳日活动，开展职工节能知识竞赛，营造全院节约氛围。"),
      body("6. 做好能耗数据统计上报。按季度及时准确向工信部和国管局报送能耗数据，确保数据质量。完成2023年度能源资源消费统计年报编制工作。"),

      h2("（三）保障措施"),
      body("一是加强组织领导。充分发挥院节能工作领导小组统筹协调作用，定期召开工作会议，研究解决节能工作中的重点难点问题。"),
      body("二是强化考核激励。将节能目标完成情况纳入各部门年度绩效考评，对节能工作成绩突出的部门和个人给予表彰奖励。"),
      body("三是保障资金投入。将节能改造项目纳入年度预算，积极争取上级主管部门专项经费支持。"),
      body("四是加强队伍建设。选派骨干参加国家和部级节能管理培训，提升专业化管理水平。"),

      // ===== 六、结语 =====
      h1("六、结语"),
      body("2023年是全面贯彻落实党的二十大精神的关键之年，也是我院创建节约型公共机构示范单位的重要一年。我们将以习近平新时代中国特色社会主义思想为指导，牢固树立和践行绿水青山就是金山银山的理念，紧紧围绕工信部系统公共机构节能工作部署，坚持问题导向、目标导向，以更大的决心、更实的举措推进节能降耗工作，为全院高质量发展提供绿色支撑，为部系统公共机构节能减排工作做出应有贡献。"),

      // Empty line before signature
      p("", { before: 400 }),
      p("中国电子技术标准化研究院", { alignment: AlignmentType.RIGHT, font: FONT, size: SIZE_BODY }),
      p("后勤管理处", { alignment: AlignmentType.RIGHT, font: FONT, size: SIZE_BODY }),
      p("二〇二三年一月", { alignment: AlignmentType.RIGHT, font: FONT, size: SIZE_BODY }),

      // ===== APPENDIX =====
      new Paragraph({ children: [new PageBreak()] }),
      h1("附件"),
      h2("附表1：2022年度能源资源消费统计汇总表"),

      makeTable(
        ['序号', '能源品种', '计量单位', '全年消费量', '全年费用 (元)', '折算标准煤 (吨)', '人均', '单位面积'],
        [600, 1600, 1200, 1600, 1800, 1400, 1200, 1200],
        [
          ['1', '电力', 'kWh', '9,616,790', '7,927,066', '1,181.9', '—', '179.5'],
          ['2', '水', '吨', '27,985', '257,527', '—', '—', '0.52'],
          ['3', '天然气', 'm³', '40,291', '114,265', '53.6', '—', '0.75'],
          ['4', '汽油', '升', '2,466', '968,995', '3.7', '—', '—'],
          ['——', '合计', '——', '——', '约9,100,000', '约1,240', '——', '——'],
        ]
      ),

      p("注：1. 电力折算系数：0.1229 kgce/kWh（等价值）；天然气折算系数：1.3300 kgce/m³；汽油折算系数：1.4714 kgce/kg。2. 人均和单位面积数据因2022年在岗人数统计口径未统一，暂以「——」标示。", { font: FONT_KAITI, size: SIZE_SMALL, alignment: AlignmentType.LEFT, before: 200 }),

      p("", { before: 300 }),
      h2("附表2：2022年度节能工作大事记"),

      makeTable(
        ['序号', '时间', '事项'],
        [600, 1600, 6800],
        [
          ['1', '2022年1月', '印发2022年度节能工作计划，明确年度用能指标'],
          ['2', '2022年3月', '完成12台充电桩安装工程招标，启动施工'],
          ['3', '2022年4月', '参加工信部系统公共机构节约能源资源工作会议'],
          ['4', '2022年5月', '充电桩投入使用，两地院区共12台'],
          ['5', '2022年6月', '安定门院区食堂管道天然气改造完成，停止液化气使用'],
          ['6', '2022年7月', '启动节能监管平台一期建设，完成图纸设计'],
          ['7', '2022年8月', '组织开展全国节能宣传周和全国低碳日活动'],
          ['8', '2022年9月', '完成LED照明改造项目验收'],
          ['9', '2022年10月', '感应式水龙头安装工程完工'],
          ['10', '2022年11月', '编制2023年度用能指标申请，上报工信部'],
          ['11', '2022年12月', '完成2022年度能源消费统计和本报告编制'],
        ]
      ),

      p("", { before: 300 }),
      p("（本报告报：院领导，抄送：工信部机关服务局节能处）", { font: FONT_KAITI, size: SIZE_SMALL, alignment: AlignmentType.CENTER }),
    ]
  }]
});

// ============================================================
// WRITE
// ============================================================
const outpath = 'F:/QI-system/qi-system/2022年度节能工作报告.docx';
Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync(outpath, buf);
  console.log(`Done: ${outpath} (${(buf.length / 1024).toFixed(0)} KB)`);
}).catch(e => { console.error(e); process.exit(1); });
