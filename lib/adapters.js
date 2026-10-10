// 数据适配层：把「工具」和「数据从哪来」解耦。
// 为什么需要这一层？题目要求「能力以实际可调用工具为准」，而且要能切换
// 扶摇 / iFinD。mock 是示例数据跑通链路；扶摇是真实 HTTP 数据；iFinD 是 MCP。
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

// ===== 扶摇（同花顺金融数据 API）=====
// 文档：https://fuyao.aicubes.cn/docs/ ；认证用请求头 `X-api-key`；
// 统一响应信封 { code:0, message, request_id, data:{ timestamp, item[] } }，code=0 成功。
const FUYAO_BASE = "https://fuyao.aicubes.cn";

// 业务错误码 → 可读说明（不把原始错误吞掉，而是带原因降级）。
const FUYAO_ERR = {
  1001: "缺少参数",
  1002: "参数格式错误",
  1003: "参数越界",
  1004: "参数冲突",
  2001: "未认证（API Key 无效或缺失）",
  2003: "权限不足",
  3001: "标的不存在",
  3002: "数据未就绪",
  3004: "类型不支持",
};

// 6 位股票代码 → 扶摇 thscode（带交易所后缀）：60/68→沪，00/30→深，8/4→北。
export function toThsStock(symbol) {
  const s = String(symbol || "").trim();
  if (/^(60|68)/.test(s)) return `${s}.SH`;
  if (/^(00|30)/.test(s)) return `${s}.SZ`;
  if (/^(8|4)/.test(s)) return `${s}.BJ`;
  return null;
}

// 指数代码 → thscode：399xxx→深，8xxxxx→北，其余（000xxx 等）→沪。
export function toThsIndex(symbol) {
  const s = String(symbol || "").trim();
  if (/^399/.test(s)) return `${s}.SZ`;
  if (/^8/.test(s)) return `${s}.BJ`;
  return `${s}.SH`;
}

