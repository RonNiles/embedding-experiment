# Stage 1 — Build React app
FROM node:20 AS builder

WORKDIR /app

# install dependencies
COPY package*.json ./
RUN npm install

# copy source code
COPY . .

# build production bundle
RUN npm run build


# Stage 2 — Serve with nginx
FROM nginx:alpine

# remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# copy built React files
COPY --from=builder /app/dist /usr/share/nginx/html

# expose port
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

