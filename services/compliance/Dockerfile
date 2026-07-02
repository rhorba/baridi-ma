FROM node:22-alpine AS base
WORKDIR /repo
COPY package.json package-lock.json* tsconfig.base.json ./
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY services/compliance/package.json services/compliance/package.json
RUN npm install --workspace=@baridi-ma/shared-types --workspace=@baridi-ma/compliance-service --include-workspace-root
COPY packages/shared-types packages/shared-types
COPY services/compliance services/compliance
RUN npm run build --workspace=@baridi-ma/shared-types
RUN npm run build --workspace=@baridi-ma/compliance-service
WORKDIR /repo/services/compliance
EXPOSE 4005
USER node
CMD ["node", "dist/main.js"]
