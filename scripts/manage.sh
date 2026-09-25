#!/bin/bash

# 🏴‍☠️ Sugoi Game Docker Manager
# Gerenciador completo para o ambiente Docker do Sugoi Game

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color

# Emojis
SHIP="🚢"
ANCHOR="⚓"
SKULL="💀"
TREASURE="💰"
SWORD="⚔️"
WAVE="🌊"

# Configurações
PROJECT_NAME="sugoigame"
COMPOSE_FILE="docker-compose.yml"

# Funções auxiliares
print_header() {
    echo -e "${BLUE}"
    echo "╔══════════════════════════════════════════════╗"
    echo "║         🏴‍☠️ SUGOI GAME DOCKER MANAGER         ║"
    echo "╚══════════════════════════════════════════════╝"
    echo -e "${NC}"
}

print_info() {
    echo -e "${BLUE}${WAVE} [INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}${TREASURE} [SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}${SKULL} [WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}${SWORD} [ERROR]${NC} $1"
}

print_ship() {
    echo -e "${PURPLE}${SHIP} $1${NC}"
}

print_anchor() {
    echo -e "${CYAN}${ANCHOR} $1${NC}"
}

# Verificar se docker está instalado
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

# Verificar se os arquivos existem
check_files() {
    if [ ! -f "$COMPOSE_FILE" ]; then
        print_error "Arquivo $COMPOSE_FILE não encontrado!"
        exit 1
    fi
}

# Mostrar status dos containers
show_status() {
    print_ship "Status dos containers:"
    docker-compose ps
    echo ""

    print_ship "Uso de recursos:"
    docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.NetIO}}"
}

# Mostrar logs
show_logs() {
    local service=$1
    local lines=${2:-100}

    if [ -z "$service" ]; then
        print_ship "Logs de todos os serviços (últimas $lines linhas):"
        docker-compose logs --tail=$lines -f
    else
        print_ship "Logs do serviço $service (últimas $lines linhas):"
        docker-compose logs --tail=$lines -f $service
    fi
}

# Inicializar aplicação
start_app() {
    local env=${1:-dev}
    local build_flag=${2:-""}

    print_header
    print_ship "Iniciando Sugoi Game em modo $env..."

    check_docker
    check_files

    # Criar network se não existir
    docker network create ${PROJECT_NAME}_network 2>/dev/null || true

    if [ "$env" = "prod" ]; then
        print_anchor "Modo PRODUÇÃO ativado"
        docker-compose -f $COMPOSE_FILE up --build -d
    else
        print_anchor "Modo DESENVOLVIMENTO ativado"
        if [ "$build_flag" = "--build" ]; then
            docker-compose up --build -d
        else
            docker-compose up -d
        fi
    fi

    # Aguardar containers estarem prontos
    print_info "Aguardando containers ficarem prontos..."
    sleep 10

    # Verificar se MySQL está pronto
    print_info "Verificando conexão com banco de dados..."
    for i in {1..30}; do
        if docker-compose exec -T mysql mysqladmin ping -h localhost --silent; then
            break
        fi
        if [ $i -eq 30 ]; then
            print_warning "MySQL pode não estar completamente pronto. Verifique os logs."
        fi
        sleep 2
    done

    print_success "Sugoi Game iniciado com sucesso!"
    echo ""
    print_info "URLs de acesso:"
    echo "  🌐 Aplicação: http://localhost"
    echo "  💬 Chat: http://localhost:3001"
    echo "  🌊 WebSocket: ws://localhost:9001"
    echo "  🔧 phpMyAdmin: http://localhost:8080"
    echo ""

    show_status
}

# Parar aplicação
stop_app() {
    print_ship "Parando Sugoi Game..."
    docker-compose down
    print_success "Aplicação parada com sucesso!"
}

# Limpar tudo
clean_all() {
    print_warning "Esta operação irá remover TODOS os containers, volumes e imagens!"
    read -p "Tem certeza? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_ship "Limpando ambiente Docker..."
        docker-compose down -v --rmi all --remove-orphans
        docker system prune -f
        print_success "Ambiente limpo com sucesso!"
    else
        print_info "Operação cancelada."
    fi
}

# Backup do banco
backup_db() {
    local backup_name="backup_$(date +%Y%m%d_%H%M%S).sql"
    print_ship "Criando backup do banco de dados..."

    docker-compose exec -T mysql mysqldump -u sugoigame_user -psugoigame_pass sugoi_v2 > $backup_name

    if [ $? -eq 0 ]; then
        print_success "Backup criado: $backup_name"
    else
        print_error "Falha ao criar backup!"
        exit 1
    fi
}

