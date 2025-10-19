export interface DatabaseConfig {
  hostname: string;
  port: number;
  database: string;
  username: string;
  password: string;
}

export interface SavedConnection {
  id: string;
  name: string;
  config: DatabaseConfig;
  createdAt: string;
  lastUsed?: string;
}

export interface TableColumn {
  column_name: string;
  data_type: string;
  is_nullable: string;
}

export interface SortColumn {
  column: string;
  direction: "ASC" | "DESC";
}

export interface PendingEdit {
  rowIndex: number;
  columnName: string;
  newValue: any;
  oldValue: any;
  primaryKey: {
    column: string;
    value: any;
  };
}

export interface AppState {
  isConnected: boolean;
  isConnecting: boolean;
  lastError: string | null;
  errorDetail: string | null;
  activeSchema: string | null;
  activeTable: string | null;
  schemas: string[];
  tables: string[];
  columns: TableColumn[];
  tableData: any[];
  totalRows: number;
  pageIndex: number;
  pageSize: number;
  schemasCollapsed: boolean;
  tablesCollapsed: boolean;
  isRefreshing: boolean;
  savedConnections: SavedConnection[];
  activeConnectionId: string | null;
  connectedConnectionId: string | null;
  editingConnectionId: string | null;
  isNewConnection: boolean;
  sorting: SortColumn[];
  searchFilter: string;
}

export type MessageType =
  | "ready"
  | "connect"
  | "disconnect"
  | "fetchSchemas"
  | "fetchTables"
  | "fetchTableData"
  | "saveConnection"
  | "updateConnection"
  | "deleteConnection"
  | "updateCell";

export interface Message<T = any> {
  type: MessageType;
  payload?: T;
}

// VSCode API type
export interface VSCodeAPI {
  postMessage(message: Message): void;
  getState(): any;
  setState(state: any): void;
}

declare global {
  interface Window {
    acquireVsCodeApi(): VSCodeAPI;
  }
}
