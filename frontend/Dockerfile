FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json .
RUN npm ci
COPY . .
# Vite bakes VITE_* vars into the static bundle at build time, so this has to
# be a build ARG (passed via docker-compose's `build.args`), not a runtime
# environment variable -- it's not readable once the container is running.
ARG VITE_YANDEX_MAPS_API_KEY
ENV VITE_YANDEX_MAPS_API_KEY=$VITE_YANDEX_MAPS_API_KEY
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
