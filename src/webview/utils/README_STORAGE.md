# 💾 Browser Storage System

## 🎯 Propósito

Este módulo proporciona **persistencia local** para el modo de desarrollo en navegador, permitiendo guardar y recuperar conexiones de base de datos sin necesidad de VS Code.

## 📦 Almacenamiento

### En Navegador (Desarrollo)

- **Tecnología**: `localStorage` del navegador
- **Ubicación**: DevTools → Application → Local Storage
- **Keys**:
  - `easydb-dev-connections`: Array de conexiones guardadas
  - `easydb-dev-last-used`: ID de la última conexión usada

### En VS Code (Producción)

- **Tecnología**: `context.secrets` (encriptado)
- **Persistencia**: Sincronizada entre dispositivos si usas Settings Sync

## 🔧 API del browserStorage

```typescript
import { browserStorage } from './browserStorage';

// Obtener todas las conexiones
const connections = browserStorage.getConnections();

// Guardar una conexión
browserStorage.saveConnection({
  id: 'uuid-123',
  name: 'Mi Database',
  config: { host: 'localhost', ... },
  createdAt: '2025-10-16T...',
});

// Actualizar conexión
browserStorage.updateConnection('uuid-123', {
  name: 'Nuevo Nombre',
});

// Eliminar conexión
browserStorage.deleteConnection('uuid-123');

// Última conexión usada
const lastId = browserStorage.getLastUsedConnectionId();
browserStorage.setLastUsedConnectionId('uuid-123');

// Limpiar todo (útil para testing)
browserStorage.clear();
```

## 🔄 Flujo de Datos

### Cuando guardas una conexión en el navegador:

```
1. Usuario hace clic en "Save this connection"
   ↓
2. React Component → postMessage({ type: "saveConnection", ... })
   ↓
3. Mock VSCode API → browserStorage.saveConnection(...)
   ↓
4. localStorage.setItem('easydb-dev-connections', JSON.stringify(...))
   ↓
5. Dispatch event → window.dispatchEvent(connectionSaved)
   ↓
6. React escucha → Actualiza UI con nueva conexión
```

## 🔍 Inspeccionar Datos en el Navegador

1. Abre DevTools (F12)
2. Ve a la pestaña **Application**
3. En el sidebar: **Local Storage** → `http://localhost:5173`
4. Verás las keys:
   - `easydb-dev-connections`
   - `easydb-dev-last-used`

## ⚠️ Seguridad

**Advertencia**: `localStorage` **NO es seguro** para credenciales en producción.

- ✅ **Uso correcto**: Desarrollo local en navegador
- ❌ **NO usar**: En producción o con credenciales reales

Las credenciales se guardan en **texto plano** en `localStorage`. Solo úsalo para:

- Probar la UI
- Desarrollo rápido con hot-reload
- Conexiones de prueba (no producción)

## 🧹 Limpiar Datos

### Desde la Consola del Navegador:

```javascript
// Limpiar todo
localStorage.clear();

// O solo easydb
localStorage.removeItem("easydb-dev-connections");
localStorage.removeItem("easydb-dev-last-used");
```

### Desde el Código:

```typescript
import { browserStorage } from "./utils/browserStorage";
browserStorage.clear();
```

## 🔄 Switch entre Navegador y VS Code

| Característica | Navegador      | VS Code           |
| -------------- | -------------- | ----------------- |
| Storage        | `localStorage` | `context.secrets` |
| Persistencia   | ✅ Sí          | ✅ Sí             |
| Seguridad      | ⚠️ Texto plano | ✅ Encriptado     |
| Sincronización | ❌ No          | ✅ Settings Sync  |
| Auto-load      | ✅ Sí          | ✅ Sí             |

**No necesitas hacer nada**: El código detecta automáticamente si está en navegador o VS Code y usa el storage apropiado.

## 📝 Ejemplo de Datos en localStorage

```json
{
  "easydb-dev-connections": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Local PostgreSQL",
      "config": {
        "host": "localhost",
        "port": 5432,
        "database": "mydb",
        "username": "postgres",
        "password": "mypassword"
      },
      "createdAt": "2025-10-16T10:30:00.000Z",
      "lastUsed": "2025-10-16T12:45:00.000Z"
    }
  ],
  "easydb-dev-last-used": "550e8400-e29b-41d4-a716-446655440000"
}
```

## 🎉 Ventajas

1. ✅ **Persistencia real** en el navegador
2. ✅ **Hot-reload** funciona perfectamente
3. ✅ **No necesitas VS Code** para desarrollo UI
4. ✅ **Fácil de inspeccionar** en DevTools
5. ✅ **Fácil de limpiar** si algo sale mal

---

**Desarrollo rápido + Persistencia real = ❤️**
