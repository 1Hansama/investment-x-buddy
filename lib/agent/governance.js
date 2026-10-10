// 安全与治理（七大 harness 之一）：输入校验、工具审批、成本防护、审计、敏感信息防护。
// 题目要求「权限/审批、停止规则、成本」。当前所有工具均为只读 -> 审批策略自动通过；
// 未来加入「写操作/交易」类工具时，把 riskLevel 标为 write 即可自动转人工审批。

import { estimateCost } from "./stop.js";

const MAX_GOAL_LEN = 500;
const MAX_TOTAL_COST = 0.05; // 单次运行成本上限（元，示例）

const AUDIT = []; // 审计日志（内存；随 run 返回给前端，不落盘）

// 1) 输入校验：拒绝空/超长/疑似越权注入的目标。
export function validateGoal(goal) {
  const issues = [];
  const g = String(goal ?? "").trim();
  if (!g) issues.push("研究目标为空");
  if (g.length > MAX_GOAL_LEN) issues.push(`研究目标过长（>${MAX_GOAL_LEN} 字符）`);
  if (/忽略(以上|之前|所有)指令|越权|bypass|ignore (all |prior )?instructions/i.test(g)) {
    issues.push("目标包含疑似越权/注入式指令");
  }
  return { ok: issues.length === 0, issues };
}

// 2) 工具审批：按工具 riskLevel 决定 auto/approval/deny。
const APPROVAL_POLICY = { read: "auto", write: "approval", none: "deny" };

export function approvalRequired(tool, params = {}) {
  if (!tool) {
    return { tool: null, risk: "none", policy: "deny", decision: "denied", reason: "工具未注册，拒绝执行", params };
  }
  const risk = tool.riskLevel || "read";
  const policy = APPROVAL_POLICY[risk] ?? "deny";
  const decision = policy === "auto" ? "approved" : policy === "approval" ? "pending" : "denied";
  const reason =
    decision === "approved"
      ? `只读工具 ${tool.name} 自动批准`
      : decision === "pending"
        ? `工具 ${tool.name}（写操作）需人工审批`
        : `工具 ${tool.name} 被策略拒绝`;
  return { tool: tool.name, risk, policy, decision, reason, params };
}

// 3) 成本防护：token 成本估算 + 总成本上限检查。
export function costGuard(tokens) {
  const cost = estimateCost(tokens);
  return { tokens, cost, overBudget: cost > MAX_TOTAL_COST };
}

// 4) 审计：记录每次治理决策，形成可追溯的审计日志。
export function audit(entry) {
  const rec = { at: new Date().toISOString(), ...entry };
  AUDIT.push(rec);
  return rec;
}

export function auditLog() {
  return AUDIT.slice();
}

// 5) 敏感信息防护：产物若疑似泄露密钥/隐私则标记（不静默通过）。
export function findSensitiveLeaks(text) {
  const patterns = [
    { re: /ghp_[A-Za-z0-9]{20,}/, why: "疑似 GitHub PAT" },
    { re: /sk-[A-Za-z0-9]{20,}/, why: "疑似 API Key" },
    { re: /\b\d{17}[\dXx]\b/, why: "疑似身份证号" },
    { re: /\b1[3-9]\d{9}\b/, why: "疑似手机号" },
  ];
  return patterns.filter((p) => p.re.test(text || "")).map((p) => p.why);
}
