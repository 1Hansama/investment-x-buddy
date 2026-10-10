// 扶摇连通性冒烟测试：验证真实 API 是否打通、字段是否正常归一化。
// 用法：node scripts/smoke-fuyao.mjs 600519 300750
// 前提：.env.local 里已配置 FUYAO_API_KEY（登录 https://fuyao.aicubes.cn 创建）。
// 本脚本仅本地验证用，不参与构建，也不会把 Key 打出去。

import { readFileSync } from "node:fs";
import { fuyaoAdapter } from "../lib/adapters.js";

// 手动读入 .env.local（独立脚本不会走 Next.js 的 env 加载）。
function loadEnvLocal() {
  try {
    const txt = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
    for (const line of txt.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/);
      if (m && process.env[m[1]] == null) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    /* 无 .env.local 时交给下面的提示 */
  }
}

loadEnvLocal();

const symbols = process.argv.slice(2);
if (!symbols.length) {
  console.log("用法：node scripts/smoke-fuyao.mjs 600519 300750");
  process.exit(1);
}
if (!process.env.FUYAO_API_KEY) {
  console.log("未检测到 FUYAO_API_KEY。请在 .env.local 填入后重试（登录 https://fuyao.aicubes.cn 创建）。");
  process.exit(1);
}

for (const s of symbols) {
  console.log(`\n===== ${s} =====`);
  const snap = await fuyaoAdapter.snapshot(s);
  console.log("[快照]", JSON.stringify(snap));
  const val = await fuyaoAdapter.valuation(s);
  console.log("[估值]", JSON.stringify(val));
  const fin = await fuyaoAdapter.financials(s);
  console.log("[财报前2期]", JSON.stringify(fin.ok ? fin.data.slice(0, 2) : fin));
}
