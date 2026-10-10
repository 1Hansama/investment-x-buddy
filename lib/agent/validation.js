// 校验反馈（七大 harness 之一）：对综合结果做自检，产出「校验报告」。
// 1) 完整性：每个标的都必须有证据或明确的无法验证说明；
// 2) 目标覆盖：无法验证项不能淹没可验证证据；
// 3) 冲突检测：同一字段同时出现支持与反对 -> 需复核统计口径；
// 4) 置信度：过低的结论提示补数据。
// 校验报告随 run 返回前端，作为「校验反馈层」的可观测产物。

export function validate(synthesis) {
  const report = {
    goalCoverage: [],
    conflicts: [],
    gaps: [],
    lowConfidence: [],
    score: 1.0,
    notes: [],
  };

  for (const [symbol, g] of Object.entries(synthesis.bySymbol)) {
    if (g.evidence.length === 0 && g.unverifiable.length === 0) {
      report.gaps.push(`${symbol}（${g.name}）既无证据也无无法验证说明，疑似数据缺口`);
    }

    if (g.unverifiable.length > g.evidence.length) {
      report.goalCoverage.push(`${symbol} 无法验证 ${g.unverifiable.length} 项 > 可验证证据 ${g.evidence.length} 项，结论可信度受限`);
    }

    // 同字段反向证据 -> 冲突
    const byField = {};
    for (const e of g.evidence) {
      const f = e.source?.field;
      if (!f) continue;
      (byField[f] ??= new Set()).add(e.stance);
    }
    for (const [f, stances] of Object.entries(byField)) {
      if (stances.has("support") && stances.has("against")) {
        report.conflicts.push(`${symbol} 字段「${f}」同时出现支持与反对，需复核口径与期间`);
      }
    }

    if (g.conclusion.confidence < 0.4) {
      report.lowConfidence.push(`${symbol} 置信度 ${Math.round(g.conclusion.confidence * 100)}% 偏低，建议补充数据`);
    }
  }

  // 打分：缺口/冲突/低置信度逐项扣分，最低 0 分。
  if (report.gaps.length) report.score -= 0.3;
  report.score -= 0.1 * Math.min(report.conflicts.length, 3);
  report.score -= 0.1 * Math.min(report.lowConfidence.length, 2);
  report.score = Math.max(0, Math.min(1, +report.score.toFixed(2)));

  if (report.score >= 0.8) report.notes.push("校验通过：证据链完整、无明显冲突。");
  else if (report.score >= 0.6) report.notes.push("校验存疑：存在数据缺口或冲突，建议人工复核。");
  else report.notes.push("校验告警：结果可信度不足，请勿据此决策。");

  return report;
}
