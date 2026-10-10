// 执行器：按计划逐个执行任务，调用工具、收集证据，并遵守停止规则。
// 工具失败/数据缺失时，不报错中断，而是把该任务标为「无法验证」并记录原因。

import { findTool } from "../tools.js";
import { checkBudget } from "./stop.js";

export async function execute(plan, trace, startedAt) {
  const results = [];
  for (const task of plan) {
    const budget = checkBudget({ stepCount: results.length, startedAt });
    if (!budget.ok) {
      results.push({ task, status: "stopped", reason: budget.reason });
      trace.add({ type: "stop", label: budget.reason, status: "stopped" });
      break;
    }

    const tool = findTool(task.tool);
    if (!tool) {
      // 计划里出现未注册的工具 -> 明确记为无法验证，而不是跳过。
      results.push({ task, status: "unverifiable", reason: `工具未注册：${task.tool}` });
      trace.add({ type: "tool", label: `未知工具 ${task.tool}`, status: "unverifiable" });
      continue;
    }

    const t0 = Date.now();
    let outcome;
    try {
      outcome = await tool.run({ symbol: task.symbol });
    } catch (e) {
      outcome = { ok: false, reason: `工具执行异常：${e.message}` };
    }
    const latencyMs = Date.now() - t0;

    if (outcome.ok) {
      results.push({ task, status: "done", result: outcome, latencyMs });
      trace.add({ type: "tool", label: `${tool.name}(${task.symbol})`, tool: tool.name, latencyMs, status: "done" });
    } else {
      results.push({ task, status: "unverifiable", reason: outcome.reason, latencyMs });
      trace.add({ type: "tool", label: `${tool.name}(${task.symbol})`, tool: tool.name, latencyMs, status: "unverifiable", reason: outcome.reason });
    }
  }
  return results;
}
