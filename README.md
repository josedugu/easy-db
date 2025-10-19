# EasyDB - PostgreSQL Database Viewer Extension

A powerful visual database explorer for PostgreSQL that runs directly inside Cursor/VS Code. Built with React, TypeScript, and the `pg` driver for a modern, responsive development experience.

**Version:** 0.1.0 | **Status:** Alpha | **License:** MIT

## Features

### ✅ Phase 1: Read Data

- **Sidebar Navigation**: Browse database schemas and tables in a tree view
- **Table Viewer**: Display table data with pagination (100 rows per page)
- **Column Information**: View column names, types, and metadata
- **Sticky Headers**: Column names always visible while scrolling

### ✅ Phase 2: Filter & Sort

- **Dynamic Filters**: Filter table data by any column
- **Multiple Operators**: Support for `=`, `!=`, `>`, `<`, `>=`, `<=`, `LIKE`
- **Multi-column Filtering**: Apply filters across multiple columns simultaneously
- **Column Sorting**: Click headers to sort ascending/descending
- **Resizable Columns**: Drag column borders to adjust width, or drag-and-drop for manual resizing

### ✅ Phase 3: Edit Data

- **Inline Cell Editing**: Double-click any cell to edit inline
- **Optimistic Updates**: Changes appear immediately before server confirmation
- **Batch Operations**: Save multiple changes at once or cancel all edits
- **Pending Changes Indicator**: Visual feedback for uncommitted edits

### ✅ Phase 4: Insert Data

- **Dynamic Forms**: Auto-generated insert forms based on table schema
- **Type-aware Inputs**: Appropriate input types based on column data types
- **Required Field Validation**: Visual indication of required vs optional fields

### ✅ Phase 5: Custom Queries

- **SQL Query Editor**: Execute any SQL query directly
- **Execution Stats**: View execution time, row count, and command type
- **Example Queries**: Quick-start templates for common operations
- **Keyboard Shortcuts**: Execute queries with `Ctrl+Enter` / `Cmd+Enter`

### ✅ Phase 6: Connection Management

- **Multiple Connections**: Save and switch between different database connections
- **Secure Storage**: Credentials encrypted in VS Code's secure storage (system keychain)
- **Connection History**: Auto-reconnect to last used connection
- **Interactive Setup**: Step-by-step credential configuration wizard

## Quick Start

1. **Install the extension** from VS Code Marketplace or install `.vsix` manually
2. **Open Command Palette** (`Ctrl+Shift+P` / `Cmd+Shift+P`)
3. **Run** `PostgreSQL: Open Explorer`
4. **Click** "Configure Now" to set up database connection
5. **Enter** your database credentials (saved securely)
6. **Browse** schemas and tables in the sidebar
7. **Click** any table to view and edit data

## Requirements

- **Node.js**: Version 18 or higher (npm comes with Node.js)
- **VS Code/Cursor**: Version 1.85.0 or higher
- **PostgreSQL Database**: Local or remote (versions 10+)
- **Network Access**: Connection to PostgreSQL server with appropriate permissions

### For Development

- **npm**: Included with Node.js (required for development scripts)

## Installation

### Option 1: Local Development

1. Clone or download this extension
   ```bash
   git clone https://github.com/josedugu/easy-db.git
   cd easy-db
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Configure your database credentials (see Configuration section)

4. Open the project in VS Code/Cursor

5. Press `F5` to launch the Extension Development Host

### Option 2: Package and Install

1. Build the extension:

   ```bash
   npm run compile
   npm run webview:build
   ```

2. Package the extension:

   ```bash
   npm run package
   ```

3. Install the `.vsix` file:
   - Open VS Code/Cursor
   - Go to Extensions
   - Click "..." → "Install from VSIX"
   - Select the generated `.vsix` file (e.g., `easydb-0.1.0.vsix`)

## Configuration

### Method 1: Interactive Setup (Recommended) ⭐ NEW!

The easiest way! The extension will guide you through credential setup:

1. Launch the extension (press `F5` or use "Run Extension")
2. Click **"Configure Now"** when prompted
3. Enter your credentials step by step:
   - Hostname (e.g., `localhost`)
   - Port (e.g., `5432`)
   - Database name
   - Username
   - Password (hidden input)
4. Choose whether to save credentials securely
5. Done! ✅

**Commands:**

- `PostgreSQL: Configure Database Connection` - Set up or change credentials
- `PostgreSQL: Clear Saved Credentials` - Remove saved credentials

**Security:** Credentials are stored in VS Code's secure SecretStorage (uses your system's keychain).

### Method 2: Environment Variables (Optional)

Create a `.env` file in your workspace root:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=your_database_name
DB_USER=your_username
DB_PASSWORD=your_password
```

