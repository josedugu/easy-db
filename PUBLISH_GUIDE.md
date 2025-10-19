# Publishing Guide - EasyDB Extension

Guía completa para publicar la extensión en VS Code Marketplace y Cursor.

## 📋 Pre-requisitos

1. **Crear cuenta en Visual Studio Marketplace**
   - Visita: https://marketplace.visualstudio.com
   - Sign in con tu Microsoft account (o crea una)
   - Click en "Publish extensions"

2. **Generar Personal Access Token (PAT)**
   - Ve a: https://dev.azure.com/
   - Accede con tu cuenta de Microsoft
   - Ve a User Settings → Personal access tokens
   - Click "New Token"
   - Nombre: `vsce` (o similar)
   - Scopes: **Marketplace > Manage**
   - Click "Create"
   - **Guarda el token** (lo necesitarás después)

3. **Instalar VSCE (VS Code Extension CLI)**
   ```bash
   npm install -g @vscode/vsce
   ```

## 🚀 Publicar en VS Code Marketplace

### Paso 1: Preparar la extensión

```bash
# Asegúrate de estar en la rama principal
git checkout main

# Actualiza el package.json con la nueva versión
# Formato: MAJOR.MINOR.PATCH (ej: 0.1.0 → 0.2.0)
```

Edita `package.json`:
```json
{
  "name": "easydb",
  "version": "0.2.0",  // Incrementa la versión
  "publisher": "tu-nombre-publisher", // Tu nombre en Marketplace
  ...
}
```

### Paso 2: Compilar la extensión

```bash
# Limpia y compila
npm run build:all

# Verifica que no hay errores
npm run compile
```

### Paso 3: Crear el archivo .vsix

```bash
# Genera el archivo .vsix
vsce package

# Esto crea un archivo como: easydb-0.2.0.vsix
```

### Paso 4: Publicar en Marketplace

```bash
# Opción A: Publicar directamente desde terminal
vsce publish -p <TU_PAT>

# Opción B: Publicar primero en local, luego manualmente
# El comando anterior sube directamente a Marketplace
```

**Espera 5-10 minutos** para que aparezca en el Marketplace.

### Verificación

- Visita: https://marketplace.visualstudio.com/items?itemName=tu-nombre.easydb
- Debería mostrar la nueva versión

## 🔄 Alternativa: Usar GitHub Actions (Recomendado)

Automatiza la publicación con cada release:

```yaml
# .github/workflows/publish.yml
name: Publish Extension

on:
  push:
    tags:
      - 'v*'

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - run: npm install
      - run: npm run build:all
      - run: npx vsce publish -p ${{ secrets.VSCE_PAT }}
```

Luego solo:
```bash
git tag v0.2.0
git push origin v0.2.0
# GitHub Actions publica automáticamente
```

## 📦 Publicar en Open VSX (Opcional)

Open VSX es un registro alternativo (útil para Cursor):

```bash
# Publica en Open VSX
npx ovsx publish -p <YOUR_OPEN_VSX_TOKEN>
```

Regístrate en: https://open-vsx.org

## 🎯 Cursor

Cursor puede instalar extensiones de:

1. **VS Code Marketplace** (igual que VS Code)
2. **Open VSX Registry** (alternativa open-source)

Una vez publicada en VS Code Marketplace:

1. Abre Cursor
2. Extensions panel
3. Busca "EasyDB"
4. Click "Install"

Cursor auto-sincroniza con VS Code Marketplace.

## 📝 Información Importante para Marketplace

Cuando publiques, asegúrate de que `package.json` tenga:

```json
{
  "name": "easydb",
  "displayName": "EasyDB - PostgreSQL Viewer",
  "description": "Visual database explorer for PostgreSQL with interactive credentials and table management",
  "version": "0.2.0",
  "publisher": "tu-username", // Sin espacios ni caracteres especiales
  "repository": {
    "type": "git",
    "url": "https://github.com/tu-usuario/easydb"
  },
  "icon": "resources/database.svg",
  "engines": {
    "vscode": "^1.85.0"
  },
  "categories": ["Data Visualization", "Other"],
  "keywords": ["postgresql", "database", "explorer", "sql"],
  "license": "MIT"
}
```

## ⚠️ Checklist antes de Publicar

- [ ] Versión actualizada en `package.json`
- [ ] README.md está completo y actualizado
- [ ] CHANGELOG.md existe (opcional pero recomendado)
- [ ] No hay credenciales hardcodeadas
- [ ] `npm run build:all` compila sin errores
- [ ] Icono PNG o SVG en `resources/`
- [ ] `package.json` tiene `publisher` definido
- [ ] `package.json` tiene `repository` definido
- [ ] `.vscodeignore` excluye archivos innecesarios

## 📊 Versioning

Sigue Semantic Versioning:
- **0.1.0** → Primera release (Alpha)
- **0.2.0** → Nuevas features (0.x = pre-release)
- **1.0.0** → Release estable
- **1.1.0** → Nuevas features
- **1.1.1** → Bug fixes

## 🔗 Recursos

- [VS Code Extension Publishing](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- [VSCE Documentation](https://github.com/microsoft/vscode-vsce)
- [Open VSX Publishing](https://open-vsx.org/user-guide/publishing)
- [Marketplace Policies](https://code.visualstudio.com/api/working-with-extensions/extension-market-place-policies)

## ❓ Troubleshooting

### "The publisher field in package.json is not a valid publisher ID"

**Solución**: El publisher debe ser alfanumérico y sin espacios
```json
"publisher": "jgutierrez"  // ✅ Correcto
"publisher": "j gutierrez" // ❌ Incorrecto
```

### "403 Forbidden" al publicar

**Solución**: El PAT no tiene permisos. Crea uno nuevo con scope "Marketplace > Manage"

### Extension tarda mucho en aparecer

Marketplace cachea. Espera 10-15 minutos.

## 📞 Soporte

- Marketplace Issues: https://github.com/microsoft/vscode/issues
- Extension Issues: Crea un repo en GitHub y vinculalo en `package.json`
