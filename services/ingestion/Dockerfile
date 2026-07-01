FROM node:22-alpine AS base
WORKDIR /repo
COPY package.json package-lock.json* tsconfig.base.json ./
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY services/ingestion/package.json services/ingestion/package.json
RUN npm install --workspace=@baridi-ma/shared-types --workspace=@baridi-ma/ingestion-service --include-workspace-root
COPY packages/shared-types packages/shared-types
COPY services/ingestion services/ingestion
RUN npm run build --workspace=@baridi-ma/shared-types
RUN npm run build --workspace=@baridi-ma/ingestion-service
WORKDIR /repo/services/ingestion
EXPOSE 4003
USER node
CMD ["node", "dist/main.js"]
