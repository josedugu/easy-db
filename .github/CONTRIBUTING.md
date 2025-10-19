# Contributing to EasyDB

¡Gracias por tu interés en contribuir a EasyDB! Aquí hay algunas pautas para ayudarte.

## Code of Conduct

- Sé respetuoso con los demás contribuyentes
- No hagas spam ni promoción no solicitada
- Reporta comportamiento abusivo a través de issues privados

## Cómo Contribuir

### Reportar Bugs

1. **Verifica si ya existe**: Busca en GitHub Issues
2. **Proporciona detalles**:
   - Versión de VS Code/Cursor
   - Versión de la extensión
   - Pasos para reproducir
   - Comportamiento esperado vs actual
   - Screenshots si es relevante

### Sugerir Mejoras

1. Abre un issue con la etiqueta `enhancement`
2. Describe el caso de uso
3. Explica por qué sería útil
4. Proporciona ejemplos

### Pull Requests

1. Fork el repositorio
2. Crea una rama feature (`git checkout -b feature/amazing-feature`)
3. Commit tus cambios (`git commit -m 'Add amazing feature'`)
4. Push a la rama (`git push origin feature/amazing-feature`)
5. Abre un Pull Request

#### Requisitos antes de PR

- [ ] Código compila sin errores (`npm run compile`)
- [ ] Webview compila correctamente (`npm run webview:build`)
- [ ] Sigue el estilo del proyecto
- [ ] Actualizaste CHANGELOG.md si es necesario
- [ ] Probaste los cambios localmente

### Estilo de Código

```typescript
// ✅ Bueno
export async function fetchData(id: string): Promise<Data> {
  const result = await database.query(id);
  return result;
}

// ❌ Evitar
async function getData(id){
  return await db.query(id)
}
```

Preferimos:
- TypeScript con tipos completos
- Nombres descriptivos de variables
- Funciones pequeñas y enfocadas
- No usar `any` sin motivo válido

## Desarrollo Local

```bash
# Instala dependencias
npm install

# Compila TypeScript
npm run compile

# Dev mode para webview
npm run webview:dev

# En otra terminal - Watch mode para TypeScript
npm run watch

# En VS Code: Press F5 para debugging
```

## Estructura del Proyecto

```
src/
├── database/           # PostgreSQL queries y connection
├── utils/             # Logging
├── views/             # Webview manager
└── webview/           # React UI
    ├── components/    # React components
    ├── hooks/         # Custom hooks
    ├── types/         # TypeScript types
    └── utils/         # Utilities
```

## Problemas Comunes

### TypeScript errors
```bash
npm run compile
```

### Webview no se actualiza
```bash
npm run webview:build
# O Ctrl+Shift+P → Developer: Reload Window
```

### Cambios no se ven
- Asegúrate de que está compilado
- Restart extension (F5 → Stop, F5 → Start)

## Roadmap

Ver [README.md](../README.md#-coming-soon-refactoring--improvements) para features planeados.

Prioridades actuales:
1. **Refactorización de dashboardPanel.ts**
2. **Delete row operations**
3. **Export to CSV/JSON**

## Preguntas?

- Abre un issue con la etiqueta `question`
- Discord: [Comunidad](https://discord.gg/easy-db) (planeado)

¡Gracias por contribuir! 🎉
