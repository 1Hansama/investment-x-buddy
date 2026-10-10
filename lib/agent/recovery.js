// 异常恢复（七大 harness 之一）：重试与熔断。
// 目标：单次瞬时失败（网络抖动、接口超时）不等于任务失败；连续失败则熔断止损。
//
// withRetry：只对「抛异常」的瞬时故障重试；工具正常返回 {ok:false}（确定性缺失）
// 不属于瞬时故障，不重试。

export async function withRetry(fn, { retries = 1, shouldRetry = () => true } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return { ok: true, value: await fn(), attempts: attempt + 1 };
    } catch (e) {
      lastErr = e;
      if (attempt >= retries || !shouldRetry(e)) break;
    }
  }
  return { ok: false, error: lastErr, attempts: retries + 1 };
}

// createCircuitBreaker：连续失败达到阈值即打开，冷却期后自动复位。
export function createCircuitBreaker({ threshold = 3, cooldownMs = 60_000 } = {}) {
  let failures = 0;
  let openUntil = 0;
  return {
    isOpen() {
      return Date.now() < openUntil;
    },
    record(success) {
      if (success) {
        failures = 0;
        openUntil = 0;
      } else {
        failures += 1;
        if (failures >= threshold) {
          openUntil = Date.now() + cooldownMs;
          failures = 0;
        }
      }
    },
  };
}
