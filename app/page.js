"use client";

import { useEffect, useRef, useState } from "react";
import * as Collapsible from "@radix-ui/react-collapsible";
import * as ScrollArea from "@radix-ui/react-scroll-area";
import {
  Play,
  Square,
  History,
  ChevronDown,
  Activity,
  Gauge,
  AlertTriangle,
  CheckCircle2,
  ListChecks,
  Clock,
  Coins,
  Layers,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const EXAMPLES = [
  "分析宁德时代(300750)盈利是否改善、是否来自主营业务",
  "比较宁德时代300750与隆基绿能601012的盈利质量",
  "贵州茅台600519的估值是否合理、基本面是否稳健",
];

const KIND = { fact: "事实", inference: "推断", uncertain: "不确定", reference: "外部参考" };
const MAX_STEPS = 12; // 与 lib/agent/stop.js 的 BUDGET.maxSteps 一致

export default function Home() {
  const [goal, setGoal] = useState("");
  const [loading, setLoading] = useState(false);
  const [run, setRun] = useState(null);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);
  const [source, setSource] = useState(null);
  const abortRef = useRef(null);

  async function listHistory() {
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "list" }),
      });
      const data = await res.json();
      if (res.ok) setHistory(data.runs || []);
    } catch {
      /* 历史列表加载失败不影响主流程 */
    }
  }

  useEffect(() => {
    listHistory();
    fetch("/api/datasource")
      .then((r) => r.json())
      .then((d) => setSource(d))
      .catch(() => {});
  }, []);

  async function callAgent(body) {
    abortRef.current = new AbortController();
    setLoading(true);
    setError(null);
    setRun(null);
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: abortRef.current.signal,
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || "请求失败");
      else {
        setRun(data.run ?? data);
        listHistory();
      }
    } catch (e) {
      if (e.name !== "AbortError") setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function runAgent(g) {
    callAgent({ goal: g });
  }

  function stopAgent() {
    if (abortRef.current) abortRef.current.abort();
    setLoading(false);
  }

  async function recover(id) {
    const res = await fetch("/api/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "load", id }),
    });
    const data = await res.json();
    if (res.ok) {
      setRun(data.run);
      setError(null);
    } else {
      setError(data.error || "恢复失败");
    }
  }

  const steps = run?.trace?.summary?.steps || 0;
  const budgetPct = Math.min(100, Math.round((steps / MAX_STEPS) * 100));

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <svg className="brand-logo" viewBox="0 0 100 100" fill="none" aria-hidden="true">
            <rect x="3" y="3" width="94" height="94" rx="16" fill="var(--logo-fill)" stroke="currentColor" strokeWidth="4" />
            <path d="M58 78 H81" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
            <path d="M78 57 V81" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
            <circle cx="69" cy="69" r="6.5" fill="currentColor" />
            <path d="M31 31 L43 43" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
          <div>
            <h1>观隅</h1>
            <p className="slogan">独坐一隅，灵悉万象</p>
          </div>
        </div>

        <div className="topbar-right">
          <span className="chip chip-blue">数据源：{run ? run.dataSource : (source?.dataSource ?? "…")}</span>
          <span className="chip chip-blue">模型：{run ? (run.llm === "deepseek" ? "DeepSeek" : "离线规则") : (source ? (source.llm === "deepseek" ? "DeepSeek" : "离线规则") : "…")}</span>
          {run?.compliance?.issues?.length ? (
            <span className="chip chip-red">
              <AlertTriangle size={12} /> 合规命中
            </span>
          ) : (
            <span className="chip chip-green">
              <CheckCircle2 size={12} /> 合规通过
            </span>
          )}
          {run && (
            <div className="budget" title="预算消耗（步骤 / 时延）">
              <Gauge size={14} />
              <span className="budget-num">{steps}/{MAX_STEPS}</span>
              <span className="muted">{run.trace?.summary?.totalLatencyMs ?? 0}ms</span>
              <div className="budget-bar">
                <div className="budget-fill" style={{ width: `${budgetPct}%` }} />
              </div>
            </div>
          )}
          {loading && (
            <button className="btn btn-danger" onClick={stopAgent}>
              <Square size={14} /> 停止
            </button>
          )}
        </div>
      </header>

      <div className="workspace">
        <main className="canvas">
          <section className="card input-card">
            <label className="field-label" htmlFor="goal">
              研究目标
            </label>
            <textarea
              id="goal"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="输入一个投资研究目标，例如：分析宁德时代(300750)盈利是否改善、是否来自主营业务"
              rows={2}
            />
            <div className="input-actions">
              <button className="btn btn-primary" onClick={() => runAgent(goal)} disabled={loading || !goal.trim()}>
                <Play size={14} /> {loading ? "运行中…" : "开始研究"}
              </button>
            </div>
            <div className="examples">
              <span className="muted">示例：</span>
              {EXAMPLES.map((e) => (
                <button key={e} className="chip chip-example" onClick={() => { setGoal(e); runAgent(e); }}>
                  {e}
                </button>
              ))}
            </div>
          </section>

          {error && (
            <div className="banner banner-error">
              <AlertTriangle size={14} /> 请求失败：{error}
            </div>
          )}
          {loading && (
            <div className="banner banner-info">
              <span className="loading">
                <span className="loading-rod" />
                Agent 正在规划并逐项取证（可点右上「停止」中断）…
              </span>
            </div>
          )}

          {run && <ResultView run={run} />}

          <footer className="disclaimer">
            {run?.synthesis?.disclaimer || "基于公开/示例数据的整理与推断，不构成投资建议。"}
          </footer>
        </main>

        <aside className="sidebar">
          <TracePanel trace={run?.trace} />
          <HistoryPanel history={history} onRecover={recover} onRefresh={listHistory} />
        </aside>
      </div>
    </div>
  );
}

