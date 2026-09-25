#!/bin/bash

# 🏴‍☠️ Sugoi Game - Web Entrypoint
# Script de inicialização para o container web

set -e

# Cores para logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🚢 Inicializando Sugoi Game Web...${NC}"

# Aguardar MySQL estar pronto
echo -e "${YELLOW}⚓ Aguardando MySQL...${NC}"
while ! mysqladmin ping -h"$DB_HOST" --silent; do
    echo "Aguardando MySQL estar pronto..."
    sleep 2
done
echo -e "${GREEN}✅ MySQL está pronto!${NC}"

# Configurar permissões
echo -e "${YELLOW}🔧 Configurando permissões...${NC}"
chown -R www-data:www-data /var/www/html
find /var/www/html -type d -exec chmod 755 {} \;
find /var/www/html -type f -exec chmod 644 {} \;

# Verificar configuração do PHP
echo -e "${YELLOW}🐘 Verificando PHP...${NC}"
php -v
php -m | grep -E "(mysqli|pdo|gd|zip)"

# Configurar variável de ambiente para Docker
echo -e "${YELLOW}🐳 Configurando ambiente Docker...${NC}"
export DOCKER_ENV=true

# Verificar se os arquivos essenciais existem
echo -e "${YELLOW}📁 Verificando arquivos essenciais...${NC}"
if [ ! -f "/var/www/html/index.php" ]; then
    echo -e "${RED}❌ Arquivo index.php não encontrado!${NC}"
    exit 1
fi

if [ ! -f "/var/www/html/Includes/conectdb.php" ]; then
    echo -e "${RED}❌ Arquivo conectdb.php não encontrado!${NC}"
    exit 1
fi

# Testar conexão com banco
echo -e "${YELLOW}🗄️ Testando conexão com banco...${NC}"
php -r "
try {
    \$pdo = new PDO('mysql:host=$DB_HOST;dbname=$DB_NAME', '$DB_USER', '$DB_PASSWORD');
    echo 'Conexão com banco OK!' . PHP_EOL;
} catch(PDOException \$e) {
    echo 'Erro na conexão: ' . \$e->getMessage() . PHP_EOL;
    exit(1);
}
"

echo -e "${GREEN}🎉 Web container inicializado com sucesso!${NC}"
echo -e "${BLUE}🌐 Aplicação disponível em: http://localhost${NC}"

# Executar comando passado
exec "$@"
