# syntax=docker/dockerfile:1
# ทดสอบแล้วกับ next 16.1.6 / react 19 / node 22 — build ได้ standalone จริง

FROM node:22-slim AS base
WORKDIR /app

# ---------- deps ----------
FROM base AS deps
# เครื่องมือ build เผื่อ bcrypt ต้องคอมไพล์ (native module) — อยู่แค่ stage นี้ ไม่ติดไป image สุดท้าย
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

# ---------- builder ----------
FROM base AS builder
# Next 16 + Turbopack build กินแรมเยอะ (โปรเจกมี ~69 route) เพิ่ม heap กัน OOM
# หมายเหตุ: เครื่อง host/WSL ต้องมีแรมให้ Docker มากกว่าค่านี้ ไม่งั้นโดน OOM kill ก่อน
ENV NODE_OPTIONS=--max-old-space-size=6144
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# หมายเหตุสำคัญตอน build:
#  1) ต้องมีไฟล์ .env.production ใน context — next build จะอ่านค่า env จากไฟล์นี้
#     (โดยเฉพาะ NEXT_PUBLIC_SYNC_SECRET ที่ถูก inline เข้า bundle + ผ่านด่านเช็ค env ใน lib/db.ts)
#  2) เครื่องที่ build ต้องต่อเน็ตได้ เพราะ next/font/google โหลดฟอนต์ Prompt ตอน build
#  3) ข้าม type-check ใน container (ตั้ง ignoreBuildErrors ใน next.config.ts)
#     เพราะขั้นนี้กินแรมหนักจน OOM — deploy script ต้องรัน `npx tsc --noEmit` ก่อน docker build เสมอ
RUN npm run build

# ---------- runner (production) ----------
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# รันด้วย user ที่ไม่ใช่ root
RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs nextjs

# copy เฉพาะผลลัพธ์ standalone (image เล็ก + secret ใน .env.production ไม่ติดไป image นี้)
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]