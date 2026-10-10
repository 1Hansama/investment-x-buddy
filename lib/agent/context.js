// 上下文管理（七大 harness 之一）：线程(thread)、工作记忆、长期记忆、上下文压缩。
// 题目要求「管理上下文与长期状态」「上下文压缩」。设计：
//   工作记忆(working)：最近一次研究的证据/结论，超过阈值就压缩；
//   长期记忆(longTerm)：被压缩下来的摘要，跨轮可复用；
//   线程(thread)：一个研究目标 + 多轮追问共享同一 thread。
// 说明：这是单实例内存实现；跨进程持久化属未做事项（见 docs/HARNESS.md）。

const THREADS = new Map(); // threadId -> thread

const WORKING_LIMIT = 12; // 工作记忆条目上限，超过即触发压缩

export function createThread(goal) {
  const thread = {
    id: `th-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    goal,
    createdAt: new Date().toISOString(),
    turns: [], // 结构化的 append/compress 动作日志
    longTerm: [], // 长期记忆：压缩后的摘要
    working: [], // 工作记忆：当前证据/结论条目
  };
  THREADS.set(thread.id, thread);
  return thread;
}

export function getThread(id) {
  return THREADS.get(id) || null;
}

// 向工作记忆追加条目；超阈值时自动把最老的条目压成长记忆。
export function appendWorking(thread, entries) {
  thread.working.push(...entries);
  thread.turns.push({ at: new Date().toISOString(), action: "append", count: entries.length });
  compressIfNeeded(thread);
  return thread;
}

// 压缩：把超量最老条目合成一条摘要，转入长期记忆（记录到 turns）。
export function compressIfNeeded(thread) {
  const overflow = thread.working.length - WORKING_LIMIT;
  if (overflow <= 0) return 0;
  const evicted = thread.working.splice(0, overflow);
  thread.longTerm.push(compressEntries(evicted));
  thread.turns.push({ at: new Date().toISOString(), action: "compress", count: overflow });
  return overflow;
}

// 把一组证据/结论条目压成一条紧凑摘要。
export function compressEntries(entries, maxPoints = 6) {
  const support = entries.filter((e) => e.stance === "support").length;
  const against = entries.filter((e) => e.stance === "against").length;
  const keyPoints = entries.slice(0, maxPoints).map((e) => e.claim).join("；");
  return {
    summary: `证据共 ${entries.length} 条（支持 ${support} / 反对 ${against}）。要点：${keyPoints}`,
    at: new Date().toISOString(),
  };
}

// 上下文快照：供前端「上下文管理」面板与审计查看。
export function contextSnapshot(thread) {
  if (!thread) return null;
  const compressions = thread.turns.filter((t) => t.action === "compress").length;
  return {
    threadId: thread.id,
    workingCount: thread.working.length,
    longTermCount: thread.longTerm.length,
    workingLimit: WORKING_LIMIT,
    compressionCount: compressions,
    longTerm: thread.longTerm.map((s) => s.summary),
  };
}
