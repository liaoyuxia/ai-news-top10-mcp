#!/bin/zsh
set -euo pipefail

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

PROJECT_DIR="/Users/liaowubing/Documents/codex_workspace/makemoney/ai-news-top10-mcp"
LOG_DIR="$PROJECT_DIR/logs"

mkdir -p "$LOG_DIR"
cd "$PROJECT_DIR"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting AI news Feishu daily push"
/opt/homebrew/bin/npm run feishu:daily
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Finished AI news Feishu daily push"
