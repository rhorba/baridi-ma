FROM node:22-alpine AS base
WORKDIR /repo
COPY package.json package-lock.json* tsconfig.base.json ./
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY services/alerting/package.json services/alerting/package.json
RUN npm install --workspace=@baridi-ma/shared-types --workspace=@baridi-ma/alerting-service --include-workspace-root
COPY packages/shared-types packages/shared-types
COPY services/alerting services/alerting
RUN npm run build --workspace=@baridi-ma/shared-types
RUN npm run build --workspace=@baridi-ma/alerting-service
WORKDIR /repo/services/alerting
EXPOSE 4004
USER node
CMD ["node", "dist/main.js"]
