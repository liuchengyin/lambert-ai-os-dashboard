# Lambert AI OS Dashboard V2

模块：总览、项目看板、任务看板、每日复盘、知识入口、链接设置。

本地运行：
```bash
python3 -m http.server 8000
```

线上：适合直接部署到 Vercel。

注意：Notion / 飞书能否直接 iframe 嵌入，取决于分享权限和平台的 iframe/CSP 策略。即使不能嵌入，仍可保留“打开原页面”跳转。

## Codex 本地与云端开发

先阅读 [AGENTS.md](AGENTS.md) 和 [开发接手说明](docs/codex-development.md)。

```bash
npm run setup -- --browser
npm run dev
npm run check
```

本地预览支持网页和 `/mobile/`，不连接生产后端。开发模型通过 `npm run ai:assist -- --provider deepseek|glm` 预检；实际请求需 `--run`，只允许固定 Flash 型号并记录真实用量。
