// 状态层：记忆 / 检查点与恢复 / 上下文压缩。
// 题目要求「管理上下文与长期状态」「检查点与恢复」。这里用两层：
// 1) 内存 Map（任何环境都能跑，单实例内可恢复）
// 2) 本地落盘 data/state/*.json（本地演示检查点恢复）
// Vercel 等 serverless 文件系统只读，持久化到数据库属未做事项（README 说明）。

import { promises as fs } from "fs";
import path from "path";

const memory = new Map(); // runId -> run

const STATE_DIR = path.join(process.cwd(), "data", "state");

export async function saveRun(run) {
  memory.set(run.id, run);
  try {
    await fs.mkdir(STATE_DIR, { recursive: true });
    const file = path.join(STATE_DIR, `${run.id}.json`);
    await fs.writeFile(file, JSON.stringify(run, null, 2), "utf8");
    return file;
  } catch {
    return null; // 只读环境：不落盘，也不影响主流程
  }
}

export async function loadRun(id) {
  if (memory.has(id)) return memory.get(id);
  try {
    return JSON.parse(await fs.readFile(path.join(STATE_DIR, `${id}.json`), "utf8"));
  } catch {
    return null; // 检查点不存在或不可读 -> 无法恢复
  }
}

export async function listRuns() {
  let fromDisk = [];
  try {
    fromDisk = (await fs.readdir(STATE_DIR)).filter((f) => f.endsWith(".json")).map((f) => f.replace(".json", ""));
  } catch {
    /* 目录不存在则忽略 */
  }
  return [...new Set([...memory.keys(), ...fromDisk])];
}

// 上下文压缩已迁至 lib/agent/context.js（compressEntries），本文件只负责检查点持久化。
