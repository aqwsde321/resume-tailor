FROM node:20-bookworm-slim

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    git \
    tesseract-ocr \
    tesseract-ocr-eng \
    tesseract-ocr-kor \
  && rm -rf /var/lib/apt/lists/*

RUN npm install -g @openai/codex

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

RUN npm run build

ENV NODE_ENV=production

EXPOSE 3000

CMD ["sh", "-c", "npm run start -- --hostname ${HOSTNAME:-0.0.0.0} --port ${PORT:-3000}"]
