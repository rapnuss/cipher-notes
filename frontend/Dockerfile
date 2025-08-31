FROM node:20-alpine AS build
WORKDIR /app

# Enable corepack to ensure Yarn is available and versioned correctly
RUN corepack enable

# Install dependencies first for better layer caching
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

# Copy the rest of the source and build
COPY . .

# Build-time configuration for the static bundle
ARG HOSTING_MODE=self
ARG HCAPTCHA_SITE_KEY=
ENV NODE_ENV=production \
    HOSTING_MODE=$HOSTING_MODE \
    HCAPTCHA_SITE_KEY=$HCAPTCHA_SITE_KEY

RUN yarn build

FROM nginx:1.27-alpine AS runtime

# Copy custom nginx config (serves SPA and proxies /api and /socket.io)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Static frontend assets
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]


