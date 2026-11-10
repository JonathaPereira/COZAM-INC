#!/usr/bin/env bash
# Exit immediately if a command exits with a non-zero status
set -e

echo "==> Instalando dependências completas para o build (incluindo TypeScript e Vite)..."
npm install --include=dev

echo "==> Compilando o COZAM..."
npm run build

echo "==> Compilação concluída com sucesso!"
