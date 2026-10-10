// 数据适配层：把「工具」和「数据从哪来」解耦。
// 为什么需要这一层？题目要求「能力以实际可调用工具为准」，而且要能切换
// 扶摇 / iFinD。现在默认用 mock（示例数据）跑通链路；以后接入真数据时，
// 只在这里加适配器，不改任何工具或 Agent 代码。
//
// 关键设计：数据源不可用时【不抛异常】，而是返回 { ok:false, reason }，
// 让上层明确降级成「无法验证」，而不是假装有数据下「正常」结论（合规红线）。

import { MOCK_DATA } from "./data/mock.js";

function dataSource() {
  return process.env.DATA_SOURCE || "mock"; // mock | fuyao | ifind
}

function unavailable(reason) {
  return { ok: false, reason, data: null };
}

const mockAdapter = {
  name: "mock",
  async snapshot(symbol) {
    const s = MOCK_DATA.stocks[symbol];
    return s ? { ok: true, data: s.snapshot, meta: { name: s.name, industry: s.industry } } : unavailable(`示例数据中无 ${symbol}`);
  },
  async valuation(symbol) {
    const s = MOCK_DATA.stocks[symbol];
    return s ? { ok: true, data: s.valuation, meta: { name: s.name } } : unavailable(`示例数据中无 ${symbol}`);
  },
  async financials(symbol) {
    const s = MOCK_DATA.stocks[symbol];
    return s ? { ok: true, data: s.financials, meta: { name: s.name } } : unavailable(`示例数据中无 ${symbol}`);
  },
  async kline(symbol) {
    const s = MOCK_DATA.stocks[symbol];
    return s ? { ok: true, data: s.kline, meta: { name: s.name } } : unavailable(`示例数据中无 ${symbol}`);
  },
  async announcements(symbol) {
    const s = MOCK_DATA.stocks[symbol];
    return s ? { ok: true, data: s.announcements, meta: { name: s.name } } : unavailable(`示例数据中无 ${symbol}`);
  },
  async research(symbol) {
    const s = MOCK_DATA.stocks[symbol];
    return s ? { ok: true, data: s.research, meta: { name: s.name } } : unavailable(`示例数据中无 ${symbol}`);
  },
  async index(symbol) {
    const i = MOCK_DATA.indexes[symbol];
    return i ? { ok: true, data: i, meta: { name: i.name } } : unavailable(`示例数据中无 ${symbol}`);
  },
};

// 扶摇适配器：文档 https://fuyao.aicubes.cn/docs/。
// 这里给出真实 HTTP 对接的骨架；未配置 key 或调用失败时，统一降级为「不可用」。
// 具体端点以官方文档为准，路径仅为示例。
const fuyaoAdapter = {
  name: "fuyao",
  async _get(path) {
    const base = process.env.FUYAO_BASE_URL;
    const key = process.env.FUYAO_API_KEY;
    if (!base || !key) return unavailable("扶摇未配置（需 FUYAO_BASE_URL 与 FUYAO_API_KEY）");
    try {
      const r = await fetch(`${base}${path}`, { headers: { Authorization: `Bearer ${key}` } });
      if (!r.ok) return unavailable(`扶摇返回 ${r.status}`);
      return { ok: true, data: await r.json(), meta: {} };
    } catch (e) {
      return unavailable(`扶摇调用失败：${e.message}`);
    }
  },
  async snapshot(symbol) { return this._get(`/v1/snapshot?symbol=${symbol}`); },
  async valuation(symbol) { return this._get(`/v1/valuation?symbol=${symbol}`); },
  async financials(symbol) { return this._get(`/v1/financials?symbol=${symbol}`); },
  async kline(symbol) { return this._get(`/v1/kline?symbol=${symbol}`); },
  async announcements(symbol) { return this._get(`/v1/announcements?symbol=${symbol}`); },
  async research(symbol) { return this._get(`/v1/research?symbol=${symbol}`); },
  async index(symbol) { return this._get(`/v1/index?symbol=${symbol}`); },
};

// iFinD 是 MCP 协议（https://mcp.51ifind.com/），接入需要 MCP client。
// 这里留接口位，README 里说明未做事项。所有方法诚实返回「不可用」。
function stubAdapter(name, note) {
  const methods = ["snapshot", "valuation", "financials", "kline", "announcements", "research", "index"];
  const adapter = { name };
  for (const m of methods) {
    adapter[m] = async () => unavailable(`${name} 数据源未接入（${note}），方法 ${m} 不可用`);
  }
  return adapter;
}

const ifindAdapter = stubAdapter("ifind", "需 MCP client 对接");

const ADAPTERS = { mock: mockAdapter, fuyao: fuyaoAdapter, ifind: ifindAdapter };

export function getAdapter() {
  return ADAPTERS[dataSource()] || mockAdapter;
}
