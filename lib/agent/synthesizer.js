// 综合器：把执行结果组织成「支持 / 反对 / 无法验证」的证据链，并产出结论。
// 设计原则（贴合合规要求）：
// 1) 证据分「事实(fact)/推断(inference)/外部参考(reference)」三类；
// 2) 结论永远是「推断/不确定」，不是关于未来的「事实」；
// 3) 支持与反对并存时显式说明冲突与取舍，不掩盖相反证据；
// 4) 每个结论给出「翻转条件」——什么信息变了会推翻它。
//
// 这里用确定性的阈值规则（可审计、可测试）；规划器那边已经用了 LLM，
// 结论措辞可再用 LLM 增强（见 README 未做事项）。

import { DISCLAIMER } from "../compliance.js";
import { UNITS } from "../data/mock.js";

function fmt(v, field) {
  return `${v}${UNITS[field] ?? ""}`;
}

// —— 各工具的解释器：把「工具结果」翻译成证据/材料 ——

function financialsInterp(r) {
  const rows = r.data;
  const latest = rows[0];
  const prev = rows[1];
  if (!latest) return { evidence: [] };
  const src = { tool: "financials", ...r.source };
  const out = [];

  if (latest.coreRevenueShare >= 95) {
    out.push({ stance: "support", type: "fact", claim: `主营收入占比 ${fmt(latest.coreRevenueShare, "coreRevenueShare")}（≥95%），盈利主要来自主营业务`, source: { ...src, field: "coreRevenueShare", value: latest.coreRevenueShare, period: latest.period } });
  } else if (latest.coreRevenueShare < 90) {
    out.push({ stance: "against", type: "fact", claim: `主营收入占比仅 ${fmt(latest.coreRevenueShare, "coreRevenueShare")}（<90%），盈利对非主营业务依赖偏高`, source: { ...src, field: "coreRevenueShare", value: latest.coreRevenueShare, period: latest.period } });
  }

  if (latest.nonRecurringShare <= 5) {
    out.push({ stance: "support", type: "fact", claim: `非经常性损益占净利润 ${fmt(latest.nonRecurringShare, "nonRecurringShare")}（≤5%），盈利含金量较高`, source: { ...src, field: "nonRecurringShare", value: latest.nonRecurringShare, period: latest.period } });
  } else if (latest.nonRecurringShare >= 15) {
    out.push({ stance: "against", type: "fact", claim: `非经常性损益占净利润 ${fmt(latest.nonRecurringShare, "nonRecurringShare")}（≥15%），盈利含较多一次性成分`, source: { ...src, field: "nonRecurringShare", value: latest.nonRecurringShare, period: latest.period } });
  }

  if (prev) {
    if (latest.grossMargin > prev.grossMargin) {
      out.push({ stance: "support", type: "fact", claim: `毛利率环比上升：${fmt(prev.grossMargin, "grossMargin")} → ${fmt(latest.grossMargin, "grossMargin")}`, source: { ...src, field: "grossMargin", value: latest.grossMargin, period: latest.period } });
    } else if (latest.grossMargin < prev.grossMargin) {
      out.push({ stance: "against", type: "fact", claim: `毛利率环比下降：${fmt(prev.grossMargin, "grossMargin")} → ${fmt(latest.grossMargin, "grossMargin")}`, source: { ...src, field: "grossMargin", value: latest.grossMargin, period: latest.period } });
    }
  }

  if (latest.netProfitYoy > 0) {
    out.push({ stance: "support", type: "fact", claim: `归母净利润同比 ${fmt(latest.netProfitYoy, "netProfitYoy")}（正增长）`, source: { ...src, field: "netProfitYoy", value: latest.netProfitYoy, period: latest.period } });
  } else {
    out.push({ stance: "against", type: "fact", claim: `归母净利润同比 ${fmt(latest.netProfitYoy, "netProfitYoy")}（下滑）`, source: { ...src, field: "netProfitYoy", value: latest.netProfitYoy, period: latest.period } });
  }

  if (latest.operatingCashflow > 0) {
    out.push({ stance: "support", type: "fact", claim: `经营现金流净额为正（${fmt(latest.operatingCashflow, "operatingCashflow")}）`, source: { ...src, field: "operatingCashflow", value: latest.operatingCashflow, period: latest.period } });
  } else {
    out.push({ stance: "against", type: "fact", claim: `经营现金流净额为负（${fmt(latest.operatingCashflow, "operatingCashflow")}）`, source: { ...src, field: "operatingCashflow", value: latest.operatingCashflow, period: latest.period } });
  }

  return { evidence: out };
}

