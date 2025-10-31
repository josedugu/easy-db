#!/bin/zsh

# Script para crear un release de GitHub con el archivo .vsix

set -e

# Obtener la versión del package.json
VERSION=$(node -p "require('../package.json').version")
TAG="v${VERSION}"
VSIX_FILE="releases/easydb-${VERSION}.vsix"

# Verificar que existe el archivo .vsix
if [ ! -f "$VSIX_FILE" ]; then
    echo "❌ Error: No se encontró el archivo $VSIX_FILE"
    echo "Ejecuta primero: npm run package:release"
    exit 1
fi

# Crear el release
echo "🚀 Creando release $TAG..."
gh release create "$TAG" \
    "$VSIX_FILE" \
    --title "Release $TAG" \
    --notes "Release $TAG de EasyDB extension" \
    "$@"

echo "✅ Release creado exitosamente: $TAG"
echo "📦 Archivo incluido: $VSIX_FILE"

