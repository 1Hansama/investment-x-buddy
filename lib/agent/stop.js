// 停止规则与预算：防止 Agent 无限跑下去或超预算。
// 题目要求「停止规则、成本/时延」。这里定义上限，executor 每走一步都检查。

export const BUDGET = {
  maxSteps: 12, // 最多执行 12 个工具步骤
  maxTokensEstimate: 8000, // 估计的 token 上限（示例值）
  maxLatencyMs: 30_000, // 单次运行时延上限 30 秒
};

// 成本口径（示例值，用于「成本/时延」可观测与治理的预算防护）。
export const COST = {
  per1kTokens: 0.002, // 元 / 千 token（DeepSeek 示例价）
  currency: "CNY",
};

export function estimateCost(tokens) {
  return +(tokens / 1000 * COST.per1kTokens).toFixed(4);
}

export function checkBudget({ stepCount, startedAt }) {
  const elapsed = Date.now() - startedAt;
  if (stepCount >= BUDGET.maxSteps) {
    return { ok: false, reason: `已达步数上限 ${BUDGET.maxSteps}` };
  }
  if (elapsed > BUDGET.maxLatencyMs) {
    return { ok: false, reason: `已超时（> ${BUDGET.maxLatencyMs / 1000}s）` };
  }
  return { ok: true };
}
