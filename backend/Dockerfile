FROM node:22-bookworm-slim AS base
WORKDIR /app
COPY package.json ./

# Development stage
FROM base AS dev
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

# Production stage
FROM base AS prod
RUN npm install --omit=dev
COPY . .
EXPOSE 3000
CMD ["npm", "start"]