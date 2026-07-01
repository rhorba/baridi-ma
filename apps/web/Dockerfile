FROM node:22-alpine AS base
WORKDIR /repo
COPY package.json package-lock.json* tsconfig.base.json ./
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm install --workspace=@baridi-ma/shared-types --workspace=@baridi-ma/web --include-workspace-root
COPY packages/shared-types packages/shared-types
COPY apps/web apps/web
RUN npm run build --workspace=@baridi-ma/shared-types
RUN npm run build --workspace=@baridi-ma/web
WORKDIR /repo/apps/web
EXPOSE 3000
USER node
CMD ["npm", "run", "start"]