The extension auto-detects `.env` files and uses them if no saved credentials exist.

## Usage

### Browse Tables

1. Open the PostgreSQL Explorer sidebar (database icon in activity bar)
2. Expand schemas to see tables
3. Click on any table to view its data

### Filter Data

1. Open a table
2. Click "Toggle Filters"
3. Enter filter values and select operators
4. Click "Apply Filters"

### Insert Rows

1. Open a table
2. Click "Insert Row"
3. Fill in the form (required fields marked with \*)
4. Click "Insert"

### Run Custom Queries

1. Use Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
2. Run command: "Open SQL Query Editor"
3. Enter your SQL query
4. Click "Execute Query" or press `Ctrl+Enter` / `Cmd+Enter`

## Available Commands

- `PostgreSQL: Refresh Schemas` - Reload the schema tree
- `PostgreSQL: Open Table` - Open a table viewer (triggered by clicking tables)
- `PostgreSQL: Open SQL Query Editor` - Open the custom query editor

## Architecture

### Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Extension Core** | VS Code Extension API | Commands, webviews, sidebar |
| **Backend** | Node.js + TypeScript | Connection pooling, query execution |
| **Database Driver** | `pg` (node-postgres) | PostgreSQL connection management |
| **Frontend** | React 19 + TypeScript | Interactive UI components |
| **Build Tool** | Vite | Fast webview bundling |
| **Styling** | VS Code CSS Variables | Theme-aware styling |

### Project Structure

```
src/
├── extension.ts              # Main entry point & command registration
├── database/
│   ├── connection.ts         # PostgreSQL pool initialization & management
│   ├── credentials.ts        # Credential storage (VS Code secrets API)
│   └── queries.ts            # SQL query builders with parameterization
├── utils/
│   └── logger.ts             # Centralized logging (errors only)
├── views/
│   └── dashboardPanel.ts     # Webview manager & message bridge
└── webview/
    ├── App.tsx               # Main React application
    ├── components/           # UI Components
    │   ├── ConnectionForm.tsx     # Connection configuration
    │   ├── DataTable.tsx          # Table display with inline editing
    │   ├── TableView.tsx          # Table viewer with pagination
    │   ├── DataPage.tsx           # Main data exploration page
    │   └── Sidebar.tsx            # Schema/table navigation
    ├── hooks/
    │   └── useVSCode.ts      # VS Code API integration (postMessage)
    ├── types/
    │   └── index.ts          # TypeScript interfaces
    └── utils/
        └── browserStorage.ts # LocalStorage persistence (dev mode)
```

### How It Works

1. **Extension loads** → VS Code activates extension, creates webview panel
2. **Message Bridge** → Webview (React) ↔ Extension (Node.js) via `postMessage`
3. **Database Connection** → `pg` driver manages connection pool with SSL auto-detection
4. **Query Execution** → Parameterized queries prevent SQL injection
5. **UI Updates** → Real-time feedback with optimistic updates for edits

### Key Design Decisions

- **Connection Pooling**: Uses `pg` library's built-in pool for efficient connection reuse
- **Parameterized Queries**: All queries use `$1, $2` placeholders to prevent SQL injection
- **SSL Auto-detection**: Enables SSL for remote connections, disables for localhost
- **Sticky Headers**: CSS `position: sticky` keeps column names visible during scroll
- **Resizable Columns**: Custom drag-to-resize implementation with real-time width tracking

## Security

- **Parameterized Queries**: All user input is safely parameterized using `$1, $2` placeholders (via `pg` driver)
- **SQL Injection Protection**: Prevents injection attacks via proper parameter binding
- **Credential Encryption**: Passwords stored in VS Code's `SecretStorage` API (uses system keychain)
- **SSL/TLS Support**: Auto-enables for remote connections, disabled for localhost
- **No Credential Logging**: Credentials are never logged or exposed in error messages
- **Input Validation**: Database names and identifiers are validated before use

