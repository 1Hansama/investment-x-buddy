// 合规红线：题目明确要求「不得输出确定性涨跌预测、收益承诺或买卖建议」，
// 且事实、推断与不确定信息必须区分。这里集中管理。

export const DISCLAIMER =
  "本结论基于公开/示例数据的整理与推断，仅供研究演示，不构成任何投资建议；市场有风险，决策需独立判断。";

// 违禁表述模式：只扫产品自己生成/输出的结论，不扫外部研报原文（外部观点会单独标注）。
const BANNED = [
  { re: /目标价/, why: "涉及价格预测" },
  { re: /建议买入|建议卖出|加仓|减仓|抄底|满仓|清仓/, why: "涉及直接买卖建议" },
  { re: /(一定|必将|肯定|必然)(上涨|下跌|涨|跌)/, why: "确定性涨跌预测" },
  { re: /收益(承诺|保证)/, why: "收益承诺" },
];

export function findComplianceIssues(text) {
  return BANNED.filter((b) => b.re.test(text)).map((b) => b.why);
}

// 给结论加免责声明（幂等：重复调用不会重复加）。
export function withDisclaimer(text) {
  return text.includes(DISCLAIMER) ? text : `${text}\n\n${DISCLAIMER}`;
}