function ResultView({ run }) {
  const symbols = Object.keys(run.synthesis.bySymbol);

  return (
    <div className="result">
      <div className="run-meta muted">
        run #{run.id} · 创建于 {run.createdAt}
        {run.checkpointPath ? <> · 检查点已保存</> : <> · 检查点仅内存（只读环境）</>}
      </div>

      <HarnessPanel run={run} />

      <TaskPanel tasks={run.tasks} />

      {symbols.length > 1 && <ComparisonPanel comparison={run.synthesis.comparison} />}

      {symbols.map((s) => {
        const g = run.synthesis.bySymbol[s];
        return (
          <section key={s} className="card">
            <h2>
              {g.name} <span className="muted">（{s}）</span>
            </h2>
            <ConclusionCard c={g.conclusion} />
            <EvidenceGroup title="支持" stance="support" items={g.evidence.filter((e) => e.stance === "support")} />
            <EvidenceGroup title="反对" stance="against" items={g.evidence.filter((e) => e.stance === "against")} />
            <EvidenceGroup title="无法验证" stance="unverifiable" items={[...g.evidence.filter((e) => e.stance === "unverifiable"), ...g.unverifiable]} />
            {g.materials.length > 0 && <MaterialsPanel items={g.materials} />}
          </section>
        );
      })}
    </div>
  );
}

