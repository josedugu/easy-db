#!/bin/zsh

# Script para publicar en Open VSX Registry
# Uso: 
#   ./scripts/publish-openvsx.sh -p tu_token
#   O: export OPEN_VSX_TOKEN=tu_token && ./scripts/publish-openvsx.sh

set -e

VERSION=$(node -p "require('../package.json').version")
VSIX_FILE="releases/easydb-${VERSION}.vsix"
TOKEN=""

# Parsear argumentos
while [[ $# -gt 0 ]]; do
    case $1 in
        -p|--token)
            TOKEN="$2"
            shift 2
            ;;
        *)
            echo "Uso: $0 -p TOKEN"
            exit 1
            ;;
    esac
done

# Usar token del argumento o de la variable de entorno
if [ -z "$TOKEN" ]; then
    TOKEN="$OPEN_VSX_TOKEN"
fi

echo "📦 Publicando en Open VSX Registry..."
echo "📌 Versión: ${VERSION}"
echo "📁 Archivo: ${VSIX_FILE}"

# Verificar que existe el archivo .vsix
if [ ! -f "$VSIX_FILE" ]; then
    echo "❌ Error: No se encontró el archivo $VSIX_FILE"
    echo "Ejecuta primero: npm run build:all && npm run package:release"
    exit 1
fi

# Verificar que existe el token
if [ -z "$TOKEN" ]; then
    echo "❌ Error: Token no proporcionado"
    echo "Opción 1: export OPEN_VSX_TOKEN=tu_token"
    echo "Opción 2: $0 -p tu_token"
    exit 1
fi

# Publicar en Open VSX
echo "🚀 Publicando..."
npx ovsx publish "$VSIX_FILE" -p "$TOKEN"

echo "✅ Publicación exitosa!"
echo "🌐 Verifica en: https://open-vsx.org/extension/josedugu/easydb"

