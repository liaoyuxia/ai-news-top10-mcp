import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: "node",
  args: ["src/index.js"],
  cwd: process.cwd(),
  stderr: "pipe"
});

const client = new Client({
  name: "ai-news-top10-smoke",
  version: "0.1.0"
});

try {
  await client.connect(transport);
  const tools = await client.listTools();
  const toolNames = tools.tools.map((tool) => tool.name);

  if (!toolNames.includes("get_daily_ai_news_top10")) {
    throw new Error(`Expected get_daily_ai_news_top10, got: ${toolNames.join(", ")}`);
  }

  const result = await client.callTool({
    name: "get_daily_ai_news_top10",
    arguments: {
      language: "zh",
      limit: 1,
      hoursBack: 24,
      includeFailedFeeds: true
    }
  });

  const text = result.content.find((item) => item.type === "text")?.text || "";
  if (!text.includes("今日 AI 资讯 Top")) {
    throw new Error("Tool response did not include the expected Markdown heading.");
  }

  console.log(`MCP smoke test passed. Tools: ${toolNames.join(", ")}`);
} finally {
  await client.close();
}
