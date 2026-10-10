// 执行器：按计划逐个执行任务，调用工具、收集证据，并遵守停止规则。
// 工具失败/数据缺失时，不报错中断，而是把该任务标为「无法验证」并记录原因。
// 新增（异常恢复层）：
//   - withRetry：瞬时异常（抛错）自动重试一次；
//   - createCircuitBreaker：同一工具连续异常达到阈值即熔断，冷却期后复位。

import { findTool } from "../tools.js";
import { checkBudget } from "./stop.js";
import { withRetry, createCircuitBreaker } from "./recovery.js";

const breakers = new Map(); // toolName -> circuitBreaker（进程内跨运行共享）

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

    // 熔断检查：数据源/工具近期连续异常，直接短路，不空耗预算。
    if (!breakers.has(task.tool)) breakers.set(task.tool, createCircuitBreaker());
    const breaker = breakers.get(task.tool);
    if (breaker.isOpen()) {
      results.push({ task, status: "unverifiable", reason: `工具 ${task.tool} 已熔断（近期连续异常）` });
      trace.add({ type: "tool", label: `${tool.name} 熔断跳过`, status: "unverifiable", reason: "circuit-open" });
      continue;
    }

    const t0 = Date.now();
    // 只对抛异常（瞬时故障）重试；工具正常返回 {ok:false} 属确定性缺失，不重试。
    const attempt = await withRetry(() => tool.run({ symbol: task.symbol }), { retries: 1 });
    const latencyMs = Date.now() - t0;
    const retries = attempt.attempts - 1;

    if (attempt.ok) {
      const outcome = attempt.value;
      breaker.record(true); // 无异常 -> 复位熔断计数
      if (outcome.ok) {
        results.push({ task, status: "done", result: outcome, latencyMs, retries });
        trace.add({ type: "tool", label: `${tool.name}(${task.symbol})`, tool: tool.name, latencyMs, status: "done" });
      } else {
        results.push({ task, status: "unverifiable", reason: outcome.reason, latencyMs, retries });
        trace.add({ type: "tool", label: `${tool.name}(${task.symbol})`, tool: tool.name, latencyMs, status: "unverifiable", reason: outcome.reason });
      }
    } else {
      // 重试后仍异常 -> 计入熔断
      breaker.record(false);
      results.push({ task, status: "unverifiable", reason: `工具执行异常（重试后仍失败）：${attempt.error?.message}`, latencyMs, retries });
      trace.add({ type: "tool", label: `${tool.name}(${task.symbol})`, tool: tool.name, latencyMs, status: "unverifiable", reason: attempt.error?.message });
    }
  }
  return results;
}
