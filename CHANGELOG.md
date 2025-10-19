# Changelog

Todos los cambios notables en este proyecto serán documentados en este archivo.

## [0.1.0] - 2025-10-19

### ✨ Features

#### Core Functionality
- **Database Explorer**: Browse PostgreSQL schemas and tables
- **Table Viewer**: Display table data with pagination (100 rows/page)
- **Column Information**: View column names, types, and metadata

#### Data Operations
- **Inline Editing**: Double-click cells to edit values directly
- **Batch Operations**: Save multiple changes or cancel all edits
- **Insert Rows**: Auto-generated forms based on table schema
- **Custom Queries**: Execute arbitrary SQL with execution stats

#### User Interface
- **Sticky Headers**: Column names visible while scrolling
- **Resizable Columns**: Drag column borders to adjust width manually
- **Sort & Filter**: Click headers to sort, apply multi-column filters
- **Multiple Operators**: `=`, `!=`, `>`, `<`, `>=`, `<=`, `LIKE`

#### Connection Management
- **Interactive Setup**: Step-by-step credential configuration
- **Secure Storage**: Encrypted in VS Code's SecretStorage (system keychain)
- **Multiple Connections**: Save and switch between different databases
- **Auto-Reconnect**: Remembers last used connection
- **SSL Support**: Auto-enables for remote connections

### 🔒 Security
- Parameterized SQL queries prevent injection
- No credentials logged or exposed
- Input validation for database operations
- Environment variable support via .env

### 🛠️ Technical
- Built with React 19 + TypeScript
- Uses `pg` driver for PostgreSQL
- Vite for webview bundling
- VS Code Extension API integration
- Connection pooling for performance

### 📦 Initial Release
- Alpha version (0.1.0)
- Stable for basic database operations
- Ready for VS Code Marketplace and Cursor

---

## Próximos Releases (Roadmap)

### 0.2.0 (Planned)
- Delete row operations with confirmation
- Export to CSV/JSON
- Query history
- Advanced filtering (AND/OR logic)

### 1.0.0 (Future)
- Virtual scrolling for 10K+ rows
- Saved query snippets
- Schema diagrams
- Multi-database support (MySQL, SQLite)

---

## Notas de Desarrollo

Este proyecto fue construido durante sesiones de desarrollo en equipo, con enfoque en:
- Clean code architecture
- Security best practices
- User experience
- Performance optimization

Para más detalles sobre desarrollo, ver [PUBLISH_GUIDE.md](./PUBLISH_GUIDE.md).
