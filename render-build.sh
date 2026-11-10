#!/usr/bin/env bash
# Exit immediately if a command exits with a non-zero status
set -e

echo "==> Iniciando compilação do COZAM no Render..."
npm install
npm run build
echo "==> Compilação concluída com sucesso!"