## Performance

- **Connection Pooling**: Managed by `pg` library for connection reuse
- **Pagination**: Tables load 100 rows at a time (configurable)
- **Efficient Queries**: Only fetches necessary data with LIMIT/OFFSET
- **Sticky Headers**: No performance impact from fixed column headers
- **Resizable Columns**: Drag-to-resize uses efficient DOM manipulation
- **Bundle Size**: ~67KB gzipped for webview (React + UI)

## Troubleshooting

### "Database connection not initialized"

- Ensure you've configured database credentials
- Check that PostgreSQL server is running
- Restart the extension (`PostgreSQL: Open Explorer`)

### "Failed to load schemas" / "Failed to load tables"

- Verify database credentials are correct
- Check network connectivity to the database
- Ensure the user has appropriate schema permissions
- Check logs: `PostgreSQL: Show Logs`

### "Failed to update cell"

- Ensure the table has a primary key
- Check that you have UPDATE permissions
- Verify the new value is compatible with the column data type

### Extension not appearing

- Make sure the extension is installed: check Extensions panel
- Rebuild the extension: `npm run build:all`
- Restart VS Code/Cursor

### Drag-to-resize not working

- Ensure you're clicking exactly on the column border (right edge)
- Cursor should change to `col-resize` when hovering over the border
- Try scrolling horizontally first, then resizing

## Development

### Prerequisites

```bash
# Install Node dependencies
npm install

# TypeScript version 5+ is required (peer dependency)
npm install -D typescript@^5
```

### Available Scripts

```bash
# Compile TypeScript to JavaScript
npm run compile

# Watch mode (recompile on file changes)
npm run watch

# Build webview (React app)
npm run webview:build

# Watch webview (live rebuild)
npm run webview:dev

# Build everything (TypeScript + webview)
npm run build:all

# Package extension as .vsix
npm run package
```

### Development Workflow

1. Open the project in VS Code
2. Press `F5` to launch Extension Development Host
3. In a separate terminal, run `npm run webview:dev` for live reloading
4. Changes to TypeScript will require rebuild (use `npm run watch`)
5. Changes to webview are hot-reloaded (Vite)

## 🚀 Coming Soon (Refactoring & Improvements)

### Code Quality
- **Refactor `dashboardPanel.ts`** (2,500+ LOC) → Split into:
  - Connection manager service
  - Database query service
  - Message handler service
  - This will improve maintainability, testability, and reduce cognitive complexity

### Features
- **Delete Operations**: Delete rows with confirmation dialog
- **Export Data**: Export tables to CSV/JSON formats
- **Import Data**: Import data from CSV files
- **Query History**: Track and replay previously executed queries
- **Saved Queries**: Save frequently used queries as snippets
- **Advanced Filtering**: Multi-condition filters with AND/OR logic
- **Schema Diagrams**: Visual relationship diagrams between tables

### Performance
- **Virtual Scrolling**: Handle 10K+ rows without performance degradation
- **Lazy Loading**: Load data on-demand for large tables
- **Query Optimization**: Automatic index suggestions

### Database Support
- **Multi-database**: MySQL, SQLite, MariaDB support
- **Transactions**: UI for transaction management (BEGIN/COMMIT/ROLLBACK)

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## Dependencies

### Production
- **pg** (^8.11.3) - PostgreSQL client driver with connection pooling
- **react** (^19.2.0) - UI library
- **react-dom** (^19.2.0) - React DOM rendering

### Development
- **TypeScript** (^5) - Type-safe JavaScript
- **Vite** (^7.1.10) - Fast webview bundling
- **@types/react** - TypeScript types for React
- **@vitejs/plugin-react** - React support for Vite
- **@vscode/vsce** - VS Code Extension CLI

## Credits

Built with:

- [VS Code Extension API](https://code.visualstudio.com/api) - Extension framework
- [node-postgres (pg)](https://node-postgres.com) - PostgreSQL client
- [React](https://react.dev) - UI framework
- [Vite](https://vitejs.dev) - Frontend build tool
- Inspired by database management tools like pgAdmin, DBeaver, and TablePlus
