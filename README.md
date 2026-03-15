# 多源时间看板 (Vue 3 + TypeScript + 阿里云 FC Web 函数)

## 功能
- 聚合淘宝/美团/苏宁时间接口 (`/api/time/aggregate`)
- 1 秒自动刷新 + 手动刷新
- 固定平台卡片（淘宝/美团/苏宁）
- 响应耗时排行
- 失败自动回退上次成功值（`stale`）
- 服务端 1 秒缓存 + in-flight 去重

## 本地开发
```bash
npm install
npm run dev
```

默认：
- 前端: `http://localhost:5173`
- 后端: `http://localhost:9000`

## 构建与运行
```bash
npm run build
npm run start
```

## 测试
```bash
npm test
```

## API 返回结构
`GET /api/time/aggregate`

```json
{
  "generatedAtMs": 1773552466000,
  "cacheAgeMs": 0,
  "sources": {
    "taobao": {
      "source": "taobao",
      "status": "ok",
      "serverTimeMs": 1773552465534,
      "serverTimeISO": "2026-03-15T05:27:45.534Z",
      "localDiffMs": -40,
      "latencyMs": 35,
      "fetchedAtMs": 1773552465574,
      "raw": {},
      "staleFromLastSuccess": false
    }
  }
}
```

`status`:
- `ok`: 当前拉取成功
- `stale`: 本次失败，回退到上次成功值
- `error`: 无历史成功值且当前失败

## 环境变量
可参考 `.env.example`：
- `PORT`: Web 服务端口，默认 `9000`
- `STATIC_DIR`: 静态文件目录，默认 `dist/client`
- `TIME_CACHE_TTL_MS`: 聚合缓存 TTL，默认 `1000`
- `TIME_REQUEST_TIMEOUT_MS`: 单请求超时，默认 `1200`
- `TZ`: 时区，建议 `Asia/Shanghai`


## Vercel 部署
本仓库已适配 Vercel：
- 前端由 Vite 构建并部署为静态站点。
- `api/time/aggregate.ts` 作为 Vercel Serverless Function 提供 `/api/time/aggregate`。
- `vercel.json` 已添加 SPA 路由重写，确保前端路由刷新可用。

部署步骤：
1. 在 Vercel 导入仓库。
2. Framework Preset 选择 **Vite**（通常会自动识别）。
3. 保持默认 Build Command：`npm run build:client`（或 `vite build`）。
4. 部署后访问：
   - 页面：`/`
   - 接口：`/api/time/aggregate`

> 说明：本地 `npm run dev` 仍走 Node 服务 + Vite 代理；Vercel 线上使用 `api/` Serverless 函数。

## 阿里云 FC 部署
1. 构建项目：`npm run build`
2. 安装并登录 Serverless Devs (`s`)。
3. 根目录执行：`s deploy`
4. 访问 FC HTTP Trigger URL。

仓库内提供了 `s.yaml`（FC3）示例，可按你的账号、地域与服务名修改。
