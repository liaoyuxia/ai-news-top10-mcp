import { loadDotEnv } from "../src/env.js";
import { sendFeishuText } from "../src/feishu.js";

loadDotEnv();

const text =
  process.env.FEISHU_TEXT ||
  [
    "AI 资讯 Top10 MCP 连通性验证成功",
    `发送时间：${new Date().toLocaleString("zh-CN", {
      timeZone: "Asia/Shanghai",
      hour12: false
    })}`,
    "下一步可以接入每日定时推送。"
  ].join("\n");

try {
  const result = await sendFeishuText({
    webhook: process.env.FEISHU_WEBHOOK,
    secret: process.env.FEISHU_SECRET,
    text
  });

  console.log("Feishu test message sent successfully.");
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
