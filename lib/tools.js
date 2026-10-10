// 能力/工具注册表：Agent 能调用的所有金融工具在这里集中登记。
// 这是题目第一条要求「能力/工具注册」的落点。每个工具声明名称、描述、
// 入参、分类；描述会喂给规划器，让它决定「这个研究目标该用哪些工具」。

import { getAdapter } from "./adapters.js";
import { UNITS } from "./data/mock.js";

// 每个工具返回里都带上 source 块，供结论追溯「来源、标的、时点」。
function source(provider, symbol, meta = {}) {
  return { provider, symbol, asOf: "2026-10-09", ...meta };
}

export const TOOLS = [
  {
    name: "snapshot",
    category: "行情",
    description: "查询 A 股某只股票的行情快照：现价、涨跌幅、成交量、总市值。入参 symbol 为 6 位代码。",
    parameters: { symbol: "string" },
    async run({ symbol }) {
      const a = getAdapter();
      const r = await a.snapshot(symbol);
      if (!r.ok) return r;
      return { ok: true, source: source(a.name, symbol, { name: r.meta?.name }), data: r.data, units: UNITS };
    },
  },
  {
    name: "valuation",
    category: "估值",
    description: "查询估值指标：市盈率 PE、市净率 PB 及其历史分位（分位越低越便宜）。",
    parameters: { symbol: "string" },
    async run({ symbol }) {
      const a = getAdapter();
      const r = await a.valuation(symbol);
      if (!r.ok) return r;
      return { ok: true, source: source(a.name, symbol, { name: r.meta?.name }), data: r.data, units: UNITS };
    },
  },
  {
    name: "financials",
    category: "财务",
    description: "查询季度财务指标：营收、归母净利润、同比增速、毛利率、主营收入占比、非经常性损益占比、经营现金流、ROE。",
    parameters: { symbol: "string" },
    async run({ symbol }) {
      const a = getAdapter();
      const r = await a.financials(symbol);
      if (!r.ok) return r;
      return { ok: true, source: source(a.name, symbol, { name: r.meta?.name }), data: r.data, units: UNITS };
    },
  },
  {
    name: "kline",
    category: "行情",
    description: "查询历史 K 线收盘价序列，用于观察价格趋势。",
    parameters: { symbol: "string" },
    async run({ symbol }) {
      const a = getAdapter();
      const r = await a.kline(symbol);
      if (!r.ok) return r;
      return { ok: true, source: source(a.name, symbol, { name: r.meta?.name }), data: r.data, units: UNITS };
    },
  },
  {
    name: "announcements",
    category: "公告",
    description: "查询公司公告（定期报告、经营动态等）及摘要。",
    parameters: { symbol: "string" },
    async run({ symbol }) {
      const a = getAdapter();
      const r = await a.announcements(symbol);
      if (!r.ok) return r;
      return { ok: true, source: source(a.name, symbol, { name: r.meta?.name }), data: r.data };
    },
  },
  {
    name: "research",
    category: "研报",
    description: "查询券商研究观点与评级（仅作参考，不构成投资建议）。",
    parameters: { symbol: "string" },
    async run({ symbol }) {
      const a = getAdapter();
      const r = await a.research(symbol);
      if (!r.ok) return r;
      return { ok: true, source: source(a.name, symbol, { name: r.meta?.name }), data: r.data };
    },
  },
  {
    name: "index",
    category: "指数",
    description: "查询指数点位与涨跌幅（如沪深300=000300）。",
    parameters: { symbol: "string" },
    async run({ symbol }) {
      const a = getAdapter();
      const r = await a.index(symbol);
      if (!r.ok) return r;
      return { ok: true, source: source(a.name, symbol, { name: r.meta?.name }), data: r.data, units: UNITS };
    },
  },
];

export function findTool(name) {
  return TOOLS.find((t) => t.name === name);
}

// 把工具清单拼成文字，喂给规划器做工具选择。
export function toolListForPlanner() {
  return TOOLS.map((t) => `${t.name}（${t.category}）：${t.description}`).join("\n");
}