function valuationInterp(r) {
  const d = r.data;
  const src = { tool: "valuation", ...r.source };
  const out = [];
  if (d.pePercentile < 40) {
    out.push({ stance: "support", type: "fact", claim: `PE 处于历史 ${fmt(d.pePercentile, "pePercentile")} 分位（中低位），估值不贵`, source: { ...src, field: "pePercentile", value: d.pePercentile } });
  } else if (d.pePercentile > 70) {
    out.push({ stance: "against", type: "fact", claim: `PE 处于历史 ${fmt(d.pePercentile, "pePercentile")} 分位（高位），估值偏贵`, source: { ...src, field: "pePercentile", value: d.pePercentile } });
  } else {
    out.push({ stance: "support", type: "inference", claim: `PE 处于历史 ${fmt(d.pePercentile, "pePercentile")} 分位（中枢附近），估值无明显偏离`, source: { ...src, field: "pePercentile", value: d.pePercentile } });
  }
  return { evidence: out };
}

// 行情快照 / K线 / 公告 / 研报：作为「原始材料」呈现，不强行分支持/反对（避免把价格波动当结论）。

function snapshotInterp(r) {
  const d = r.data;
  return { materials: [{ type: "fact", claim: `行情快照（${d.date}）：现价 ${fmt(d.price, "price")}，涨跌幅 ${fmt(d.pct, "pct")}，总市值 ${fmt(d.marketCapBillion, "marketCapBillion")}`, source: { tool: "snapshot", ...r.source } }] };
}

function klineInterp(r) {
  const d = r.data;
  const first = d[0]?.close;
  const last = d[d.length - 1]?.close;
  const chg = first != null && last != null ? (((last - first) / first) * 100).toFixed(1) : null;
  return { materials: [{ type: "fact", claim: `近 ${d.length} 期收盘价 ${first} → ${last}（区间 ${chg}%）`, source: { tool: "kline", ...r.source } }] };
}

function announcementsInterp(r) {
  const materials = (r.data || []).slice(0, 2).map((a) => ({
    type: "reference",
    claim: `[${a.type}] ${a.date}「${a.title}」：${a.summary}`,
    source: { tool: "announcements", ...r.source, field: "announcement", value: a.title, period: a.date },
  }));
  return { materials };
}

function researchInterp(r) {
  const materials = (r.data || []).slice(0, 2).map((x) => ({
    type: "reference",
    claim: `[研报·外部观点，仅供参考] ${x.org}（${x.rating}）${x.date}「${x.title}」：${(x.points || []).join("；")}`,
    source: { tool: "research", ...r.source, field: "research", value: x.title, period: x.date },
  }));
  return { materials };
}

const INTERPRETERS = {
  financials: financialsInterp,
  valuation: valuationInterp,
  snapshot: snapshotInterp,
  kline: klineInterp,
  announcements: announcementsInterp,
  research: researchInterp,
};

// 把单条执行结果转成 { evidence, materials, unverifiable } 三组。
export function extractEvidence(result) {
  if (result.status === "unverifiable" || result.status === "stopped") {
    return {
      evidence: [],
      materials: [],
      unverifiable: [{ claim: `「${result.task.question}」无法验证：${result.reason || "数据缺失/调用失败"}`, source: { tool: result.task.tool, symbol: result.task.symbol } }],
    };
  }
  const interp = INTERPRETERS[result.task.tool];
  if (!interp) {
    return { evidence: [], materials: [], unverifiable: [{ claim: `工具 ${result.task.tool} 暂无解释器`, source: {} }] };
  }
  const { evidence = [], materials = [] } = interp(result.result);
  return { evidence, materials, unverifiable: [] };
}

