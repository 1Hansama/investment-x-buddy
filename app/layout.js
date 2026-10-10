import "./globals.css";

export const metadata = {
  title: "投资 X Buddy — 个人投资研究 Agent 工作台",
  description:
    "把研究目标拆成任务、调用金融工具取证、产出可追溯结论的 Agent 工作台（演示使用示例数据）",
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
