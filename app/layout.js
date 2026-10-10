import "./globals.css";

export const metadata = {
  title: "观隅 · 个人投研 Agent 工作台",
  description:
    "独坐一隅，灵悉万象 —— 把研究目标拆成任务、调用金融工具取证、产出可追溯结论的个人投资研究 Agent 工作台（演示使用示例数据）。",
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
