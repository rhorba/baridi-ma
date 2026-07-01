FROM node:22-alpine AS base
WORKDIR /repo
COPY package.json package-lock.json* tsconfig.base.json ./
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY services/shipment/package.json services/shipment/package.json
RUN npm install --workspace=@baridi-ma/shared-types --workspace=@baridi-ma/shipment-service --include-workspace-root
COPY packages/shared-types packages/shared-types
COPY services/shipment services/shipment
RUN npm run build --workspace=@baridi-ma/shared-types
RUN npm run build --workspace=@baridi-ma/shipment-service
WORKDIR /repo/services/shipment
EXPOSE 4002
USER node
CMD ["node", "dist/main.js"]
