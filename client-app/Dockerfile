FROM node:18-alpine

WORKDIR /app

# Instalar dependencias
COPY package*.json ./
RUN npm install

# Copiar el código fuente
COPY . .

# Compilar Next.js para producción
RUN npm run build

EXPOSE 3000

# Iniciar Next.js en modo producción
CMD ["npm", "start"]
