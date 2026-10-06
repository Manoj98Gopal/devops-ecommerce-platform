FROM node:22-alpine AS builder
ARG VITE_API_BASE_URL
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN VITE_API_BASE_URL=$VITE_API_BASE_URL npm run build


FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

