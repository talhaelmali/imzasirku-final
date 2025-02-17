# Base image olarak resmi Node.js 18 Alpine kullanıyoruz (küçük ve hafif)
FROM node:18-alpine

# Çalışma dizinini belirle
WORKDIR /app

# Paket dosyalarını kopyala ve bağımlılıkları yükle
COPY package.json package-lock.json ./
RUN npm install --frozen-lockfile

# Uygulama kodlarını kopyala
COPY . .

# Next.js build işlemini yap
RUN npm run build

# Portu aç
EXPOSE 3000

# Uygulamayı başlat
CMD ["npm", "start"]
