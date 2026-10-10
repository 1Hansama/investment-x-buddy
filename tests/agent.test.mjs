// 测试：覆盖题目要求的四类场景
//   1) 主链路（规划 -> 执行 -> 综合 -> 结论）
//   2) 数据缺失 / 接口失败（诚实降级为「无法验证」）
//   3) 合规边界（不输出确定性涨跌预测/买卖建议；附免责声明）
//   4) 停止规则（步数上限）
// 运行：npm test   （即 node --test，不依赖任何 API key，纯离线确定性）

import { test } from "node:test";
import assert from "node:assert/strict";
import { plan } from "../lib/agent/planner.js";
import { execute } from "../lib/agent/executor.js";
import { synthesize } from "../lib/agent/synthesizer.js";
import { createTrace } from "../lib/agent/observability.js";
import { checkBudget } from "../lib/agent/stop.js";
import { findComplianceIssues, DISCLAIMER } from "../lib/compliance.js";

async function runPipeline(goal) {
  const trace = createTrace();
  const tasks = await plan(goal);
  const results = await execute(tasks, trace, Date.now());
  const synthesis = synthesize(goal, results);
  return { tasks, results, synthesis, trace };
}

test("主链路：能把目标拆成任务、执行并产出结论", async () => {
  const goal = "分析宁德时代(300750)盈利是否改善、是否来自主营业务";
  const { tasks, results, synthesis } = await runPipeline(goal);

  assert.ok(tasks.length >= 1, "应规划出至少 1 个任务");
  assert.ok(results.every((r) => ["done", "unverifiable", "stopped"].includes(r.status)));

  const g = synthesis.bySymbol["300750"];
  assert.ok(g, "应包含标的 300750 的结果");
  assert.ok(g.conclusion.statement.length > 0);
  assert.ok(["inference", "uncertain"].includes(g.conclusion.kind), "结论应是推断/不确定，而非事实或预测");
  assert.ok(g.conclusion.confidence >= 0 && g.conclusion.confidence <= 1);
  assert.ok(g.conclusion.flipConditions.length > 0, "应有翻转条件");
});

test("数据缺失/接口失败：诚实降级为无法验证，不编造数据", async () => {
  const goal = "查询 999999 的财务数据";
  const tasks = await plan(goal);
  tasks.push({ question: "是否可用", tool: "financials", symbol: "999999" });
  const results = await execute(tasks, createTrace(), Date.now());
  const bad = results.find((r) => r.task.symbol === "999999");

  assert.equal(bad.status, "unverifiable");
  assert.ok(bad.reason, "必须给出无法验证的原因");

  const syn = synthesize(goal, results);
  const g = syn.bySymbol["999999"];
  assert.ok(g.unverifiable.length >= 1);
  assert.ok(g.unverifiable[0].claim.includes("无法验证"));
});

test("合规边界：结论不含确定性预测/买卖建议，且附免责声明", async () => {
  const goal = "分析宁德时代300750盈利质量";
  const { synthesis } = await runPipeline(goal);
  const text = Object.values(synthesis.bySymbol)
    .map((s) => s.conclusion.statement)
    .join(" ");

  assert.deepEqual(findComplianceIssues(text), [], "结论不得出现违禁表述");
  assert.ok(synthesis.disclaimer.length > 0);
  assert.ok(DISCLAIMER.includes("不构成任何投资建议"));
});

test("停止规则：超过步数上限会停止", () => {
  const r = checkBudget({ stepCount: 999, startedAt: Date.now() });
  assert.equal(r.ok, false);
  assert.ok(r.reason.includes("步数上限"));
});
