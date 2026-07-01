FROM node:22-alpine
WORKDIR /app
COPY simulator/package.json simulator/package-lock.json* ./
RUN npm install
COPY simulator/tsconfig.json ./
COPY simulator/src ./src
USER node
CMD ["npx", "tsx", "src/main.ts"]
