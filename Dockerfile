FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=5173
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN corepack enable && pnpm install --prod --frozen-lockfile
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
EXPOSE 5173
CMD ["pnpm", "start"]
