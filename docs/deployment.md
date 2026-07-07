# 公网部署说明

这个项目需要一个 Node.js 服务端，因为 API Key 必须留在服务端，不能放进浏览器前端。

## 必填环境变量

```bash
OPENAI_API_KEY=sk-your-api-key
OPENAI_BASE_URL=https://maylily.xyz/v1
OPENAI_MODEL=gpt-5-mini
HOST=0.0.0.0
PORT=5173
```

在 Render、Railway、Fly.io、VPS 或 Docker 平台里，把这些变量配置到平台的环境变量面板。不要把真实 API Key 提交到代码仓库。

## Render 固定网址部署

这个项目已经包含 `render.yaml`，可以用 Render Blueprint 部署。Render 会给你一个固定网址，例如：

```text
https://songshu-assistant.onrender.com
```

步骤：

1. 把项目上传到 GitHub。
2. 打开 Render，选择 **New +** -> **Blueprint**。
3. 连接这个 GitHub 仓库。
4. Render 读取 `render.yaml` 后，会要求填写 `OPENAI_API_KEY`。
5. 填入你的 API Key，然后点击部署。

`render.yaml` 已经配置好：

```bash
buildCommand: npm install -g pnpm@9.15.9 && pnpm install --frozen-lockfile && pnpm build
startCommand: pnpm start
```

免费 Render 服务可能会休眠，首次打开会慢一点。长期高频使用建议升级付费实例。

## Docker 部署

构建镜像：

```bash
docker build -t songshu-assistant .
```

运行容器：

```bash
docker run -p 5173:5173 --env-file .env songshu-assistant
```

然后打开：

```text
http://服务器IP:5173
```

## Node 平台部署

适合 Render、Railway、Fly.io 这类平台。

构建命令：

```bash
pnpm install --frozen-lockfile && pnpm build
```

启动命令：

```bash
pnpm start
```

如果平台自动提供 `PORT`，可以只配置 `OPENAI_API_KEY`、`OPENAI_BASE_URL`、`OPENAI_MODEL` 和 `HOST=0.0.0.0`。

## 域名和 HTTPS

正式给别人长期使用时，建议绑定域名并开启 HTTPS。例如：

```text
https://chat.yourdomain.com
```

如果用 VPS，可以用 Nginx 或 Caddy 做反向代理，把外部的 443 端口转发到本服务的 5173 端口。