// 毫秒时间戳 → YYYY-MM-DD（本地时区）。
export function fmtDate(ms) {
  if (ms == null) return "";
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// 同比增速：本期 vs 上期。分母 ≤0 时无法给出有意义的百分比，诚实返回 null。
export function yoy(latest, prev) {
  if (latest == null || prev == null || prev === 0) return null;
  return Number((((latest - prev) / Math.abs(prev)) * 100).toFixed(2));
}

// 原币（元）→ 亿元。
export const toYi = (v) => (v == null ? null : Number((v / 1e8).toFixed(3)));

export const fuyaoAdapter = {
  name: "fuyao",
  _nameCache: new Map(),

  // 统一 GET：拼 query、带 X-api-key、解析信封、业务错误带码带原因返回。
  async _get(path, params = {}) {
    const key = process.env.FUYAO_API_KEY;
    if (!key) return unavailable("扶摇未配置 API Key（请在 .env.local 设置 FUYAO_API_KEY）");
    const base = process.env.FUYAO_BASE_URL || FUYAO_BASE;
    const url = new URL(path, base);
    for (const [k, v] of Object.entries(params)) {
      if (v != null && v !== "") url.searchParams.set(k, String(v));
    }
    try {
      const r = await fetch(url, {
        headers: { "X-api-key": key },
        signal: AbortSignal.timeout(15000),
      });
      if (!r.ok) return unavailable(`扶摇 HTTP ${r.status}`);
      const body = await r.json();
      if (body.code !== 0) {
        return unavailable(`扶摇业务错误 ${body.code}（${FUYAO_ERR[body.code] || "未知错误"}${body.message ? `：${body.message}` : ""}）`);
      }
      return { ok: true, data: body.data || {}, meta: {} };
    } catch (e) {
      return unavailable(`扶摇调用失败：${e.message}`);
    }
  },

  // 解析证券名：快照/财务接口不返回名称，用 meta 检索补上；查不到也不阻断数据。
  async _name(symbol) {
    if (this._nameCache.has(symbol)) return this._nameCache.get(symbol);
    const code = toThsStock(symbol);
    let name;
    if (code) {
      const r = await this._get("/api/meta/tickers/search", { q: code, asset_type: "a-share", limit: 5 });
      if (r.ok) {
        const item = (r.data.item || []).find((x) => x.thscode === code) || r.data.item?.[0];
        name = item?.name;
      }
    }
    this._nameCache.set(symbol, name);
    return name;
  },

  async snapshot(symbol) {
    const code = toThsStock(symbol);
    if (!code) return unavailable(`无法识别股票代码 ${symbol}（应为 6 位，如 600519 / 300750）`);
    const r = await this._get("/api/a-share/prices/snapshot", { thscodes: code });
    if (!r.ok) return r;
    const it = r.data.item?.[0];
    if (!it) return unavailable(`扶摇未返回 ${symbol} 的行情快照`);
    const name = await this._name(symbol);
    return {
      ok: true,
      data: {
        date: fmtDate(r.data.timestamp),
        price: it.last_price,
        pct: it.price_change_ratio_pct,
        turnoverBillion: toYi(it.turnover), // 成交额（原币元 → 亿元）
        volumeBillion: null, // 快照成交量单位口径未在文档明确，不硬凑
        marketCapBillion: null, // 快照接口不含总市值
      },
      meta: { name },
    };
  },

  async valuation(symbol) {
    const code = toThsStock(symbol);
    if (!code) return unavailable(`无法识别股票代码 ${symbol}（应为 6 位，如 600519 / 300750）`);
    const r = await this._get("/api/a-share/valuations/snapshot", { thscodes: code });
    if (!r.ok) return r;
    const it = r.data.item?.[0];
    if (!it) return unavailable(`扶摇未返回 ${symbol} 的估值数据`);
    return {
      ok: true,
      data: {
        pe: it.pe_ttm,
        pb: it.pb_mrq,
        ps: it.ps_ttm,
        pcf: it.pcf_ttm,
        pePercentile: null, // 扶摇不提供历史估值分位，诚实置空
        pbPercentile: null,
        date: fmtDate(r.data.timestamp),
      },
      meta: { name: it.name },
    };
  },

  async financials(symbol) {
    const code = toThsStock(symbol);
    if (!code) return unavailable(`无法识别股票代码 ${symbol}（应为 6 位，如 600519 / 300750）`);
    // 利润表（营收/营业成本/归母净利）+ 现金流量表（经营现金流），按年度合并。
    const [inc, cf] = await Promise.all([
      this._get("/api/a-share/financials/income-statements", { thscode: code, period: "annual", limit: 4 }),
      this._get("/api/a-share/financials/cash-flow-statements", { thscode: code, period: "annual", limit: 4 }),
    ]);
    if (!inc.ok) return inc;
    const items = (inc.data.item || []).slice().sort((a, b) => (b.fiscal_year || 0) - (a.fiscal_year || 0));
    if (!items.length) return unavailable(`扶摇未返回 ${symbol} 的财报数据`);
    const cfByYear = {};
    if (cf.ok) for (const c of cf.data.item || []) cfByYear[c.fiscal_year] = c;
    const name = await this._name(symbol);
    const rows = items.map((it, i) => {
      const prev = items[i + 1];
      const cfit = cfByYear[it.fiscal_year];
      return {
        period: String(it.fiscal_year),
        revenue: toYi(it.operating_income),
        revenueYoy: yoy(it.operating_income, prev?.operating_income),
        netProfit: toYi(it.parent_holder_net_profit),
        netProfitYoy: yoy(it.parent_holder_net_profit, prev?.parent_holder_net_profit),
        grossMargin:
          it.operating_income && it.operating_costs != null
            ? Number((((it.operating_income - it.operating_costs) / it.operating_income) * 100).toFixed(2))
            : null,
        operatingCashflow: toYi(cfit?.act_cash_flow_net),
        coreRevenueShare: null, // 扶摇无主营收入拆分，不硬凑
        nonRecurringShare: null, // 扶摇无扣非/非经常性损益拆分，不硬凑
        roe: null,
      };
    });
    return { ok: true, data: rows, meta: { name } };
  },

  async kline(symbol) {
    const code = toThsStock(symbol);
    if (!code) return unavailable(`无法识别股票代码 ${symbol}（应为 6 位，如 600519 / 300750）`);
    const end = Date.now();
    const start = end - 200 * 24 * 3600 * 1000; // 约 200 个自然日
    const r = await this._get("/api/a-share/prices/historical", { thscode: code, interval: "1d", start, end, adjust: "forward" });
    if (!r.ok) return r;
    const items = r.data.item || [];
    if (!items.length) return unavailable(`扶摇未返回 ${symbol} 的 K 线数据`);
    const name = await this._name(symbol);
    return {
      ok: true,
      data: items.map((it) => ({ date: fmtDate(it.date_ms), close: it.close_price })),
      meta: { name },
    };
  },

  // 扶摇暂不提供 A 股公告 / 研报接口，诚实返回不可用（不编造数据）。
  async announcements(symbol) {
    return unavailable("扶摇暂不提供 A 股公告接口（能力以实际可调用工具为准）");
  },
  async research(symbol) {
    return unavailable("扶摇暂不提供研报接口（能力以实际可调用工具为准）");
  },

  async index(symbol) {
    const code = toThsIndex(symbol);
    const r = await this._get("/api/a-share-index/prices/snapshot", { thscodes: code });
    if (!r.ok) return r;
    const it = r.data.item?.[0];
    if (!it) return unavailable(`扶摇未返回指数 ${symbol} 的行情`);
    return {
      ok: true,
      data: { symbol, name: symbol, points: it.last_price, pct: it.price_change_ratio_pct, date: fmtDate(r.data.timestamp) },
      meta: { name: symbol },
    };
  },
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
