# ---------- Tahap 1: membangun tampilan web ----------
FROM node:24-slim AS bangun
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---------- Tahap 2: aplikasi siap jalan ----------
FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production \
    DATA_DIR=/data \
    TZ=Asia/Jakarta
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=bangun /app/dist ./dist
COPY server ./server
COPY templates ./templates
EXPOSE 3000
# Jalankan node langsung (bukan lewat npm) agar server berhenti dengan rapi saat Railway memperbarui aplikasi
CMD ["node", "--experimental-strip-types", "--disable-warning=ExperimentalWarning", "server/index.ts"]
