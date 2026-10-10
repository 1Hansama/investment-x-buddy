// 示例数据（模拟数据）。用于在没有扶摇/iFinD 接口权限时跑通主链路。
// 重要：所有数值都是构造的，仅供演示产品流程，不是真实行情/财报。
// 每个数值都带单位与期间，供结论追溯来源时引用。

export const MOCK_DATA = {
  stocks: {
    "300750": {
      symbol: "300750",
      name: "宁德时代",
      industry: "电池",
      snapshot: {
        price: 245.3,
        pct: 1.24,
        volumeBillion: 3.82,
        marketCapBillion: 10800,
        date: "2026-10-09",
      },
      valuation: {
        pe: 18.6,
        pePercentile: 34,
        pb: 4.1,
        pbPercentile: 41,
        date: "2026-10-09",
      },
      financials: [
        { period: "2026Q2", revenue: 950.0, revenueYoy: 18.2, netProfit: 118.0, netProfitYoy: 24.1, grossMargin: 23.4, coreRevenueShare: 98.2, nonRecurringShare: 3.1, operatingCashflow: 152.0, roe: 8.9 },
        { period: "2026Q1", revenue: 890.0, revenueYoy: 15.8, netProfit: 105.0, netProfitYoy: 19.3, grossMargin: 22.1, coreRevenueShare: 98.0, nonRecurringShare: 4.2, operatingCashflow: 118.0, roe: 8.1 },
        { period: "2025Q4", revenue: 1000.0, revenueYoy: 12.5, netProfit: 120.0, netProfitYoy: 11.0, grossMargin: 21.8, coreRevenueShare: 97.6, nonRecurringShare: 5.0, operatingCashflow: 140.0, roe: 8.6 },
        { period: "2025Q3", revenue: 880.0, revenueYoy: 10.1, netProfit: 100.0, netProfitYoy: 8.6, grossMargin: 20.9, coreRevenueShare: 97.4, nonRecurringShare: 5.4, operatingCashflow: 96.0, roe: 7.7 },
      ],
      kline: [
        { date: "2026-06-30", close: 232.1 },
        { date: "2026-07-31", close: 239.8 },
        { date: "2026-08-31", close: 241.5 },
        { date: "2026-09-30", close: 242.2 },
        { date: "2026-10-09", close: 245.3 },
      ],
      announcements: [
        { date: "2026-08-28", type: "定期报告", title: "2026 年半年度报告", summary: "上半年营收同比 +16.9%，归母净利润同比 +21.6%，毛利率环比改善 1.3pct；动力电池出货量维持全球第一。" },
        { date: "2026-07-15", type: "经营动态", title: "关于新设欧洲生产基地的公告", summary: "拟于欧洲新建 20GWh 产能，预计 2028 年投产。" },
      ],
      research: [
        { date: "2026-09-02", org: "示例券商A", rating: "增持", title: "盈利质量改善，份额与毛利双升", points: ["主营收入占比维持 98% 以上", "非经常性损益占比降至 3.1%", "PE 处于近三年约 34% 分位"] },
      ],
    },
    "600519": {
      symbol: "600519",
      name: "贵州茅台",
      industry: "白酒",
      snapshot: {
        price: 1680.0,
        pct: 0.55,
        volumeBillion: 0.52,
        marketCapBillion: 21100,
        date: "2026-10-09",
      },
      valuation: {
        pe: 24.2,
        pePercentile: 58,
        pb: 8.9,
        pbPercentile: 55,
        date: "2026-10-09",
      },
      financials: [
        { period: "2026Q2", revenue: 465.0, revenueYoy: 12.0, netProfit: 226.0, netProfitYoy: 13.2, grossMargin: 91.2, coreRevenueShare: 99.6, nonRecurringShare: 0.4, operatingCashflow: 240.0, roe: 11.2 },
        { period: "2026Q1", revenue: 420.0, revenueYoy: 11.4, netProfit: 205.0, netProfitYoy: 12.1, grossMargin: 91.0, coreRevenueShare: 99.5, nonRecurringShare: 0.5, operatingCashflow: 210.0, roe: 10.1 },
      ],
      kline: [
        { date: "2026-08-31", close: 1650.0 },
        { date: "2026-09-30", close: 1671.0 },
        { date: "2026-10-09", close: 1680.0 },
      ],
      announcements: [
        { date: "2026-08-29", type: "定期报告", title: "2026 年半年度报告", summary: "营收、净利双位数增长，直销占比提升，毛利率保持 91% 以上。" },
      ],
      research: [
        { date: "2026-09-05", org: "示例券商B", rating: "买入", title: "高端白酒龙头，现金流稳健", points: ["经营现金流净额持续为正", "非经常性损益占比极低"] },
      ],
    },
    "601012": {
      symbol: "601012",
      name: "隆基绿能",
      industry: "光伏",
      snapshot: {
        price: 18.6,
        pct: -2.1,
        volumeBillion: 9.14,
        marketCapBillion: 1400,
        date: "2026-10-09",
      },
      valuation: {
        pe: 32.5,
        pePercentile: 71,
        pb: 2.2,
        pbPercentile: 62,
        date: "2026-10-09",
      },
      financials: [
        { period: "2026Q2", revenue: 210.0, revenueYoy: -8.0, netProfit: -12.0, netProfitYoy: -240.0, grossMargin: 8.1, coreRevenueShare: 88.0, nonRecurringShare: 22.0, operatingCashflow: -18.0, roe: -1.8 },
        { period: "2026Q1", revenue: 230.0, revenueYoy: -3.5, netProfit: 2.0, netProfitYoy: -85.0, grossMargin: 9.5, coreRevenueShare: 90.0, nonRecurringShare: 15.0, operatingCashflow: -8.0, roe: 0.3 },
      ],
      kline: [
        { date: "2026-08-31", close: 20.1 },
        { date: "2026-09-30", close: 19.0 },
        { date: "2026-10-09", close: 18.6 },
      ],
      announcements: [
        { date: "2026-08-30", type: "定期报告", title: "2026 年半年度报告", summary: "行业产能过剩、价格下行，公司毛利率承压，上半年由盈转亏。" },
      ],
      research: [
        { date: "2026-09-06", org: "示例券商C", rating: "中性", title: "价格战下盈利承压，等待行业出清", points: ["毛利率降至 8% 附近", "非经常性损益对利润影响上升"] },
      ],
    },
  },
  indexes: {
    "000300": { symbol: "000300", name: "沪深300", points: 4021.5, pct: 0.42, date: "2026-10-09" },
    "000905": { symbol: "000905", name: "中证500", points: 5980.3, pct: 0.88, date: "2026-10-09" },
  },
};

// 工具返回里统一使用的字段单位表，供前端展示和结论引用（口径可追溯）。
export const UNITS = {
  revenue: "亿元",
  revenueYoy: "%",
  netProfit: "亿元",
  netProfitYoy: "%",
  grossMargin: "%",
  coreRevenueShare: "%",
  nonRecurringShare: "%",
  operatingCashflow: "亿元",
  roe: "%",
  pe: "倍",
  pePercentile: "%",
  pb: "倍",
  pbPercentile: "%",
  price: "元",
  pct: "%",
  volumeBillion: "亿股",
  marketCapBillion: "亿元",
  points: "点",
};
