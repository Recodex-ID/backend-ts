FROM node:18-slim
WORKDIR /app
COPY package*.json ./
RUN npm install --only=production && npm audit fix --production
COPY dist ./dist
CMD ["npm", "run", "start"]
EXPOSE 80 350 351