// 翻转条件：由「支持证据所依赖的字段阈值」反推「什么变了会推翻它」。
const FLIP_RULES = [
  { field: "coreRevenueShare", condition: "若主营收入占比跌破 95%", then: "『盈利主要来自主营』的支持证据失效" },
  { field: "nonRecurringShare", condition: "若非经常性损益占比升至 10% 以上", then: "『盈利含金量高』的支持证据失效" },
  { field: "grossMargin", condition: "若毛利率环比转降", then: "『盈利改善』的支持证据失效" },
  { field: "netProfitYoy", condition: "若净利润同比转负", then: "『正增长』的支持证据失效" },
  { field: "operatingCashflow", condition: "若经营现金流净额转负", then: "『现金流健康』的支持证据失效" },
  { field: "pePercentile", condition: "若 PE 分位升至 70% 以上", then: "『估值不贵』的支持证据失效" },
];

function buildFlipConditions(evidence) {
  const seen = new Set();
  const flips = [];
  for (const e of evidence) {
    if (e.stance !== "support" || !e.source?.field) continue;
    const rule = FLIP_RULES.find((f) => f.field === e.source.field);
    if (rule && !seen.has(rule.field)) {
      seen.add(rule.field);
      flips.push(`${rule.condition}，则「${rule.then}」，当前结论需下调。`);
    }
  }
  if (!flips.length) flips.push("暂无基于阈值的翻转条件（支持证据不足）。");
  return flips;
}

function buildConclusion(name, symbol, evidence, unverifiable) {
  const support = evidence.filter((e) => e.stance === "support");
  const against = evidence.filter((e) => e.stance === "against");
  const kind = support.length === against.length ? "uncertain" : "inference";
  const confidence = Math.max(0.3, Math.min(0.9, 0.5 + 0.1 * (support.length - against.length)));

  let statement;
  if (support.length > against.length) {
    statement = `${name}：证据整体偏正面（支持 ${support.length} 条、反对 ${against.length} 条），核心支撑来自主营业务占比、毛利率与现金流表现。`;
  } else if (against.length > support.length) {
    statement = `${name}：证据整体偏负面（支持 ${support.length} 条、反对 ${against.length} 条），盈利质量或估值存在压力。`;
  } else {
    statement = `${name}：支持与反对证据相当（各 ${support.length} 条），尚不足以形成明确倾向。`;
  }
  if (unverifiable.length) statement += ` 另有 ${unverifiable.length} 项因数据缺失/失败无法验证。`;

  const conflicts = [];
  if (support.length && against.length) {
    conflicts.push({ between: "支持/反对证据并存", resolution: "以主营业务相关指标（主营占比、非经常损益、毛利率趋势）为主、估值为辅综合判断；相反证据未被忽略，已如实列出。" });
  }

  return {
    symbol,
    name,
    statement,
    kind,
    confidence,
    flipConditions: buildFlipConditions(evidence),
    conflicts,
    supportCount: support.length,
    againstCount: against.length,
    unverifiableCount: unverifiable.length,
  };
}

export function synthesize(goal, results) {
  const bySymbol = {};
  for (const r of results) {
    const symbol = r.task.symbol;
    if (!bySymbol[symbol]) {
      bySymbol[symbol] = { symbol, name: r.result?.source?.name || symbol, evidence: [], materials: [], unverifiable: [] };
    }
    const { evidence = [], materials = [], unverifiable = [] } = extractEvidence(r);
    bySymbol[symbol].evidence.push(...evidence);
    bySymbol[symbol].materials.push(...materials);
    bySymbol[symbol].unverifiable.push(...unverifiable);
  }

  const perSymbol = {};
  for (const s of Object.keys(bySymbol)) {
    const g = bySymbol[s];
    perSymbol[s] = { ...g, conclusion: buildConclusion(g.name, g.symbol, g.evidence, g.unverifiable) };
  }

  const comparison = Object.keys(perSymbol).map((s) => {
    const c = perSymbol[s].conclusion;
    return { symbol: s, name: perSymbol[s].name, supportCount: c.supportCount, againstCount: c.againstCount, unverifiableCount: c.unverifiableCount, kind: c.kind };
  });

  return { goal, bySymbol: perSymbol, comparison, disclaimer: DISCLAIMER };
}
