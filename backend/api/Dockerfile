FROM node:20-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json ./
COPY frontend/admin-panel/package.json frontend/admin-panel/package.json
COPY backend/api/package.json backend/api/package.json
COPY frontend/mobile-app/package.json frontend/mobile-app/package.json
COPY frontend/owner-dashboard/package.json frontend/owner-dashboard/package.json
COPY backend/worker/package.json backend/worker/package.json
COPY packages/api-sdk/package.json packages/api-sdk/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/validation/package.json packages/validation/package.json

RUN npm ci --ignore-scripts

FROM deps AS build

COPY . .

RUN npm run db:generate && npm run build --workspace @beauty-finder/api

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/frontend ./frontend
COPY --from=build /app/backend ./backend
COPY --from=build /app/packages ./packages
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/package-lock.json ./package-lock.json

EXPOSE 3000

CMD ["node", "scripts/start-api-container.mjs"]
