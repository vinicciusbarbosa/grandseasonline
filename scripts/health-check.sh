#!/bin/bash

# 🏴‍☠️ Sugoi Game - Health Check Script
# Script para verificar se todos os serviços estão funcionando

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

# Emojis
CHECK="✅"
CROSS="❌"
WARNING="⚠️"
INFO="ℹ️"

print_header() {
    echo -e "${BLUE}"
    echo "╔══════════════════════════════════════════════╗"
    echo "║           🏴‍☠️ SUGOI GAME HEALTH CHECK         ║"
    echo "╚══════════════════════════════════════════════╝"
    echo -e "${NC}"
}

check_service() {
    local service=$1
    local url=$2
    local expected=$3

    echo -n "Checking $service... "

    if curl -s -f "$url" > /dev/null 2>&1; then
        echo -e "${GREEN}${CHECK}${NC}"
        return 0
    else
        echo -e "${RED}${CROSS}${NC}"
        return 1
    fi
}

check_websocket() {
    echo -n "Checking WebSocket... "

    # Usar node.js para testar WebSocket se disponível
    if command -v node &> /dev/null; then
        local test_result=$(node -e "
            const WebSocket = require('ws');
            const ws = new WebSocket('ws://localhost:9001');
            ws.on('open', () => { console.log('OK'); process.exit(0); });
            ws.on('error', () => { console.log('FAIL'); process.exit(1); });
            setTimeout(() => { console.log('TIMEOUT'); process.exit(1); }, 5000);
        " 2>/dev/null || echo "FAIL")

        if [ "$test_result" = "OK" ]; then
            echo -e "${GREEN}${CHECK}${NC}"
            return 0
        else
            echo -e "${RED}${CROSS}${NC}"
            return 1
        fi
    else
        # Testar se a porta está aberta
        if nc -z localhost 9001 2>/dev/null; then
            echo -e "${GREEN}${CHECK}${NC}"
            return 0
        else
            echo -e "${RED}${CROSS}${NC}"
            return 1
        fi
    fi
}

check_database() {
    echo -n "Checking Database... "

    if docker-compose exec -T mysql mysql -u sugoigame_user -psugoigame_pass -e "SELECT 1;" sugoi_v2 > /dev/null 2>&1; then
        echo -e "${GREEN}${CHECK}${NC}"
        return 0
    else
        echo -e "${RED}${CROSS}${NC}"
        return 1
    fi
}

main() {
    print_header

    local failed=0

    echo -e "${INFO} Verificando serviços do Sugoi Game...\n"

    # Verificar se containers estão rodando
    echo "=== Container Status ==="
    docker-compose ps
    echo ""

    # Testes de conectividade
    echo "=== Connectivity Tests ==="

    check_service "Web Server" "http://localhost/login.php" || ((failed++))
    check_service "Chat Server" "http://localhost:3001/health" || ((failed++))
    check_websocket || ((failed++))
    check_database || ((failed++))
    check_service "phpMyAdmin" "http://localhost:8080" || ((failed++))

    echo ""

    # Verificar recursos
    echo "=== Resource Usage ==="
    docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}"
    echo ""

    # Verificar logs de erro
    echo "=== Recent Errors ==="
    local error_count=$(docker-compose logs --since=10m 2>&1 | grep -i error | wc -l)
    if [ $error_count -gt 0 ]; then
        echo -e "${WARNING} $error_count errors found in last 10 minutes"
        docker-compose logs --since=10m 2>&1 | grep -i error | tail -5
    else
        echo -e "${CHECK} No recent errors found"
    fi
    echo ""

    # Resultado final
    if [ $failed -eq 0 ]; then
        echo -e "${GREEN}${CHECK} All services are healthy!${NC}"
        echo ""
        echo "🌐 Web: http://localhost"
        echo "💬 Chat: http://localhost:3001"
        echo "🌊 WebSocket: ws://localhost:9001"
        echo "🔧 phpMyAdmin: http://localhost:8080"
        exit 0
    else
        echo -e "${RED}${CROSS} $failed service(s) failed health check${NC}"
        echo ""
        echo "Run './manage.sh logs' to see detailed logs"
        exit 1
    fi
}

# Verificar se Docker Compose está rodando
if ! docker-compose ps > /dev/null 2>&1; then
    echo -e "${RED}${CROSS} Docker Compose not running${NC}"
    echo "Run './manage.sh start' first"
    exit 1
fi

main "$@"
