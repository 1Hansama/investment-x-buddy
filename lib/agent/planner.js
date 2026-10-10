// 规划器：把「研究目标」拆成可验证的子问题（任务），并为每个任务选工具。
// 这是 Agent 的「计划」环节。有 LLM 时用 DeepSeek 拆解；没有 key 时用
// 离线规则兜底（识别关键词 -> 固定任务模板），保证主链路始终可跑。

import { hasLLM, chat, parseJSON } from "../llm.js";
import { toolListForPlanner } from "../tools.js";

const SYSTEM = `你是一名严谨的 A 股基本面研究员。你的任务是把用户的研究目标拆成一组「能调用数据工具验证」的子问题。
约束：
1. 每个子问题必须能用给定工具之一回答，并指定该工具名和 6 位股票代码。
2. 不输出任何确定性涨跌预测、收益承诺或买卖建议。
3. 子问题要具体、可证伪，数量控制在 3-6 个。
只返回 JSON，格式：{"tasks":[{"question":"...","tool":"financials|valuation|snapshot|kline|announcements|research|index","symbol":"000000"}]}`;

// 离线兜底：识别研究目标里的关键词，套用固定研究模板。
function fallbackPlan(goal) {
  const symbols = [...goal.matchAll(/\b(\d{6})\b/g)].map((m) => m[1]);
  const unique = [...new Set(symbols)];
  const targets = unique.length ? unique : ["300750", "600519"];

  const tasks = [];
  for (const symbol of targets) {
    tasks.push({ question: `${symbol} 财务指标是否验证「盈利改善」？`, tool: "financials", symbol });
    tasks.push({ question: `${symbol} 当前估值处于什么水平？`, tool: "valuation", symbol });
    tasks.push({ question: `${symbol} 最近有哪些公告/定期报告？`, tool: "announcements", symbol });
    tasks.push({ question: `${symbol} 券商研究观点与评级如何？`, tool: "research", symbol });
  }
  return tasks.slice(0, 8);
}

export async function plan(goal) {
  if (hasLLM()) {
    try {
      const raw = await chat({ system: SYSTEM, user: `研究目标：${goal}\n可用工具：\n${toolListForPlanner()}`, json: true });
      const parsed = parseJSON(raw);
      if (Array.isArray(parsed.tasks) && parsed.tasks.length) return parsed.tasks;
    } catch (e) {
      // LLM 失败时降级到离线模板，绝不能因为模型失败而中断主链路。
      console.warn("规划器降级到离线模板：", e.message);
    }
  }
  return fallbackPlan(goal);
}
