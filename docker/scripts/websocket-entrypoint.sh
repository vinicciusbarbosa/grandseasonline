#!/bin/bash

# 🏴‍☠️ Sugoi Game - WebSocket Entrypoint
# Script de inicialização para o servidor WebSocket

set -e

# Cores para logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🌊 Inicializando Sugoi Game WebSocket Server...${NC}"

# Aguardar MySQL estar pronto
echo -e "${YELLOW}⚓ Aguardando MySQL...${NC}"
while ! mysqladmin ping -h"$DB_HOST" --silent; do
    echo "Aguardando MySQL estar pronto..."
    sleep 2
done
echo -e "${GREEN}✅ MySQL está pronto!${NC}"

# Configurar permissões
echo -e "${YELLOW}🔧 Configurando permissões...${NC}"
chown -R www-data:www-data /app

# Verificar se o servidor de mapa existe
echo -e "${YELLOW}📁 Verificando servidor de mapa...${NC}"
if [ ! -f "/app/servers/map/server.php" ]; then
    echo -e "${RED}❌ Servidor de mapa não encontrado!${NC}"
    exit 1
fi

# Verificar extensões PHP necessárias
echo -e "${YELLOW}🐘 Verificando extensões PHP...${NC}"
php -m | grep -E "(sockets|mysqli|pdo)" || {
    echo -e "${RED}❌ Extensões PHP necessárias não encontradas!${NC}"
    exit 1
}

# Instalar dependências Composer se necessário
if [ -f "/app/servers/map/composer.json" ]; then
    echo -e "${YELLOW}📦 Verificando dependências Composer...${NC}"
    cd /app/servers/map
    if [ ! -d "vendor" ]; then
        echo -e "${YELLOW}📦 Instalando dependências Composer...${NC}"
        composer install --no-dev --optimize-autoloader
    fi
    cd /app
fi

# Testar conexão com banco
echo -e "${YELLOW}🗄️ Testando conexão com banco...${NC}"
php -r "
try {
    \$mysqli = new mysqli('$DB_HOST', '$DB_USER', '$DB_PASSWORD', '$DB_NAME');
    if (\$mysqli->connect_error) {
        throw new Exception('Erro de conexão: ' . \$mysqli->connect_error);
    }
    echo 'Conexão WebSocket com banco OK!' . PHP_EOL;
    \$mysqli->close();
} catch(Exception \$e) {
    echo 'Erro na conexão: ' . \$e->getMessage() . PHP_EOL;
    exit(1);
}
"

# Configurar variável de ambiente
export DOCKER_ENV=true

echo -e "${GREEN}🎉 WebSocket server inicializado com sucesso!${NC}"
echo -e "${BLUE}🌊 WebSocket disponível em: ws://localhost:9000${NC}"

# Executar comando passado
exec "$@"
