# Node.js 18 tabanlı bir image kullanıyoruz
FROM node:18

# Çalışma dizinini belirliyoruz
WORKDIR /app

# package.json ve package-lock.json dosyalarını kopyalıyoruz
COPY package*.json ./

# Bağımlılıkları yüklüyoruz
RUN npm install

# Kaynak dosyaları kopyalıyoruz
COPY . .

# Uygulama portunu belirtiyoruz
EXPOSE 4000

# server.js'i başlatıyoruz
CMD ["node", "server.js"]
