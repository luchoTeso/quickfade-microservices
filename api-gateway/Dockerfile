FROM node:18-alpine

WORKDIR /app

# Instalar dependencias
COPY package*.json ./
RUN npm install --omit=dev

# Copiar el código fuente
COPY . .

EXPOSE 8080

# Iniciar el servicio
CMD ["node", "src/index.js"]
