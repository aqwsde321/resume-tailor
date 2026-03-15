FROM node:20-bookworm-slim AS base

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps

COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-bookworm-slim AS runner

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ARG TYPST_VERSION=0.14.2

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    git \
    tesseract-ocr \
    tesseract-ocr-eng \
    tesseract-ocr-kor \
    xz-utils \
  && arch="$(dpkg --print-architecture)" \
  && case "$arch" in \
    amd64) typst_arch="x86_64" ;; \
    arm64) typst_arch="aarch64" ;; \
    *) echo "Unsupported architecture: $arch" && exit 1 ;; \
  esac \
  && tmp_dir="$(mktemp -d)" \
  && curl -fsSL "https://github.com/typst/typst/releases/download/v${TYPST_VERSION}/typst-${typst_arch}-unknown-linux-musl.tar.xz" -o /tmp/typst.tar.xz \
  && tar -xJf /tmp/typst.tar.xz -C "$tmp_dir" \
  && install "$tmp_dir/typst-${typst_arch}-unknown-linux-musl/typst" /usr/local/bin/typst \
  && rm -rf "$tmp_dir" /tmp/typst.tar.xz \
  && rm -rf /var/lib/apt/lists/*

RUN npm install -g @openai/codex

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/src/templates ./src/templates
COPY --from=builder /app/skills ./skills

EXPOSE 3000

CMD ["sh", "-c", "HOSTNAME=${HOSTNAME:-0.0.0.0} PORT=${PORT:-3000} node server.js"]
