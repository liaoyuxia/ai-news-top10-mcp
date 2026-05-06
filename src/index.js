#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { formatNewsMarkdown, getDailyAiNewsTop10 } from "./news.js";

const server = new McpServer(
  {
    name: "ai-news-top10",
    version: "0.1.0"
  },
  {
    instructions:
      "Use get_daily_ai_news_top10 to fetch the latest AI news before writing any daily AI news brief. The tool returns ranked source links and short context; the client model should produce the final editorial summary."
  }
);

server.registerTool(
  "get_daily_ai_news_top10",
  {
    title: "Get Daily AI News Top 10",
    description:
      "Fetch and rank the latest AI news from Google News RSS and selected AI/tech RSS feeds. Returns Markdown suitable for a daily Chinese AI news brief.",
    inputSchema: {
      language: z
        .enum(["zh", "en", "mixed"])
        .default("mixed")
        .describe("News search language. mixed includes Chinese and English candidates."),
      limit: z.number().int().min(1).max(20).default(10).describe("Number of news items."),
      hoursBack: z
        .number()
        .int()
        .min(1)
        .max(168)
        .default(24)
        .describe("Lookback window in hours."),
      candidateLimit: z
        .number()
        .int()
        .min(10)
        .max(100)
        .default(50)
        .describe("Number of ranked candidates to consider before diversification."),
      maxPerHost: z
        .number()
        .int()
        .min(1)
        .max(5)
        .default(2)
        .describe("Maximum news items from the same source host in the final list."),
      translateEnglishTitles: z
        .boolean()
        .default(true)
        .describe("Translate selected English titles to Chinese for display without using an LLM."),
      verifyArticleDates: z
        .boolean()
        .default(true)
        .describe("Fetch candidate article pages and prefer article-level publish dates over RSS dates."),
      includeFailedFeeds: z
        .boolean()
        .default(false)
        .describe("Whether to include failed feed diagnostics in the output.")
    }
  },
  async ({
    language,
    limit,
    hoursBack,
    candidateLimit,
    maxPerHost,
    translateEnglishTitles,
    verifyArticleDates,
    includeFailedFeeds
  }) => {
    const result = await getDailyAiNewsTop10({
      language,
      limit,
      hoursBack,
      candidateLimit,
      maxPerHost,
      verifyArticleDates,
      translateEnglishTitles,
      includeFailedFeeds
    });

    return {
      content: [
        {
          type: "text",
          text: formatNewsMarkdown(result)
        }
      ],
      structuredContent: result
    };
  }
);

server.registerPrompt(
  "write_daily_ai_news_brief",
  {
    title: "Write Daily AI News Brief",
    description:
      "Turn the fetched Top 10 AI news list into a concise Chinese daily brief with headline, trend summary, and action notes.",
    argsSchema: {
      audience: z
        .string()
        .default("自媒体人、AI 产品经理、创业者")
        .describe("Target audience for the brief."),
      tone: z.string().default("专业、克制、适合公众号/知识星球").describe("Writing tone.")
    }
  },
  ({ audience, tone }) => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text:
            "请先调用 get_daily_ai_news_top10，参数 language=mixed、limit=10、hoursBack=24。" +
            `然后面向「${audience}」，用「${tone}」的语气，生成一份今日 AI 资讯 Top 10：` +
            "包含一句话总览、10 条新闻卡片、今日趋势判断、以及 3 条可执行选题建议。"
        }
      }
    ]
  })
);

const transport = new StdioServerTransport();
await server.connect(transport);
