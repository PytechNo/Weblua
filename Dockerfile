# syntax=docker/dockerfile:1

FROM node:22-slim AS build
WORKDIR /app

# package-lock.json is written by npm 11. Node 22 bundles npm 10, whose `npm ci`
# rejects npm 11 lockfiles that nest optional peers (such as @emnapi/*) instead
# of hoisting them, so validate the lockfile with the npm major that wrote it.
RUN npm install -g npm@11

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
