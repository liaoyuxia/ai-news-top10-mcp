import { createHmac } from "node:crypto";

function createSign(secret, timestamp) {
  const stringToSign = `${timestamp}\n${secret}`;
  return createHmac("sha256", Buffer.from(stringToSign, "utf8"))
    .update("")
    .digest("base64");
}

function assertWebhook(webhook) {
  if (!webhook) {
    throw new Error("Missing FEISHU_WEBHOOK.");
  }

  const url = new URL(webhook);
  if (!["https:", "http:"].includes(url.protocol)) {
    throw new Error("FEISHU_WEBHOOK must be an HTTP(S) URL.");
  }
}

export async function sendFeishuText({ webhook, secret, text }) {
  assertWebhook(webhook);

  return sendFeishuPayload({
    webhook,
    secret,
    payload: {
      msg_type: "text",
      content: {
        text
      }
    }
  });
}

export async function sendFeishuPost({ webhook, secret, title, content }) {
  assertWebhook(webhook);

  const payload = {
    msg_type: "post",
    content: {
      post: {
        zh_cn: {
          title,
          content
        }
      }
    }
  };

  try {
    return await sendFeishuPayload({
      webhook,
      secret,
      payload
    });
  } catch (error) {
    if (!String(error.message).includes("params error")) {
      throw error;
    }

    return sendFeishuPayload({
      webhook,
      secret,
      payload: {
        msg_type: "post",
        content: {
          zh_cn: {
            title,
            content
          }
        }
      }
    });
  }
}

export async function sendFeishuPostWrapped({ webhook, secret, title, content }) {
  assertWebhook(webhook);

  return sendFeishuPayload({
    webhook,
    secret,
    payload: {
      msg_type: "post",
      content: {
        post: {
          zh_cn: {
            title,
            content
          }
        }
      }
    }
  });
}

export function buildDailyNewsPost(result) {
  const generatedAt = new Date(result.generatedAt).toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour12: false
  });

  const content = [
    [text(`生成时间：${generatedAt}｜最近 ${result.hoursBack} 小时`)],
    [text("今日主线：模型迭代、Agent 产品、算力竞争、商业化与安全治理。")],
    [text("【重点速览】")]
  ];

  result.items.slice(0, 3).forEach((item, index) => {
    content.push([text(`${index + 1}. ${buildOneLineTakeawayTitle(item)}`)]);
    content.push([text(`   ${item.sourceHost || item.source}｜热度 ${item.score}`)]);
  });

  content.push([text("────────────────")], [text("【详细列表】")]);

  result.items.forEach((item, index) => {
    const published = item.publishedAt
      ? item.publishedAt.toLocaleString("zh-CN", {
          timeZone: "Asia/Shanghai",
          hour12: false,
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit"
        })
      : "未知";
    const title = cleanNewsTitle(item.displayTitle || item.title, 86);
    const importance = cleanImportance(item.importance);

    content.push(
      [text(`${String(index + 1).padStart(2, "0")}｜${title}`)],
      [text(`看点：${importance}`)],
      [text(`${item.sourceHost || item.source}｜${published}｜热度 ${item.score}`)],
      [link("阅读全文", item.link)],
      [text("────────────────")]
    );
  });

  if (result.failedFeeds?.length) {
    content.push(
      [text("抓取失败的数据源")],
      ...result.failedFeeds.map((feed) => [text(cleanText(feed, 160))])
    );
  }

  return {
    title: `今日 AI 资讯 Top ${result.count}`,
    content
  };
}

async function sendFeishuPayload({ webhook, secret, payload }) {
  assertWebhook(webhook);

  const requestPayload = {
    ...payload
  };

  if (secret) {
    const timestamp = Math.floor(Date.now() / 1000);
    requestPayload.timestamp = timestamp;
    requestPayload.sign = createSign(secret, timestamp);
  }

  const response = await fetch(webhook, {
    method: "POST",
    headers: {
      "content-type": "application/json; charset=utf-8"
    },
    body: JSON.stringify(requestPayload)
  });

  const bodyText = await response.text();
  let body;
  try {
    body = JSON.parse(bodyText);
  } catch {
    body = bodyText;
  }

  if (!response.ok) {
    throw new Error(`Feishu HTTP ${response.status}: ${bodyText}`);
  }

  const code = body?.code ?? body?.StatusCode ?? body?.status_code ?? 0;
  if (code !== 0) {
    const message = body?.msg ?? body?.StatusMessage ?? body?.message ?? bodyText;
    throw new Error(`Feishu rejected the message: ${message}`);
  }

  return body;
}

function text(value) {
  return {
    tag: "text",
    text: value
  };
}

function link(label, href) {
  return {
    tag: "a",
    text: label,
    href
  };
}

function cleanText(value = "", maxLength = 200) {
  const normalized = String(value)
    .replaceAll("&nbsp;", " ")
    .replace(/\s+/g, " ")
    .trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1)}…`;
}

function cleanNewsTitle(value = "", maxLength = 86) {
  const normalized = cleanText(value, 200)
    .replace(/[_｜|].*?(手机新浪网|新浪财经|纽约时报|ChatGPT|Google|Grok).*$/i, "")
    .replace(/\s+-\s+[^-]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return cleanText(normalized || value, maxLength);
}

function cleanImportance(value = "") {
  const normalized = cleanText(value, 160)
    .replace(/^命中\s*/u, "")
    .replace(/等关键词，适合作为今日 AI 行业重点跟进。?$/u, "")
    .trim();

  if (!normalized) return "近期 AI 行业重点动态，值得跟进。";
  return `关键词：${cleanText(normalized, 64)}`;
}

function buildOneLineTakeawayTitle(item) {
  return cleanNewsTitle(item.displayTitle || item.title, 72);
}
