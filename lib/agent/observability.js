// 可观测性（七大 harness 之一）：记录 Agent 每一步做了什么，并累计成本/时延/步数/状态。
// 题目要求「成本/时延与可观测性」，这里就是落点：每一步的 trace 会随结果一起返回
// 前端，用户能看到 Agent 到底干了什么、花了多少、成本多少。

import { estimateCost } from "./stop.js";

let stepCounter = 0;

export function createTrace() {
  const events = [];
  return {
    events,
    // 记一条事件：{ step, type, label, tool, latencyMs, tokens, status }
    add(ev) {
      stepCounter += 1;
      events.push({ step: stepCounter, ...ev });
    },
    summary() {
      const totalLatency = events.reduce((s, e) => s + (e.latencyMs || 0), 0);
      const totalTokens = events.reduce((s, e) => s + (e.tokens || 0), 0);
      const byStatus = { done: 0, unverifiable: 0, stopped: 0, running: 0 };
      for (const e of events) {
        if (byStatus[e.status] != null) byStatus[e.status] += 1;
      }
      return {
        steps: events.length,
        totalLatencyMs: totalLatency,
        totalTokens: totalTokens,
        toolsCalled: events.filter((e) => e.type === "tool").length,
        estimatedCost: estimateCost(totalTokens),
        byStatus,
      };
    },
  };
}
