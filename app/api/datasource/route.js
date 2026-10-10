// 数据源自检接口：返回当前运行时真正生效的数据源与扶摇 Key 是否已配置。
// 用途：① 部署排障（确认环境变量是否进入了 Node 运行时）；② 作为可观测性的一部分。
// 注意：不返回任何密钥明文，只返回「是否已配置」的布尔值。
export async function GET() {
  return Response.json({
    dataSource: process.env.DATA_SOURCE || "mock",
    fuyaoKeyConfigured: Boolean(process.env.FUYAO_API_KEY),
    llm: process.env.DEEPSEEK_API_KEY ? "deepseek" : "offline-fallback",
    nodeEnv: process.env.NODE_ENV || "(未设置)",
  });
}
