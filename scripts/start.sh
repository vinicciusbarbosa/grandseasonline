#!/bin/bash

# Script de inicialização do Sugoi Game Docker
# Uso: ./start.sh [comando]

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Funções auxiliares
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Verificar se Docker está instalado
check_docker() {
    if ! command -v docker &> /dev/null; then
        print_error "Docker não está instalado!"
        exit 1
    fi

    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose não está instalado!"
        exit 1
    fi
}

# Verificar se os serviços estão rodando
check_services() {
    print_info "Verificando status dos serviços..."
    docker-compose ps
}

# Construir imagens
build() {
    print_info "Construindo imagens Docker..."
    docker-compose build --no-cache
    print_success "Imagens construídas com sucesso!"
}

# Iniciar serviços
start() {
    print_info "Iniciando serviços..."
    docker-compose up -d

    # Aguardar um pouco para os serviços iniciarem
    sleep 5

    print_success "Serviços iniciados!"
    print_info "Aguardando MySQL inicializar..."

    # Aguardar MySQL ficar disponível
    until docker-compose exec mysql mysqladmin ping -h"mysql" --silent; do
        echo -n "."
        sleep 1
    done
    echo ""

    print_success "MySQL está pronto!"
    show_urls
}

# Parar serviços
stop() {
    print_info "Parando serviços..."
    docker-compose stop
    print_success "Serviços parados!"
}

# Restart serviços
restart() {
    print_info "Reiniciando serviços..."
    docker-compose restart
    print_success "Serviços reiniciados!"
}

# Remover tudo
clean() {
    print_warning "Isso vai remover todos os containers e volumes!"
    read -p "Tem certeza? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_info "Removendo containers e volumes..."
        docker-compose down -v
        docker system prune -f
        print_success "Limpeza concluída!"
    else
        print_info "Operação cancelada."
    fi
}

# Mostrar logs
logs() {
    if [ -n "$2" ]; then
        docker-compose logs -f "$2"
    else
        docker-compose logs -f
    fi
}

# Mostrar URLs de acesso
show_urls() {
    echo ""
    print_success "Aplicação está rodando!"
    echo "=========================="
    echo "🌐 Aplicação Principal: http://localhost"
    echo "🗄️  phpMyAdmin: http://localhost:8080"
    echo "💬 Chat Server: http://localhost:3000"
    echo "🔌 WebSocket: ws://localhost:9000"
    echo "=========================="
    echo ""
}

# Entrar no container
shell() {
    service=${2:-web}
    print_info "Acessando shell do container: $service"
    docker-compose exec "$service" bash
}

# Instalar dependências
install() {
    print_info "Instalando dependências PHP..."
    docker-compose exec web composer install

    print_info "Instalando dependências Node.js..."
    docker-compose exec chat npm install

    print_success "Dependências instaladas!"
}

# Backup do banco de dados
backup() {
    timestamp=$(date +%Y%m%d_%H%M%S)
    filename="backup_sugoi_${timestamp}.sql"

    print_info "Criando backup do banco de dados..."
    docker-compose exec mysql mysqldump -u sugoigame_user -psugoigame_pass sugoi_v2 > "$filename"
    print_success "Backup criado: $filename"
}

# Restaurar banco de dados
restore() {
    if [ -z "$2" ]; then
        print_error "Uso: $0 restore <arquivo_backup.sql>"
        exit 1
    fi

    if [ ! -f "$2" ]; then
        print_error "Arquivo não encontrado: $2"
        exit 1
    fi

    print_info "Restaurando banco de dados..."
    docker-compose exec -T mysql mysql -u sugoigame_user -psugoigame_pass sugoi_v2 < "$2"
    print_success "Banco de dados restaurado!"
}

# Menu de ajuda
help() {
    echo "Sugoi Game Docker - Script de Gerenciamento"
    echo ""
    echo "Uso: $0 [comando]"
    echo ""
    echo "Comandos disponíveis:"
    echo "  build     - Construir imagens Docker"
    echo "  start     - Iniciar todos os serviços"
    echo "  stop      - Parar todos os serviços"
    echo "  restart   - Reiniciar todos os serviços"
    echo "  status    - Verificar status dos serviços"
    echo "  logs      - Mostrar logs (use 'logs <serviço>' para serviço específico)"
    echo "  shell     - Acessar shell do container (use 'shell <serviço>')"
    echo "  install   - Instalar dependências"
    echo "  clean     - Remover containers e volumes"
    echo "  backup    - Fazer backup do banco de dados"
    echo "  restore   - Restaurar banco de dados"
    echo "  urls      - Mostrar URLs de acesso"
    echo "  help      - Mostrar esta ajuda"
    echo ""
    echo "Exemplos:"
    echo "  $0 start          # Iniciar aplicação"
    echo "  $0 logs web       # Ver logs do container web"
    echo "  $0 shell mysql    # Acessar shell do MySQL"
    echo "  $0 backup         # Fazer backup do banco"
}

# Verificar Docker antes de executar comandos
check_docker

# Processar comando
case "${1:-help}" in
    "build")
        build
        ;;
    "start")
        start
        ;;
    "stop")
        stop
        ;;
    "restart")
        restart
        ;;
    "status")
        check_services
        ;;
    "logs")
        logs "$@"
        ;;
    "shell")
        shell "$@"
        ;;
    "install")
        install
        ;;
    "clean")
        clean
        ;;
    "backup")
        backup
        ;;
    "restore")
        restore "$@"
        ;;
    "urls")
        show_urls
        ;;
    "help"|*)
        help
        ;;
esac
