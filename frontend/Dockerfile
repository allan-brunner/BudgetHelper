FROM node:22-bookworm-slim AS base
WORKDIR /app
COPY package*.json ./
RUN npm install

# Development stage
FROM base AS dev
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev"]

# Production build stage
FROM base AS build
COPY . .
RUN npm run build

# Production server stage
FROM nginx:alpine AS prod
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]