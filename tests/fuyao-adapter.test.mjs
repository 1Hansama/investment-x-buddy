// 扶摇真实数据适配器测试：不联网、不需要 API Key，通过替换全局 fetch
// 返回官方的响应信封，验证「真实端点解析 + 字段归一化 + 诚实降级」这一条代码路径。
// 说明：node --test 每个文件单独进程，替换 globalThis.fetch 不影响其它用例。

import { test } from "node:test";
import assert from "node:assert/strict";
import { toThsStock, toThsIndex, yoy, toYi, fuyaoAdapter } from "../lib/adapters.js";

const TS = 1728451200000;

function jsonResponse(body) {
  return { ok: true, status: 200, json: async () => body };
}

// 按官方文档构造各端点的响应信封。
function fuyaoFetch(url) {
  const u = String(url);
  if (u.includes("/a-share/prices/snapshot")) {
    return jsonResponse({ code: 0, data: { timestamp: TS, item: [{ thscode: "600519.SH", last_price: 1680, price_change_ratio_pct: 0.55, turnover: 5.2e9 }] } });
  }
  if (u.includes("/a-share/valuations/snapshot")) {
    return jsonResponse({ code: 0, data: { timestamp: TS, item: [{ thscode: "600519.SH", name: "贵州茅台", pe_ttm: 24.2, pb_mrq: 8.9, ps_ttm: 15.0, pcf_ttm: 20.0 }] } });
  }
  if (u.includes("/income-statements")) {
    return jsonResponse({ code: 0, data: { timestamp: TS, item: [
      { fiscal_year: 2025, operating_income: 1.7e11, operating_costs: 1.4e10, parent_holder_net_profit: 8.6e10 },
      { fiscal_year: 2024, operating_income: 1.5e11, operating_costs: 1.2e10, parent_holder_net_profit: 7.7e10 },
    ] } });
  }
  if (u.includes("/cash-flow-statements")) {
    return jsonResponse({ code: 0, data: { timestamp: TS, item: [
      { fiscal_year: 2025, act_cash_flow_net: 8.0e10 },
      { fiscal_year: 2024, act_cash_flow_net: 7.5e10 },
    ] } });
  }
  if (u.includes("/a-share/prices/historical")) {
    return jsonResponse({ code: 0, data: { timestamp: TS, item: [
      { date_ms: TS, close_price: 1680 },
      { date_ms: TS - 86400000, close_price: 1671 },
    ] } });
  }
  if (u.includes("/tickers/search")) {
    return jsonResponse({ code: 0, data: { item: [{ thscode: "600519.SH", ticker: "600519", name: "贵州茅台" }] } });
  }
  if (u.includes("/a-share-index/prices/snapshot")) {
    return jsonResponse({ code: 0, data: { timestamp: TS, item: [{ last_price: 4021.5, price_change_ratio_pct: 0.42 }] } });
  }
  return jsonResponse({ code: 3001, message: "标的不存在" });
}

test.beforeEach(() => {
  process.env.FUYAO_API_KEY = "test-key";
  globalThis.fetch = fuyaoFetch;
});

test("扶摇：股票代码 → thscode（交易所后缀）", () => {
  assert.equal(toThsStock("600519"), "600519.SH");
  assert.equal(toThsStock("688981"), "688981.SH");
  assert.equal(toThsStock("300750"), "300750.SZ");
  assert.equal(toThsStock("000001"), "000001.SZ");
  assert.equal(toThsStock("830799"), "830799.BJ");
  assert.equal(toThsStock("430047"), "430047.BJ");
  assert.equal(toThsStock("999"), null);
});

test("扶摇：指数代码 → thscode", () => {
  assert.equal(toThsIndex("000300"), "000300.SH");
  assert.equal(toThsIndex("399001"), "399001.SZ");
  assert.equal(toThsIndex("899050"), "899050.BJ");
});

test("扶摇：同比 / 元转亿 的边界处理诚实", () => {
  assert.equal(yoy(120, 100), 20);
  assert.equal(yoy(50, 100), -50);
  assert.equal(yoy(100, 0), null); // 分母为 0，无法给百分比 → null
  assert.equal(yoy(100, null), null);
  assert.equal(yoy(null, 100), null);
  assert.equal(toYi(1e8), 1);
  assert.equal(toYi(123456789), 1.235);
  assert.equal(toYi(null), null);
});

test("扶摇：行情快照归一化 + 名称解析 + 诚实置空缺失字段", async () => {
  const r = await fuyaoAdapter.snapshot("600519");
  assert.equal(r.ok, true);
  assert.equal(r.data.price, 1680);
  assert.equal(r.data.pct, 0.55);
  assert.equal(r.data.turnoverBillion, 52); // 5.2e9 元 → 52 亿元
  assert.equal(r.data.marketCapBillion, null); // 快照接口不含总市值
  assert.equal(r.meta.name, "贵州茅台"); // 名称来自 meta 检索
});

test("扶摇：估值归一化，历史分位诚实置空", async () => {
  const r = await fuyaoAdapter.valuation("600519");
  assert.equal(r.ok, true);
  assert.equal(r.data.pe, 24.2);
  assert.equal(r.data.pb, 8.9);
  assert.equal(r.data.ps, 15.0);
  assert.equal(r.data.pcf, 20.0);
  assert.equal(r.data.pePercentile, null); // 扶摇不提供历史分位
  assert.equal(r.meta.name, "贵州茅台");
});

test("扶摇：财报按年度合并、计算毛利率/同比/现金流，缺失口径置空", async () => {
  const r = await fuyaoAdapter.financials("600519");
  assert.equal(r.ok, true);
  const latest = r.data[0];
  assert.equal(latest.period, "2025");
  assert.equal(latest.revenue, 1700); // 1.7e11 元 → 1700 亿元
  assert.equal(latest.grossMargin, 91.76); // (1.7e11-1.4e10)/1.7e11
  assert.equal(latest.netProfit, 860); // 8.6e10 元 → 860 亿元
  assert.equal(latest.netProfitYoy, 11.69); // (8.6-7.7)/7.7
  assert.equal(latest.operatingCashflow, 800); // 8.0e10 元 → 800 亿元
  assert.equal(latest.coreRevenueShare, null); // 扶摇无主营拆分
  assert.equal(latest.nonRecurringShare, null); // 扶摇无扣非拆分
  assert.equal(latest.roe, null);
});

test("扶摇：K 线 / 指数归一化", async () => {
  const k = await fuyaoAdapter.kline("600519");
  assert.equal(k.ok, true);
  assert.equal(k.data.length, 2);
  assert.equal(k.data[0].close, 1680);

  const idx = await fuyaoAdapter.index("000300");
  assert.equal(idx.ok, true);
  assert.equal(idx.data.points, 4021.5);
  assert.equal(idx.data.pct, 0.42);
});

test("扶摇：公告/研报无接口，诚实返回不可用（不编造）", async () => {
  const ann = await fuyaoAdapter.announcements("600519");
  assert.equal(ann.ok, false);
  assert.match(ann.reason, /不提供/);
  const res = await fuyaoAdapter.research("600519");
  assert.equal(res.ok, false);
  assert.match(res.reason, /不提供/);
});

test("扶摇：未配置 Key 时诚实降级，而非抛异常", async () => {
  delete process.env.FUYAO_API_KEY;
  const r = await fuyaoAdapter.snapshot("600519");
  assert.equal(r.ok, false);
  assert.match(r.reason, /FUYAO_API_KEY/);
});
