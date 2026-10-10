// 可观测性：记录 Agent 每一步做了什么，并累计成本/时延/步数。
// 题目要求「成本/时延与可观测性」，这里就是落点：每一步的 trace 会
// 随结果一起返回给前端，用户能看到 Agent 到底干了什么、花了多少。

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
      return {
        steps: events.length,
        totalLatencyMs: totalLatency,
        totalTokens: totalTokens,
        toolsCalled: events.filter((e) => e.type === "tool").length,
      };
    },
  };
}
