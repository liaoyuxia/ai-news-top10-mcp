import { loadDotEnv } from "../src/env.js";
import { getDailyAiNewsTop10 } from "../src/news.js";
import { buildDailyNewsPost, sendFeishuPost } from "../src/feishu.js";

loadDotEnv();

const limit = Number.parseInt(process.env.NEWS_LIMIT || "10", 10);
const hoursBack = Number.parseInt(process.env.NEWS_HOURS_BACK || "24", 10);
const candidateLimit = Number.parseInt(process.env.NEWS_CANDIDATE_LIMIT || "50", 10);
const maxPerHost = Number.parseInt(process.env.NEWS_MAX_PER_HOST || "2", 10);
const verifyArticleDates = process.env.NEWS_VERIFY_ARTICLE_DATES !== "false";
const translateEnglishTitles = process.env.NEWS_TRANSLATE_ENGLISH_TITLES !== "false";
const language = ["zh", "en", "mixed"].includes(process.env.NEWS_LANGUAGE)
  ? process.env.NEWS_LANGUAGE
  : "mixed";

try {
  const result = await getDailyAiNewsTop10({
    language,
    limit,
    hoursBack,
    candidateLimit,
    maxPerHost,
    verifyArticleDates,
    translateEnglishTitles,
    includeFailedFeeds: true
  });

  const post = buildDailyNewsPost(result);
  const response = await sendFeishuPost({
    webhook: process.env.FEISHU_WEBHOOK,
    secret: process.env.FEISHU_SECRET,
    title: post.title,
    content: post.content
  });

  console.log(`Daily AI news sent to Feishu. Items: ${result.count}`);
  console.log(JSON.stringify(response, null, 2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
