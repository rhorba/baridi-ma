FROM node:22-alpine AS base
WORKDIR /repo
COPY package.json package-lock.json* tsconfig.base.json ./
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY services/auth/package.json services/auth/package.json
RUN npm install --workspace=@baridi-ma/shared-types --workspace=@baridi-ma/auth-service --include-workspace-root
COPY packages/shared-types packages/shared-types
COPY services/auth services/auth
RUN npm run build --workspace=@baridi-ma/shared-types
RUN npm run build --workspace=@baridi-ma/auth-service
WORKDIR /repo/services/auth
EXPOSE 4001
USER node
CMD ["node", "dist/main.js"]
