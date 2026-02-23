# Imagem Node 18
FROM node:18-slim

WORKDIR /app

# Copia dependências
COPY package.json package-lock.json* ./
RUN npm install --production

# Copia o código do nosso bd
COPY server.js ./

# AI Core chama na porta 8080
ENV PORT=8080
EXPOSE 8080

CMD ["npm", "start"]
