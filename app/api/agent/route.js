// API 入口：/api/agent（POST）。把主链路串起来：
// 规划(planner) -> 执行(executor) -> 综合(synthesizer) -> 检查点(saveRun) -> 合规扫描。
// 支持 mode:
//   run   —— 跑完整主链路（默认）
//   load  —— 按 id 恢复某个检查点（演示「检查点与恢复」）

import { plan } from "../../../lib/agent/planner.js";
import { execute } from "../../../lib/agent/executor.js";
import { synthesize } from "../../../lib/agent/synthesizer.js";
import { createTrace } from "../../../lib/agent/observability.js";
import { saveRun, loadRun, listRuns } from "../../../lib/agent/state.js";
import { findComplianceIssues } from "../../../lib/compliance.js";

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  const { goal, mode = "run", id } = body;

  if (mode === "list") {
    const runs = await listRuns();
    return Response.json({ runs });
  }

  if (mode === "load" && id) {
    const run = await loadRun(id);
    if (!run) return Response.json({ error: `检查点 ${id} 不存在，无法恢复` }, { status: 404 });
    return Response.json({ recovered: true, run });
  }

  if (!goal || typeof goal !== "string" || !goal.trim()) {
    return Response.json({ error: "缺少研究目标（goal）" }, { status: 400 });
  }

  const trace = createTrace();
  const startedAt = Date.now();
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  trace.add({ type: "plan", label: "开始规划", status: "running" });
  const tasks = await plan(goal);
  trace.add({ type: "plan", label: `规划完成，共 ${tasks.length} 个任务`, status: "done" });

  const results = await execute(tasks, trace, startedAt);
  const synthesis = synthesize(goal, results);

  const conclusionText = Object.values(synthesis.bySymbol)
    .map((s) => s.conclusion.statement)
    .join(" ");
  const compliance = {
    disclaimer: synthesis.disclaimer,
    issues: findComplianceIssues(conclusionText),
  };

  const run = {
    id: runId,
    goal,
    createdAt: new Date().toISOString(),
    tasks,
    results,
    synthesis,
    trace: { events: trace.events, summary: trace.summary() },
    compliance,
    dataSource: process.env.DATA_SOURCE || "mock",
    llm: process.env.DEEPSEEK_API_KEY ? "deepseek" : "offline-fallback",
    checkpointPath: null,
  };

  run.checkpointPath = await saveRun(run); // 检查点：可恢复；只读环境为 null 但不影响主流程

  return Response.json(run);
}