# Restore do banco
restore_db() {
    local backup_file=$1
    if [ -z "$backup_file" ]; then
        print_error "Especifique o arquivo de backup!"
        echo "Uso: $0 restore <arquivo.sql>"
        exit 1
    fi

    if [ ! -f "$backup_file" ]; then
        print_error "Arquivo $backup_file não encontrado!"
        exit 1
    fi

    print_warning "Esta operação irá SOBRESCREVER o banco atual!"
    read -p "Tem certeza? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_ship "Restaurando backup $backup_file..."
        docker-compose exec -T mysql mysql -u sugoigame_user -psugoigame_pass sugoi_v2 < $backup_file
        print_success "Backup restaurado com sucesso!"
    else
        print_info "Operação cancelada."
    fi
}

# Executar comando nos containers
exec_cmd() {
    local service=$1
    shift
    local cmd="$@"

    if [ -z "$service" ] || [ -z "$cmd" ]; then
        print_error "Especifique o serviço e comando!"
        echo "Uso: $0 exec <service> <command>"
        echo "Serviços: web, mysql, websocket, chat"
        exit 1
    fi

    print_ship "Executando '$cmd' no serviço $service..."
    docker-compose exec $service $cmd
}

# Mostrar ajuda
show_help() {
    print_header
    echo -e "${WHITE}Uso:${NC} $0 [comando] [opções]"
    echo ""
    echo -e "${YELLOW}Comandos principais:${NC}"
    echo "  start [dev|prod] [--build]  Iniciar aplicação (padrão: dev)"
    echo "  stop                        Parar aplicação"
    echo "  restart [dev|prod]          Reiniciar aplicação"
    echo "  status                      Mostrar status dos containers"
    echo "  logs [service] [lines]      Mostrar logs (padrão: todos, 100 linhas)"
    echo ""
    echo -e "${YELLOW}Comandos de banco:${NC}"
    echo "  backup                      Criar backup do banco"
    echo "  restore <arquivo.sql>       Restaurar backup do banco"
    echo ""
    echo -e "${YELLOW}Comandos de desenvolvimento:${NC}"
    echo "  build                       Rebuild das imagens"
    echo "  exec <service> <command>    Executar comando em container"
    echo "  shell <service>             Abrir shell em container"
    echo ""
    echo -e "${YELLOW}Comandos de manutenção:${NC}"
    echo "  clean                       Limpar containers e volumes"
    echo "  update                      Atualizar e rebuild"
    echo ""
    echo -e "${YELLOW}Exemplos:${NC}"
    echo "  $0 start                    # Iniciar em desenvolvimento"
    echo "  $0 start prod --build       # Iniciar em produção com rebuild"
    echo "  $0 logs web 50              # Ver 50 linhas do log do web"
    echo "  $0 exec web php --version   # Ver versão do PHP"
    echo "  $0 shell mysql              # Abrir shell no MySQL"
}

# Parse dos argumentos
case "${1:-help}" in
    "start")
        start_app ${2:-dev} $3
        ;;
    "stop")
        stop_app
        ;;
    "restart")
        stop_app
        start_app ${2:-dev}
        ;;
    "status")
        show_status
        ;;
    "logs")
        show_logs $2 ${3:-100}
        ;;
    "backup")
        backup_db
        ;;
    "restore")
        restore_db $2
        ;;
    "build")
        print_ship "Rebuilding containers..."
        docker-compose build --no-cache
        print_success "Build concluído!"
        ;;
    "exec")
        shift
        exec_cmd "$@"
        ;;
    "shell")
        if [ -z "$2" ]; then
            print_error "Especifique o serviço!"
            exit 1
        fi
        print_ship "Abrindo shell no serviço $2..."
        docker-compose exec $2 bash || docker-compose exec $2 sh
        ;;
    "clean")
        clean_all
        ;;
    "update")
        print_ship "Atualizando aplicação..."
        git pull || print_warning "Git pull falhou, continuando..."
        docker-compose build --no-cache
        start_app ${2:-dev}
        ;;
    "help"|"-h"|"--help")
        show_help
        ;;
    *)
        print_error "Comando '$1' não reconhecido!"
        echo ""
        show_help
        exit 1
        ;;
esac
