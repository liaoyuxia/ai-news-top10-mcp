# AI News Top 10 MCP

这个 MCP（Model Context Protocol，模型上下文协议）用于每天生成“今日 AI 资讯 Top 10”。它会从 Google News RSS 和部分 AI/科技媒体 RSS 获取最新内容，做去重、时间过滤和简单热度排序，然后把结果返回给 MCP 客户端。

## 能力

- `get_daily_ai_news_top10`：抓取最近 AI 新闻并返回 Markdown 和结构化 JSON
- `write_daily_ai_news_brief`：提示词模板，要求客户端先调用工具，再生成中文日报
- `npm run daily`：不经过 MCP，直接在终端输出今日 Top 10，方便接定时任务

## 安装

```bash
npm install
```

## 本地运行

```bash
npm run daily
```

启动 MCP Server：

```bash
npm start
```

运行 MCP 烟测（会启动本地 server 并调用一次工具）：

```bash
npm run smoke
```

## 飞书连通性验证

先在飞书群里添加自定义机器人，复制 Webhook 地址。如果机器人开启了签名校验，还需要复制签名密钥。

推荐把密钥放到本地 `.env` 文件：

```bash
cp .env.example .env
```

然后编辑 `.env`：

```bash
FEISHU_WEBHOOK=https://open.feishu.cn/open-apis/bot/v2/hook/xxxx
FEISHU_SECRET=
```

如果开启了签名校验，就把 `FEISHU_SECRET` 填上。

```bash
FEISHU_WEBHOOK="https://open.feishu.cn/open-apis/bot/v2/hook/xxxx" npm run feishu:test
```

如果开启了签名校验：

```bash
FEISHU_WEBHOOK="https://open.feishu.cn/open-apis/bot/v2/hook/xxxx" \
FEISHU_SECRET="your-sign-secret" \
npm run feishu:test
```

如果已经写入 `.env`，直接运行：

```bash
npm run feishu:test
```

发送今日 AI 资讯 Top 10 到飞书。这个命令使用飞书 `post` 富文本消息，不会把 Markdown 原文直接贴进群里：

```bash
FEISHU_WEBHOOK="https://open.feishu.cn/open-apis/bot/v2/hook/xxxx" npm run feishu:daily
```

如果开启了签名校验：

```bash
FEISHU_WEBHOOK="https://open.feishu.cn/open-apis/bot/v2/hook/xxxx" \
FEISHU_SECRET="your-sign-secret" \
npm run feishu:daily
```

可选参数：

```bash
NEWS_LIMIT=10 \
NEWS_HOURS_BACK=24 \
NEWS_LANGUAGE=mixed \
NEWS_CANDIDATE_LIMIT=50 \
NEWS_MAX_PER_HOST=2 \
NEWS_VERIFY_ARTICLE_DATES=true \
NEWS_TRANSLATE_ENGLISH_TITLES=true \
NEWS_TRANSLATION_PROVIDERS=baidu,google,mymemory \
NEWS_INCLUDE_GOOGLE_NEWS=true \
NEWS_INCLUDE_FAILED_FEEDS=false \
npm run feishu:daily
```

如果已经写入 `.env`，直接运行：

```bash
npm run feishu:daily
```

## macOS 每日定时推送

项目内提供了 LaunchAgent 配置，默认每天 `08:30` 执行飞书日报推送。

安装到当前用户：

```bash
chmod +x scripts/run-feishu-daily.sh
mkdir -p ~/Library/LaunchAgents
cp launchagents/com.liaowubing.ai-news-top10.feishu.daily.plist ~/Library/LaunchAgents/
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.liaowubing.ai-news-top10.feishu.daily.plist
launchctl enable gui/$(id -u)/com.liaowubing.ai-news-top10.feishu.daily
```

立即手动触发一次：

```bash
launchctl kickstart -k gui/$(id -u)/com.liaowubing.ai-news-top10.feishu.daily
```

查看日志：

```bash
tail -n 80 logs/feishu-daily.out.log
tail -n 80 logs/feishu-daily.err.log
```

卸载定时任务：

```bash
launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/com.liaowubing.ai-news-top10.feishu.daily.plist
rm ~/Library/LaunchAgents/com.liaowubing.ai-news-top10.feishu.daily.plist
```

## 排序与过滤规则

当前版本没有调用大模型，使用规则做编辑筛选：

- 候选池默认取前 `50` 条，再输出 Top 10
- `NEWS_LANGUAGE=mixed` 会同时拉取中文和英文 Google News 候选
- `NEWS_INCLUDE_GOOGLE_NEWS=false` 可关闭 Google News 候选，适合无法访问 `news.google.com` 的服务器
- `NEWS_INCLUDE_FAILED_FEEDS=true` 会把抓取失败的数据源追加到飞书消息里，适合排查问题
- 入选的英文标题会翻译成中文展示，英文原题保留在结构化结果里
- `NEWS_TRANSLATION_PROVIDERS=baidu,google,mymemory` 会按顺序尝试翻译服务。国内服务器推荐配置百度翻译密钥
- `BAIDU_TRANSLATE_APP_ID` / `BAIDU_TRANSLATE_SECRET` 是百度翻译开放平台的 App ID 和密钥，用于服务器无法访问 Google Translate 时稳定翻译英文标题
- 默认会抓取候选原文页面，优先使用原文发布时间而不是 RSS/Google News 聚合时间
- 官方源、一线科技媒体、AI 垂直媒体、中文科技/财经媒体有不同来源权重
- 聚合站和低质量站点会降权
- CSDN、Sohu、百度百家号、头条等低质量转载源会过滤
- 明显标题党词会过滤，例如“震惊”“突发”“翻车了”“偷偷蒸馏”
- 同一个来源域名默认最多进入 `2` 条，避免单一媒体刷屏

## MCP 客户端配置

把下面路径换成你的真实路径：

```json
{
  "mcpServers": {
    "ai-news-top10": {
      "command": "node",
      "args": [
        "/Users/liaowubing/Documents/codex_workspace/makemoney/ai-news-top10-mcp/src/index.js"
      ]
    }
  }
}
```

## 每天自动生成

MCP Server 本身通常不负责定时调度，定时任务应由客户端、系统任务或自动化工具触发。最简单的方式是每天运行：

```bash
cd /Users/liaowubing/Documents/codex_workspace/makemoney/ai-news-top10-mcp
npm run daily
```

后续可以接入：

- macOS LaunchAgent：macOS 原生定时任务
- cron：类 Unix 系统常见定时任务
- Codex / ChatGPT 自动化：让客户端每天定时调用 MCP 工具

## 数据源说明

当前数据源包括：

- Google News RSS 搜索：覆盖中文和英文 AI 新闻
- OpenAI News RSS
- Google AI Blog
- TechCrunch AI
- VentureBeat AI
- MIT Technology Review AI
- Planet AI 聚合源

排序不是阅读量榜单，而是“近期 AI 信息流优先级”：综合发布时间、关键词、来源权重和重复出现次数。更精确的热度榜可以后续接入社媒传播数据、媒体引用次数或搜索指数。
