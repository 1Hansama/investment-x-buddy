// 大模型接入层：统一封装 DeepSeek（OpenAI 兼容接口）。
// 为什么单独一层？因为「规划」和「综合」两步都要调 LLM，如果以后换模型，
// 只改这一个文件即可（可插拔）。没配 key 时 hasLLM() 返回 false，
// 上层会用离线确定性逻辑兜底，保证主链路仍然能跑通。

const BASE_URL = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
const MODEL = process.env.DEEPSEEK_MODEL || "deepseek-chat";

export function hasLLM() {
  return Boolean(process.env.DEEPSEEK_API_KEY);
}

// 调用一次对话补全。json=true 时要求模型返回 JSON，方便程序解析。
export async function chat({ system, user, json = false, temperature = 0.2 }) {
  if (!hasLLM()) {
    throw new Error("LLM 未配置（缺少 DEEPSEEK_API_KEY）");
  }

  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      temperature,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      ...(json ? { response_format: { type: "json_object" } } : {}),
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LLM 调用失败 ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content ?? "";
  if (!content) throw new Error("LLM 返回为空");
  return content;
}

// 把模型可能用 ```json ... ``` 包裹的内容安全解析成对象。
export function parseJSON(text) {
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  return JSON.parse(cleaned);
}