function HarnessPanel({ run }) {
  const h = run.harness;
  if (!h) return null;
  const c = h.context || {};
  const g = h.governance || {};
  const v = h.validation || {};
  const o = h.observability || {};
  const r = h.recovery || {};
  const orch = h.orchestration || {};
  const leaks = run.compliance?.sensitiveLeaks?.length ?? 0;

  const rows = [
    ["上下文管理", `工作记忆 ${c.workingCount ?? 0} 条 · 长期记忆 ${c.longTermCount ?? 0} 条 · 压缩 ${c.compressionCount ?? 0} 次`],
    ["工具调度层", `注册工具 7 个 · 本次调用 ${o.toolsCalled ?? 0} 次（只读自动批准）`],
    ["任务编排", `规划 ${orch.planned ?? 0} · 执行 ${orch.executed ?? 0} · 无法验证 ${orch.unverifiable ?? 0} · 停止 ${orch.stopped ?? 0}`],
    ["安全与治理", `审批 ${g.approvals?.length ?? 0} 项（需人工 ${g.deniedCount ?? 0}）· 审计 ${g.audit?.length ?? 0} 条 · 敏感泄露 ${leaks}`],
    ["校验反馈", `校验分 ${v.score ?? "—"} · 冲突 ${v.conflicts?.length ?? 0} · 数据缺口 ${v.gaps?.length ?? 0}`],
    ["可观测性", `步骤 ${o.steps ?? 0} · 时延 ${o.totalLatencyMs ?? 0}ms · 成本 ¥${g.cost?.cost ?? o.estimatedCost ?? 0}`],
    ["异常恢复", `重试 ${r.retriedCount ?? 0} 次 · 熔断跳过 ${r.circuitSkippedCount ?? 0} 次`],
  ];

  return (
    <section className="card">
      <h2>
        <Layers size={15} /> 七层 Harness · 运行报告
      </h2>
      <ul className="harness-list">
        {rows.map(([k, val]) => (
          <li key={k}>
            <span className="harness-key">{k}</span>
            <span className="harness-val muted">{val}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function TaskPanel({ tasks }) {
  return (
    <section className="card">
      <h2>
        <ListChecks size={15} /> 任务计划（Agent 规划）
      </h2>
      <ol className="task-list">
        {tasks.map((t, i) => (
          <li key={i}>
            <span className="task-index">{i + 1}</span>
            <span className="task-tool">{t.tool}</span>
            <span className="task-q">{t.question}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function TracePanel({ trace }) {
  if (!trace) {
    return (
      <section className="card sidebar-card">
        <h2>
          <Activity size={15} /> 运行日志
        </h2>
        <p className="muted">启动分析后，Agent 每一步会在此实时留痕。</p>
      </section>
    );
  }

  const s = trace.summary;
  return (
    <section className="card sidebar-card">
      <h2>
        <Activity size={15} /> 运行日志
      </h2>
      <div className="stats">
        <Stat icon={<ListChecks size={12} />} label="步骤" value={s.steps} />
        <Stat icon={<Coins size={12} />} label="调用工具" value={s.toolsCalled} />
        <Stat icon={<Clock size={12} />} label="时延" value={`${s.totalLatencyMs}ms`} />
        <Stat icon={<Gauge size={12} />} label="token" value={s.totalTokens || "—"} />
      </div>
      <ScrollArea.Root className="scroll-root">
        <ScrollArea.Viewport className="scroll-viewport">
          <ul className="trace-list">
            {trace.events.map((ev, i) => (
              <li key={i}>
                <span className={`dot dot-${ev.status}`} />
                <span className="muted">#{ev.step}</span> {ev.label}
                {ev.latencyMs ? <span className="muted">（{ev.latencyMs}ms）</span> : null}
              </li>
            ))}
          </ul>
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar className="scrollbar" orientation="vertical">
          <ScrollArea.Thumb className="scroll-thumb" />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>
    </section>
  );
}

function Stat({ icon, label, value }) {
  return (
    <div className="stat">
      <div className="stat-value">{value}</div>
      <div className="stat-label muted">
        {icon} {label}
      </div>
    </div>
  );
}

function HistoryPanel({ history, onRecover, onRefresh }) {
  return (
    <section className="card sidebar-card">
      <h2>
        <History size={15} /> 历史检查点
      </h2>
      {history.length === 0 ? (
        <p className="muted">暂无已保存的运行。</p>
      ) : (
        <ul className="history-list">
          {history.map((id) => (
            <li key={id}>
              <code>{id}</code>
              <button className="btn btn-small" onClick={() => onRecover(id)}>
                恢复
              </button>
            </li>
          ))}
        </ul>
      )}
      <button className="btn btn-ghost btn-small" onClick={onRefresh}>
        刷新
      </button>
    </section>
  );
}

function ComparisonPanel({ comparison }) {
  const chartData = comparison.map((r) => ({
    name: r.name,
    支持: r.supportCount,
    反对: r.againstCount,
    无法验证: r.unverifiableCount,
  }));

  return (
    <section className="card">
      <h2>标的对比</h2>
      <table className="cmp-table">
        <thead>
          <tr>
            <th>标的</th>
            <th>支持</th>
            <th>反对</th>
            <th>无法验证</th>
            <th>倾向</th>
          </tr>
        </thead>
        <tbody>
          {comparison.map((r) => (
            <tr key={r.symbol}>
              <td>{r.name}</td>
              <td className="num num-support">{r.supportCount}</td>
              <td className="num num-against">{r.againstCount}</td>
              <td className="num">{r.unverifiableCount}</td>
              <td>{r.kind === "uncertain" ? "不确定" : r.supportCount >= r.againstCount ? "偏正面" : "偏负面"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="chart-box">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#C9B89E" />
            <XAxis dataKey="name" tick={{ fill: "#2C241C", fontSize: 12 }} />
            <YAxis allowDecimals={false} tick={{ fill: "#2C241C", fontSize: 12 }} />
            <ChartTooltip />
            <Legend />
            <Bar dataKey="支持" fill="#4a5b3a" />
            <Bar dataKey="反对" fill="#A82C26" />
            <Bar dataKey="无法验证" fill="#8a7a63" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function ConclusionCard({ c }) {
  return (
    <div className="conclusion">
      <div className="conclusion-head">
        <span className={`badge badge-${c.kind}`}>{KIND[c.kind] || c.kind}</span>
        <span className="confidence muted">置信度 {Math.round(c.confidence * 100)}%</span>
      </div>
      <div className="confidence-bar">
        <div className="confidence-fill" style={{ width: `${c.confidence * 100}%` }} />
      </div>
      <p className="conclusion-statement">{c.statement}</p>

      {c.flipConditions.length > 0 && (
        <div className="flip">
          <h3>什么信息变了会推翻当前结论（翻转条件）</h3>
          <ul>
            {c.flipConditions.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </div>
      )}

      {c.conflicts.length > 0 && (
        <div className="conflict">
          <h3>证据冲突与处理</h3>
          {c.conflicts.map((cf, i) => (
            <p key={i}>
              <strong>{cf.between}</strong>：{cf.resolution}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function EvidenceGroup({ title, stance, items }) {
  if (!items.length) return null;
  return (
    <div className="evidence-group">
      <h3 className={`ev-title ev-title-${stance}`}>
        {title} <span className="muted">（{items.length}）</span>
      </h3>
      <ul className="evidence-list">
        {items.map((e, i) => {
          const key = `${e.source?.field || e.source?.tool}-${i}`;
          const kind = e.type || (e.stance === "unverifiable" ? "uncertain" : "fact");
          return (
            <li key={key} className={`evidence ev-${kind}`}>
              <Collapsible.Root>
                <div className="evidence-main">
                  <span className={`badge badge-${kind}`}>{KIND[kind] || kind}</span>
                  <span className={`evidence-claim claim-${kind}`}>{e.claim}</span>
                  <Collapsible.Trigger asChild>
                    <button className="btn btn-trace">
                      追溯来源 <ChevronDown className="chev" size={12} />
                    </button>
                  </Collapsible.Trigger>
                </div>
                <Collapsible.Content className="collapsible-content">
                  <pre className="source-box">{JSON.stringify(e.source, null, 2)}</pre>
                </Collapsible.Content>
              </Collapsible.Root>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function MaterialsPanel({ items }) {
  return (
    <div className="materials">
      <h3 className="muted">原始材料（行情 / 公告 / 研报）</h3>
      <ul>
        {items.map((m, i) => (
          <li key={i}>
            <span className={`badge badge-${m.type}`}>{KIND[m.type] || m.type}</span> {m.claim}
          </li>
        ))}
      </ul>
    </div>
  );
}
