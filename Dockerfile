# The client is built in one stage; the server needs no build (Node runs the TypeScript).
FROM node:24-slim AS build
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --non-interactive
COPY . .
RUN yarn build

FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --non-interactive --production && yarn cache clean
COPY src ./src
COPY migrations ./migrations
COPY seeds ./seeds
COPY --from=build /app/dist ./dist
USER node
# Migrations run before the server starts. knex holds a lock, so two instances starting
# at once take turns, and an up-to-date database makes this a no-op.
CMD ["sh", "-c", "node src/server/db/migrate.ts latest && exec node src/server/main.ts"]
