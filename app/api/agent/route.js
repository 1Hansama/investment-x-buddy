// API 入口：/api/agent（POST）。把七层 harness 串成完整主链路：
//   上下文管理(线程) -> 安全治理(输入校验/工具审批/审计) -> 任务编排(规划/执行)
//   -> 校验反馈(自检) -> 合规(违禁扫描/敏感防护) -> 可观测 -> 检查点(恢复)。
// 支持 mode:
//   run   —— 跑完整主链路（默认）
//   load  —— 按 id 恢复某个检查点（演示「检查点与恢复」）
//   list  —— 列出已保存的检查点

import { plan } from "../../../lib/agent/planner.js";
import { execute } from "../../../lib/agent/executor.js";
import { synthesize } from "../../../lib/agent/synthesizer.js";
import { createTrace } from "../../../lib/agent/observability.js";
import { saveRun, loadRun, listRuns } from "../../../lib/agent/state.js";
import { findComplianceIssues } from "../../../lib/compliance.js";
import { findTool } from "../../../lib/tools.js";
import { createThread, appendWorking, contextSnapshot } from "../../../lib/agent/context.js";
import { validateGoal, approvalRequired, audit, auditLog, findSensitiveLeaks, costGuard } from "../../../lib/agent/governance.js";
import { validate } from "../../../lib/agent/validation.js";

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

  // —— 安全与治理：输入校验（先于一切执行） ——
  const gate = validateGoal(goal);
  if (!gate.ok) {
    return Response.json({ error: `目标未通过输入校验：${gate.issues.join("；")}`, issues: gate.issues }, { status: 400 });
  }

  // —— 上下文管理：为本次研究建立线程 ——
  const thread = createThread(goal);

  const trace = createTrace();
  const startedAt = Date.now();
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // —— 任务编排：规划 ——
  const tPlan0 = Date.now();
  trace.add({ type: "plan", label: "开始规划", status: "running" });
  const tasks = await plan(goal);
  if (!tasks.length) {
    return Response.json({ error: "无法从研究目标中解析出 A 股代码或已知股票名称，请补充 6 位代码后重试。" }, { status: 400 });
  }
  trace.add({ type: "plan", label: `规划完成，共 ${tasks.length} 个任务`, status: "done", latencyMs: Date.now() - tPlan0, tokens: estimateTokens(goal) });

  // —— 安全与治理：工具审批 + 审计 ——
  const approvals = tasks.map((t) => {
    const a = approvalRequired(findTool(t.tool), { symbol: t.symbol });
    audit({ runId, action: "approval", tool: t.tool, symbol: t.symbol, decision: a.decision });
    return a;
  });
  const execTasks = tasks.filter((_, i) => approvals[i].decision === "approved");
  const deniedCount = approvals.filter((a) => a.decision !== "approved").length;

  // —— 任务编排：执行（内含异常恢复：重试/熔断） ——
  const results = await execute(execTasks, trace, startedAt);

  // —— 综合 ——
  const synthesis = synthesize(goal, results);

  // —— 校验反馈：自检报告 ——
  const validation = validate(synthesis);

  // —— 合规 + 敏感信息防护 ——
  const conclusionText = Object.values(synthesis.bySymbol).map((s) => s.conclusion.statement).join(" ");
  const compliance = {
    disclaimer: synthesis.disclaimer,
    issues: findComplianceIssues(conclusionText),
    sensitiveLeaks: findSensitiveLeaks(conclusionText),
  };

  // —— 上下文管理：证据写入工作记忆，超阈值自动压缩 ——
  const evidenceEntries = Object.values(synthesis.bySymbol).flatMap((g) => g.evidence);
  appendWorking(thread, evidenceEntries);

  // —— 可观测 + 成本防护 ——
  const obs = trace.summary();
  const cost = costGuard(obs.totalTokens);

  const run = {
    id: runId,
    goal,
    createdAt: new Date().toISOString(),
    tasks,
    results,
    synthesis,
    trace: { events: trace.events, summary: obs },
    compliance,
    dataSource: process.env.DATA_SOURCE || "mock",
    llm: process.env.DEEPSEEK_API_KEY ? "deepseek" : "offline-fallback",
    checkpointPath: null,
    harness: {
      context: contextSnapshot(thread),
      governance: {
        approvals: approvals.map((a) => ({ tool: a.tool, decision: a.decision, reason: a.reason })),
        deniedCount,
        audit: auditLog().filter((e) => e.runId === runId),
        cost,
      },
      validation,
      recovery: summarizeRecovery(results),
      observability: obs,
      orchestration: {
        planned: tasks.length,
        executed: results.length,
        unverifiable: results.filter((r) => r.status === "unverifiable").length,
        stopped: results.filter((r) => r.status === "stopped").length,
      },
    },
  };

  run.checkpointPath = await saveRun(run); // 检查点：可恢复；只读环境为 null 但不影响主流程

  return Response.json(run);
}

// 粗粒度 token 估算（中文约 1 字符 1 token，取上界；接入真实 API 后可读 usage 精确计费）。
function estimateTokens(text) {
  return String(text || "").length;
}

// 异常恢复汇总：重试与熔断次数。
function summarizeRecovery(results) {
  return {
    retriedCount: results.filter((r) => (r.retries || 0) > 0).length,
    circuitSkippedCount: results.filter((r) => r.reason && r.reason.includes("熔断")).length,
  };
}
