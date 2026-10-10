"use client";

import { useRef, useState } from "react";

const EXAMPLES = [
  "分析宁德时代(300750)盈利是否改善、是否来自主营业务",
  "比较宁德时代300750与隆基绿能601012的盈利质量",
  "贵州茅台600519的估值是否合理、基本面是否稳健",
];

const STANCE = { support: "支持", against: "反对", unverifiable: "无法验证" };
const KIND = { fact: "事实", inference: "推断", uncertain: "不确定", reference: "外部参考" };

export default function Home() {
  const [goal, setGoal] = useState("");
  const [loading, setLoading] = useState(false);
  const [run, setRun] = useState(null);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const abortRef = useRef(null);

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
      else setRun(data.run ?? data);
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

  async function listHistory() {
    const res = await fetch("/api/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "list" }),
    });
    const data = await res.json();
    setHistory(data.runs || []);
    setShowHistory(true);
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
            <p className="subtitle">个人投资研究 Agent 工作台</p>
          </div>
        </div>
        <div className="badges">
          <span className="chip chip-blue">数据源：{run ? run.dataSource : "mock（示例）"}</span>
          <span className="chip chip-blue">模型：{run ? (run.llm === "deepseek" ? "DeepSeek" : "离线规则") : "—"}</span>
          {run?.compliance?.issues?.length ? (
            <span className="chip chip-red">⚠ 合规扫描命中</span>
          ) : (
            <span className="chip chip-green">合规：通过</span>
          )}
        </div>
      </header>

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
            {loading ? "运行中…" : "开始研究"}
          </button>
          {loading && (
            <button className="btn btn-danger" onClick={stopAgent}>
              停止
            </button>
          )}
          <button className="btn btn-ghost" onClick={listHistory}>
            历史检查点
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

      {error && <div className="banner banner-error">请求失败：{error}</div>}
      {loading && (
        <div className="banner banner-info">
          <span className="loading">
            <span className="loading-rod" />
            Agent 正在规划并逐项取证（可点「停止」中断）…
          </span>
        </div>
      )}

      {showHistory && (
        <section className="card">
          <h2>历史检查点（记忆 / 恢复）</h2>
          {history.length === 0 ? (
            <p className="muted">暂无保存的运行。</p>
          ) : (
            <ul className="history-list">
              {history.map((id) => (
                <li key={id}>
                  <code>{id}</code>
                  <button className="btn btn-small" onClick={() => recover(id)}>
                    恢复
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {run && <ResultView run={run} />}

      <footer className="disclaimer">
        {run?.synthesis?.disclaimer || "基于公开/示例数据的整理与推断，不构成投资建议。"}
      </footer>
    </div>
  );
}

function ResultView({ run }) {
  const [expanded, setExpanded] = useState(null);

  const symbols = Object.keys(run.synthesis.bySymbol);

  return (
    <div className="result">
      <div className="run-meta muted">
        run #{run.id} · 创建于 {run.createdAt}
        {run.checkpointPath ? <> · 检查点已保存</> : <> · 检查点仅内存（只读环境）</>}
      </div>

      <div className="grid">
        <div className="col-left">
          <TaskPanel tasks={run.tasks} />
          <TracePanel trace={run.trace} />
        </div>

        <div className="col-right">
          {symbols.length > 1 && <ComparisonPanel comparison={run.synthesis.comparison} />}

          {symbols.map((s) => {
            const g = run.synthesis.bySymbol[s];
            return (
              <section key={s} className="card">
                <h2>
                  {g.name} <span className="muted">（{s}）</span>
                </h2>
                <ConclusionCard c={g.conclusion} />
                <EvidenceGroup title="支持" stance="support" items={g.evidence.filter((e) => e.stance === "support")} expanded={expanded} setExpanded={setExpanded} />
                <EvidenceGroup title="反对" stance="against" items={g.evidence.filter((e) => e.stance === "against")} expanded={expanded} setExpanded={setExpanded} />
                <EvidenceGroup title="无法验证" stance="unverifiable" items={[...g.evidence.filter((e) => e.stance === "unverifiable"), ...g.unverifiable]} expanded={expanded} setExpanded={setExpanded} />
                {g.materials.length > 0 && <MaterialsPanel items={g.materials} />}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TaskPanel({ tasks }) {
  return (
    <section className="card">
      <h2>任务计划（Agent 规划）</h2>
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
  const s = trace.summary;
  return (
    <section className="card">
      <h2>可观测（步骤 / 成本）</h2>
      <div className="stats">
        <Stat label="步骤" value={s.steps} />
        <Stat label="调用工具" value={s.toolsCalled} />
        <Stat label="时延" value={`${s.totalLatencyMs}ms`} />
        <Stat label="token" value={s.totalTokens || "—"} />
      </div>
      <ul className="trace-list">
        {trace.events.map((ev, i) => (
          <li key={i}>
            <span className={`dot dot-${ev.status}`} />
            <span className="muted">#{ev.step}</span> {ev.label}
            {ev.latencyMs ? <span className="muted"> ({ev.latencyMs}ms)</span> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Stat({ label, value }) {
  return (
    <div className="stat">
      <div className="stat-value">{value}</div>
      <div className="stat-label muted">{label}</div>
    </div>
  );
}

function ComparisonPanel({ comparison }) {
  return (
    <section className="card">
      <h2>标的对比</h2>
      <table className="cmp-table">
        <thead>
          <tr><th>标的</th><th>支持</th><th>反对</th><th>无法验证</th><th>倾向</th></tr>
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

function EvidenceGroup({ title, stance, items, expanded, setExpanded }) {
  if (!items.length) return null;
  return (
    <div className="evidence-group">
      <h3 className={`ev-title ev-title-${stance}`}>
        {title} <span className="muted">（{items.length}）</span>
      </h3>
      <ul className="evidence-list">
        {items.map((e, i) => {
          const key = `${e.source?.field || e.source?.tool}-${i}`;
          const open = expanded === key;
          const kind = e.type || (e.stance === "unverifiable" ? "uncertain" : "fact");
          return (
            <li key={key} className={`evidence ev-${kind}`}>
              <div className="evidence-main">
                <span className={`badge badge-${kind}`}>{KIND[kind] || kind}</span>
                <span className={`evidence-claim claim-${kind}`}>{e.claim}</span>
              </div>
              <button className="btn btn-trace" onClick={() => setExpanded(open ? null : key)}>
                {open ? "收起来源" : "追溯来源"}
              </button>
              {open && (
                <pre className="source-box">{JSON.stringify(e.source, null, 2)}</pre>
              )}
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
