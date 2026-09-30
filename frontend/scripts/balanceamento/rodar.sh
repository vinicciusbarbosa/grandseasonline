#!/bin/sh
# Simulações de balanceamento (IA × IA). Uso: sh rodar.sh  (da pasta frontend/scripts/balanceamento)
# Gera os confrontos, roda em 4 processos e imprime o relatório.
set -e
cd "$(dirname "$0")"
rm -f res_*.jsonl log_*.txt
npx tsx gerar.ts
for k in 0 1 2 3; do npx tsx executar.ts $k 4 > log_$k.txt 2>&1 & done
wait
npx tsx analisar.ts
