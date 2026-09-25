#!/bin/bash

# 🏴‍☠️ Sugoi Game - Chat Entrypoint
# Script de inicialização para o servidor de chat

set -e

# Cores para logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}💬 Inicializando Sugoi Game Chat Server...${NC}"

# Aguardar MySQL estar pronto
echo -e "${YELLOW}⚓ Aguardando MySQL...${NC}"
while ! mysqladmin ping -h"$DB_HOST" --silent; do
    echo "Aguardando MySQL estar pronto..."
    sleep 2
done
echo -e "${GREEN}✅ MySQL está pronto!${NC}"

# Verificar Node.js
echo -e "${YELLOW}🟢 Verificando Node.js...${NC}"
node --version
npm --version

# Verificar se package.json existe
echo -e "${YELLOW}📁 Verificando package.json...${NC}"
if [ ! -f "/app/package.json" ]; then
    echo -e "${RED}❌ package.json não encontrado!${NC}"
    exit 1
fi

# Verificar dependências
echo -e "${YELLOW}📦 Verificando dependências...${NC}"
if [ ! -d "/app/node_modules" ]; then
    echo -e "${YELLOW}📦 Instalando dependências...${NC}"
    npm ci --only=production
fi

# Criar diretórios necessários
echo -e "${YELLOW}📁 Criando diretórios necessários...${NC}"
mkdir -p /app/logs
chown -R nodejs:nodejs /app/logs

# Testar conexão com banco (se houver cliente MySQL disponível)
if command -v mysql &> /dev/null; then
    echo -e "${YELLOW}🗄️ Testando conexão com banco...${NC}"
    mysql -h"$DB_HOST" -u"$DB_USER" -p"$DB_PASSWORD" -e "SELECT 1;" "$DB_NAME" > /dev/null 2>&1 && {
        echo -e "${GREEN}✅ Conexão chat com banco OK!${NC}"
    } || {
        echo -e "${YELLOW}⚠️ Não foi possível testar conexão com banco${NC}"
    }
fi

# Configurar variáveis de ambiente
export NODE_ENV=${NODE_ENV:-production}
export PORT=${PORT:-3000}

echo -e "${GREEN}🎉 Chat server inicializado com sucesso!${NC}"
echo -e "${BLUE}💬 Chat disponível em: http://localhost:3000${NC}"

# Executar comando passado
exec "$@"
