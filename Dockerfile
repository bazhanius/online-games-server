FROM node:lts-alpine

# создание директории приложения
WORKDIR /usr/src/websocket-node-server

# установка зависимостей
# символ астериск ("*") используется для того чтобы по возможности
# скопировать оба файла: package.json и package-lock.json

COPY package*.json ./

# для девелопа
# RUN npm install

# для продакшн
RUN npm ci --omit=dev

# копируем исходный код
COPY . .
EXPOSE 8484
CMD [ "node", "server.js" ]