# ---------- Stage 1: Build (Node) ----------
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# Unit-Tests laufen beim Build mit – schlägt ein Test fehl, bricht der Build ab.
RUN npm test && npm run build

# ---------- Stage 2: Auslieferung (nginx) ----------
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY nginx-security-headers.inc /etc/nginx/snippets/security-headers.inc
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
# Docker prüft regelmäßig, ob die Seite ausgeliefert wird (Status "healthy")
HEALTHCHECK --interval=5m --timeout=3s --start-period=20s --start-interval=2s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
