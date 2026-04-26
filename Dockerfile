FROM node:20-alpine

WORKDIR /app

# 1. Copy package files
COPY package*.json ./

# 2. Fresh install (bcryptjs is pure JS, no build tools needed)
RUN rm -f package-lock.json && npm install

COPY . .

EXPOSE 5000

CMD ["npm", "run", "dev"]