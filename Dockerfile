# ---------- Stage 1: Build (Node) ----------
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi
COPY . .
# Unit-Tests laufen beim Build mit – schlägt ein Test fehl, bricht der Build ab.
RUN npm test && npm run build

# ---------- Stage 2: Auslieferung (nginx) ----------
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
