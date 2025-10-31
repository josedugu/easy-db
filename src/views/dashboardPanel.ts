import * as vscode from "vscode";
import {
  DatabaseConfig,
  initializeConnection,
  resetConnection,
  testConnection,
  getSchemas,
  getTables,
} from "../database/connection";
import {
  getTableColumns,
  getAllData,
  getTableRowCount,
  SortColumn,
  getViews,
  getMaterializedViews,
  getFunctions,
  getSequences,
  executeCustomQuery,
} from "../database/queries";
import {
  getStoredCredentials,
  saveCredentials,
  clearCredentials as clearStoredCredentials,
  getAllConnections,
  saveConnection,
  updateConnection,
  deleteConnection,
  updateLastUsed,
  SavedConnection,
} from "../database/credentials";

import {
  getAllQueries,
  saveQuery as saveQueryToStorage,
  updateQuery as updateQueryInStorage,
  deleteQuery as deleteQueryFromStorage,
  SavedQuery,
} from "../database/savedQueries";
import { logError, logInfo } from "../utils/logger";
import { ConnectionService } from "../services/ConnectionService";
import { SchemaService } from "../services/SchemaService";
import { TableService } from "../services/TableService";
import { QueryService } from "../services/QueryService";

const DEFAULT_CONFIG: DatabaseConfig = {
  hostname: "localhost",
  port: 5432,
  database: "postgres",
  username: "postgres",
  password: "",
};

interface TableDataPayload {
  schema: string;
  table: string;
  page: number;
  pageSize: number;
  sorting?: SortColumn[];
  searchFilter?: string;
}

interface FilterPayload {
  column: string;
  operator: string;
  value: any;
}

export class DashboardPanel {
  public static currentPanel: DashboardPanel | undefined;
  private static readonly viewType = "postgresqlDashboard";

  private readonly panel: vscode.WebviewPanel;
  private readonly disposables: vscode.Disposable[] = [];
  
  // Servicios
  private readonly connectionService: ConnectionService;
  private readonly schemaService: SchemaService;
  private readonly tableService: TableService;
  private readonly queryService: QueryService;
  private currentConfig: DatabaseConfig | null = null;
  private remember = false;
  private isConnected = false;
  private lastError: string | undefined;
  private connectionCancellation: vscode.CancellationTokenSource | undefined;

  private constructor(
    panel: vscode.WebviewPanel,
    private readonly context: vscode.ExtensionContext
  ) {
    this.panel = panel;
    
    // Inicializar servicios
    this.connectionService = new ConnectionService(context);
    this.schemaService = new SchemaService();
    this.tableService = new TableService();
    this.queryService = new QueryService(context);
    this.panel.iconPath = {
      light: vscode.Uri.joinPath(
        context.extensionUri,
        "resources",
        "database.svg"
      ),
      dark: vscode.Uri.joinPath(
        context.extensionUri,
        "resources",
        "database.svg"
      ),
    };
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    this.panel.webview.options = {
      enableScripts: true,
      localResourceRoots: [context.extensionUri],
    };
    this.panel.webview.html = this.getHtml();

    this.setWebviewMessageListener();
  }

  public static createOrShow(context: vscode.ExtensionContext): DashboardPanel {
    const column =
      vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.One;

    if (DashboardPanel.currentPanel) {
      DashboardPanel.currentPanel.panel.reveal(column);
      return DashboardPanel.currentPanel;
    }

    const panel = vscode.window.createWebviewPanel(
      DashboardPanel.viewType,
      "easydb",
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );

    DashboardPanel.currentPanel = new DashboardPanel(panel, context);
    return DashboardPanel.currentPanel;
  }

  public static revive(
    panel: vscode.WebviewPanel,
    context: vscode.ExtensionContext
  ) {
    DashboardPanel.currentPanel = new DashboardPanel(panel, context);
  }

  public static async showConnection(context: vscode.ExtensionContext) {
    const panel = DashboardPanel.createOrShow(context);
    panel.postMessage("showConnection", null);
  }

  public static async clearCredentials(context: vscode.ExtensionContext) {
    await clearStoredCredentials(context);
    await resetConnection();
    const panel = DashboardPanel.currentPanel;
    if (panel) {
      panel.remember = false;
      panel.currentConfig = null;
      panel.isConnected = false;
      panel.lastError = undefined;
      panel.postMessage("credentialsCleared", DEFAULT_CONFIG);
    }
    vscode.window.showInformationMessage(
      "PostgreSQL credentials cleared. Update the connection to reconnect."
    );
  }

  public static async notifyRefresh() {
    DashboardPanel.currentPanel?.postMessage("refreshCurrentTable", null);
  }

  public dispose(): void {
    DashboardPanel.currentPanel = undefined;

    while (this.disposables.length) {
      const item = this.disposables.pop();
      item?.dispose();
    }
  }

  private setWebviewMessageListener() {
    this.panel.webview.onDidReceiveMessage(
      async (message) => {
        console.log(
          "[BACKEND] Received message:",
          JSON.stringify(message, null, 2)
        );
        switch (message.type) {
          case "ready":
            await this.handleReady();
            break;
          case "connect":
            await this.handleConnect(
              message.payload?.config as DatabaseConfig,
              !!message.payload?.remember,
              message.payload?.activeConnectionId
            );
            break;
          case "fetchSchemas":
            await this.sendSchemas();
            break;
          case "fetchTables":
            logInfo(`[BP] fetchTables received: ${message.payload?.schema}`);
            await this.sendTables(
              String(message.payload?.schema || ""),
              message.payload?.connectionId
            );
            break;
          case "fetchSchemaViews":
            logInfo(`[BP] fetchViews received: ${message.payload?.schema}`);
            await this.sendViews(
              String(message.payload?.schema || ""),
              message.payload?.connectionId
            );
            break;
          case "fetchSchemaMaterializedViews":
            logInfo(
              `[BP] fetchMaterializedViews received: ${message.payload?.schema}`
            );
            await this.sendMaterializedViews(
              String(message.payload?.schema || ""),
              message.payload?.connectionId
            );
            break;
          case "fetchSchemaFunctions":
            logInfo(`[BP] fetchFunctions received: ${message.payload?.schema}`);
            await this.sendFunctions(
              String(message.payload?.schema || ""),
              message.payload?.connectionId
            );
            break;
          case "fetchSchemaSequences":
            logInfo(`[BP] fetchSequences received: ${message.payload?.schema}`);
            await this.sendSequences(
              String(message.payload?.schema || ""),
              message.payload?.connectionId
            );
            break;
          case "fetchTableData":
            await this.sendTableData(message.payload as TableDataPayload);
            break;
          case "refreshData":
            await this.handleRefreshData(message.payload as TableDataPayload);
            break;
          case "showConnection":
            this.postMessage("showConnection", null);
            break;
          case "clearError":
            this.lastError = undefined;
            break;
          case "saveConfig":
            this.currentConfig = message.config as DatabaseConfig;
            break;
          case "disconnect":
            await this.handleDisconnect();
            break;
          case "saveCredentials":
            await this.persistCredentials(!!message.remember);
            break;
          case "saveConnection":
            await this.handleSaveConnection(
              message.payload?.name,
              message.payload?.config
            );
            break;
          case "updateConnection":
            await this.handleUpdateConnection(
              message.payload?.id,
              message.payload?.name,
              message.payload?.config
            );
            break;
          case "deleteConnection":
            await this.handleDeleteConnection(message.payload?.id);
            break;
          case "updateCell":
            await this.handleUpdateCell(
              message.schema,
              message.table,
              message.rowIndex,
              message.columnName,
              message.newValue,
              message.primaryKey
            );
            break;
          case "executeQuery":
            await this.handleExecuteQuery(message.payload?.sql);
            break;
          case "loadQueries":
            await this.handleLoadQueries();
            break;
          case "saveQuery":
            await this.handleSaveQuery(message.payload?.query);
            break;
          case "updateQuery":
            await this.handleUpdateQuery(message.payload?.query);
            break;
          case "deleteQuery":
            await this.handleDeleteQuery(message.payload?.id);
            break;
          default:
            break;
        }
      },
      null,
      this.disposables
    );
  }

  private async handleReady() {
    // Load all saved connections
    const connections = await getAllConnections(this.context);

    // Load all saved queries
    await this.handleLoadQueries();

    // Try to auto-connect to the last used connection
    if (connections.length > 0) {
      // Find the most recently used connection
      const lastUsed = connections
        .filter((c) => c.lastUsed)
        .sort((a, b) => {
          const dateA = new Date(a.lastUsed!).getTime();
          const dateB = new Date(b.lastUsed!).getTime();
          return dateB - dateA;
        })[0];

      // If no lastUsed, use the first connection
      const connectionToUse = lastUsed || connections[0];

      if (connectionToUse) {
        this.currentConfig = connectionToUse.config;
        // First send connections loaded with the active connection ID
        this.postMessage("connectionsLoaded", {
          connections,
          activeConnectionId: connectionToUse.id,
        });

        this.postMessage("initialState", {
          config: connectionToUse.config,
          remember: true,
          isConnected: false,
          lastError: this.lastError ?? null,
          activeConnectionId: connectionToUse.id,
        });
        await this.handleConnect(
          connectionToUse.config,
          true,
          connectionToUse.id
        );
        return;
      }
    }

    // No saved connections, just load empty list
    this.postMessage("connectionsLoaded", { connections });

    // Check for legacy stored credentials
    const stored = await getStoredCredentials(this.context);
    if (stored) {
      this.remember = true;
      this.currentConfig = stored;
      this.postMessage("initialState", {
        config: stored,
        remember: true,
        isConnected: this.isConnected,
        lastError: this.lastError ?? null,
      });
      await this.handleConnect(stored, true);
      return;
    }

    const envConfig = this.getEnvConfig();
    if (envConfig) {
      this.currentConfig = envConfig;
      this.postMessage("initialState", {
        config: envConfig,
        remember: false,
        isConnected: this.isConnected,
        lastError: this.lastError ?? null,
      });
      return;
    }

    const config = this.currentConfig ?? DEFAULT_CONFIG;
    this.postMessage("initialState", {
      config,
      remember: this.remember,
      isConnected: this.isConnected,
      lastError: this.lastError ?? null,
    });
  }

  private async handleConnect(
    config: DatabaseConfig,
    remember: boolean,
    activeConnectionId?: string
  ) {
    // Validar configuración usando el servicio
    const validationError = this.connectionService.validateConfig(config);
    if (validationError) {
      this.lastError = validationError;
      this.postMessage("connectionError", {
        message: validationError,
        config,
      });
      return;
    }

    // Cancel any previous connection attempt
    if (this.connectionCancellation) {
      this.connectionCancellation.cancel();
      this.connectionCancellation.dispose();
    }

    // Create new cancellation token for this connection attempt
    this.connectionCancellation = new vscode.CancellationTokenSource();
    const token = this.connectionCancellation.token;

    // Send connecting state to webview
    this.postMessage("connecting", { config });

    try {
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Connecting to PostgreSQL…",
          cancellable: true,
        },
        async (progress, cancellationToken) => {
          // Create disposables array to clean up
          const disposables: vscode.Disposable[] = [];

          try {
            // Create a promise that rejects when cancelled
            const cancellationPromise = new Promise<never>((_, reject) => {
              disposables.push(
                token.onCancellationRequested(() => {
                  reject(new Error("Connection cancelled"));
                })
              );
              disposables.push(
                cancellationToken.onCancellationRequested(() => {
                  if (this.connectionCancellation) {
                    this.connectionCancellation.cancel();
                  }
                  reject(new Error("Connection cancelled"));
                })
              );
            });

            // Race between the actual connection and cancellation
            await Promise.race([
              (async () => {
                if (token.isCancellationRequested) {
                  throw new Error("Connection cancelled");
                }

                // USAR EL SERVICIO
                await this.connectionService.connect(
                  config,
                  remember,
                  activeConnectionId
                );

                if (token.isCancellationRequested) {
                  throw new Error("Connection cancelled");
                }
              })(),
              cancellationPromise,
            ]);
          } finally {
            // Clean up event listeners
            disposables.forEach((d) => d.dispose());
          }
        }
      );

      // Check one more time before setting as connected
      if (token.isCancellationRequested) {
        throw new Error("Connection cancelled");
      }

      this.isConnected = true;
      this.currentConfig = config;
      this.lastError = undefined;
      this.remember = remember;

      this.postMessage("connectionSuccess", {
        config,
        remember,
      });

      await this.sendSchemas();
    } catch (error: any) {
      // Check if it was a cancellation
      if (
        error?.message === "Connection cancelled" ||
        token.isCancellationRequested
      ) {
        this.lastError = undefined;
        this.isConnected = false;
        this.postMessage("connectionCancelled", { config });
        return;
      }

      const message =
        error?.message ??
        "Failed to connect to PostgreSQL. Please verify your credentials.";
      this.lastError = message;
      this.isConnected = false;
      logError("Connection attempt failed.", error);
      this.postMessage("connectionError", {
        message,
        config,
        detail: this.getErrorDetail(error),
      });
    } finally {
      // Clean up cancellation token
      if (this.connectionCancellation) {
        this.connectionCancellation.dispose();
        this.connectionCancellation = undefined;
      }
    }
  }

  private async handleDisconnect(): Promise<void> {
    if (this.connectionCancellation) {
      this.connectionCancellation.cancel();
      this.connectionCancellation.dispose();
      this.connectionCancellation = undefined;
    }

    // USAR EL SERVICIO
    await this.connectionService.disconnect();

    this.isConnected = false;
    this.postMessage("disconnected", null);
  }

  private async handleRefreshData(payload: TableDataPayload) {
    if (!this.isConnected) {
      return;
    }
    await this.sendTableData(payload);
  }

  private async handleUpdateCell(
    schema: string,
    table: string,
    rowIndex: number,
    columnName: string,
    newValue: any,
    primaryKey: { column: string; value: any }
  ) {
    if (!this.isConnected) {
      this.postMessage("cellUpdateError", {
        message: "No active database connection.",
      });
      return;
    }

    try {
      await this.tableService.updateCell(
        schema,
        table,
        columnName,
        newValue,
        primaryKey
      );

      this.postMessage("cellUpdated", {
        schema,
        table,
        rowIndex,
        columnName,
        newValue,
      });
    } catch (error: any) {
      logError("Failed to update cell", error);
      this.postMessage("cellUpdateError", {
        message: "Failed to update cell",
      });
    }
  }

  private async persistCredentials(remember: boolean) {
    if (!this.currentConfig) {
      return;
    }

    if (remember) {
      await saveCredentials(this.context, this.currentConfig);
    } else {
      await clearStoredCredentials(this.context);
    }
  }

  private async handleSaveConnection(name: string, config: DatabaseConfig) {
    try {
      const connection = await this.connectionService.saveConnection(
        name,
        config
      );
      this.postMessage("connectionSaved", { connection });
    } catch (error) {
      logError("Failed to save connection", error);
      vscode.window.showErrorMessage("Failed to save connection");
    }
  }

  private async handleUpdateConnection(
    connectionId: string,
    name: string,
    config: DatabaseConfig
  ) {
    try {
      await this.connectionService.updateConnection(
        connectionId,
        name,
        config
      );

      const connections = await this.connectionService.getAllConnections();
      const updatedConnection = connections.find((c) => c.id === connectionId);

      this.postMessage("connectionUpdated", {
        connectionId,
        connection: updatedConnection,
      });
    } catch (error) {
      logError("Failed to update connection", error);
      vscode.window.showErrorMessage("Failed to update connection");
    }
  }

  private async handleDeleteConnection(connectionId: string) {
    try {
      await this.connectionService.deleteConnection(connectionId);
      this.postMessage("connectionDeleted", { connectionId });
    } catch (error) {
      logError("Failed to delete connection", error);
      vscode.window.showErrorMessage("Failed to delete connection");
    }
  }

  private validateConfig(config: DatabaseConfig): string | null {
    if (!config.hostname) {
      return "Hostname is required.";
    }
    if (!config.database) {
      return "Database name is required.";
    }
    if (!config.username) {
      return "Username is required.";
    }
    if (
      !Number.isFinite(config.port) ||
      config.port < 1 ||
      config.port > 65535
    ) {
      return "Port must be between 1 and 65535.";
    }
    return null;
  }

  private async sendSchemas() {
    if (!this.isConnected) {
      return;
    }

    try {
      const schemas = await this.schemaService.getSchemas();
      this.postMessage("schemas", { schemas });
    } catch (error: any) {
      logError("Failed to load schemas.", error);
      this.postMessage("dataError", {
        message: error?.message ?? "Failed to load schemas.",
      });
    }
  }

  private async sendTables(schema: string, connectionId?: string) {
    if (!this.isConnected || !schema) {
      return;
    }

    try {
      const tables = await this.schemaService.getTables(schema);
      this.postMessage("tables", { schema, tables, connectionId });
    } catch (error: any) {
      logError(`Failed to load tables for schema ${schema}`, error);
      this.postMessage("dataError", {
        message: error?.message ?? "Failed to load tables.",
      });
    }
  }

  private async sendViews(schema: string, connectionId?: string) {
    if (!this.isConnected || !schema) {
      return;
    }

    try {
      const views = await this.schemaService.getViews(schema);
      this.postMessage("views", { schema, views, connectionId });
    } catch (error: any) {
      logError(`Failed to load views for schema ${schema}`, error);
      this.postMessage("dataError", {
        message: error?.message ?? "Failed to load views.",
      });
    }
  }

  private async sendMaterializedViews(schema: string, connectionId?: string) {
    if (!this.isConnected || !schema) {
      return;
    }

    try {
      const views = await this.schemaService.getMaterializedViews(schema);
      this.postMessage("materializedViews", {
        schema,
        views,
        connectionId,
      });
    } catch (error: any) {
      logError(`Failed to load materialized views for schema ${schema}`, error);
      this.postMessage("dataError", {
        message: error?.message ?? "Failed to load materialized views.",
      });
    }
  }

  private async sendFunctions(schema: string, connectionId?: string) {
    if (!this.isConnected || !schema) {
      logInfo(
        `Skipped loading functions for schema ${schema}: connected=${this.isConnected}`
      );
      return;
    }

    try {
      logInfo(
        `Loading functions for schema ${schema} (connectionId=${
          connectionId ?? "unknown"
        })`
      );
      const functions = await getFunctions(schema);
      logInfo(`Loaded ${functions.length} functions from schema ${schema}.`);
      this.postMessage("functions", { schema, functions, connectionId });
    } catch (error: any) {
      logError(`Failed to load functions for schema ${schema}`, error);
      this.postMessage("dataError", {
        message: error?.message ?? "Failed to load functions.",
      });
    }
  }

  private async sendSequences(schema: string, connectionId?: string) {
    if (!this.isConnected || !schema) {
      return;
    }

    try {
      const sequences = await this.schemaService.getSequences(schema);
      this.postMessage("sequences", { schema, sequences, connectionId });
    } catch (error: any) {
      logError(`Failed to load sequences for schema ${schema}`, error);
      this.postMessage("dataError", {
        message: error?.message ?? "Failed to load sequences.",
      });
    }
  }

  private async sendTableData(
    payload: TableDataPayload & { filters?: FilterPayload[] }
  ) {
    if (!this.isConnected) {
      this.postMessage("dataError", {
        message: "No active database connection.",
      });
      return;
    }

    const schema = payload.schema;
    const table = payload.table;
    const page = Math.max(0, payload.page);
    const pageSize = payload.pageSize > 0 ? payload.pageSize : 100;

    if (!schema || !table) {
      return;
    }

    try {
      const sorting = payload.sorting || [];
      const result = await this.tableService.getTableData(
        table,
        schema,
        page,
        pageSize,
        sorting,
        payload.searchFilter
      );

      this.postMessage("tableData", {
        schema,
        table,
        columns: result.columns,
        rows: result.rows,
        totalCount: result.totalCount,
        page,
        pageSize,
      });
    } catch (error: any) {
      logError(
        `Failed to load data for ${schema}.${table} (page=${page}, pageSize=${pageSize})`,
        error
      );
      this.postMessage("dataError", {
        message: error?.message ?? "Failed to load table data.",
        invalidSearch: !!payload.searchFilter,
      });
    }
  }

  private postMessage<T>(type: string, payload: T) {
    this.panel.webview.postMessage({ type, payload });
  }

  private getErrorDetail(error: unknown): string | undefined {
    if (!error) {
      return undefined;
    }
    if (error instanceof Error) {
      const details = [
        error.message,
        (error as any).code ? `code=${(error as any).code}` : undefined,
        (error as any).detail ? `detail=${(error as any).detail}` : undefined,
      ]
        .filter(Boolean)
        .join(" | ");
      return `${details}\n${error.stack ?? ""}`;
    }
    if (typeof error === "object") {
      try {
        return JSON.stringify(error);
      } catch {
        return String(error);
      }
    }
    return String(error);
  }

  private getEnvConfig(): DatabaseConfig | null {
    const url = process.env.DATABASE_URL || process.env.DB_URL;
    if (url) {
      try {
        const parsed = new URL(url);
        return {
          hostname: parsed.hostname,
          port: parsed.port ? Number(parsed.port) : 5432,
          database: parsed.pathname.replace(/^\//, ""),
          username: decodeURIComponent(parsed.username),
          password: decodeURIComponent(parsed.password),
        };
      } catch (error) {
        console.warn("Failed to parse DATABASE_URL:", error);
      }
    }

    const hostname = process.env.DB_HOST;
    const database = process.env.DB_NAME;
    const username = process.env.DB_USER;
    const password = process.env.DB_PASSWORD;
    const port = process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432;

    if (hostname && database && username && password) {
      return {
        hostname,
        database,
        username,
        password,
        port,
      };
    }

    return null;
  }

  /**
   * 🚀 REACT VERSION - ACTIVE
   */
  private getHtml(): string {
    const nonce = this.getNonce();
    const mainJsUri = this.panel.webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.context.extensionUri,
        "out",
        "webview",
        "assets",
        "main.js"
      )
    );
    const mainCssUri = this.panel.webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.context.extensionUri,
        "out",
        "webview",
        "assets",
        "main.css"
      )
    );

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${this.panel.webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' ${this.panel.webview.cspSource};">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>easydb</title>
  <link rel="stylesheet" href="${mainCssUri}">
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}">
    window.vscode = acquireVsCodeApi();
  </script>
  <script nonce="${nonce}" type="module" src="${mainJsUri}"></script>
</body>
</html>`;
  }

  /**
   * 📝 HTML VERSION - BACKUP (previous implementation)
   */
  

  private getNonce(): string {
    const possible =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let text = "";
    for (let i = 0; i < 16; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  private async handleExecuteQuery(sql: string) {
    if (!this.isConnected || !sql) {
      this.postMessage("queryError", {
        message: "No active database connection or empty query.",
      });
      return;
    }

    try {
      const result = await this.queryService.executeQuery(sql);

      this.postMessage("queryResult", {
        rows: result.rows,
        rowCount: result.rowCount,
        executionTime: result.executionTime,
        command: result.command,
      });
    } catch (error: any) {
      logError("Query execution failed", error);

      const errorMessage = error?.message || "Query execution failed";
      const errorDetail = error?.detail || "";
      const errorHint = error?.hint || "";

      let fullMessage = errorMessage;
      if (errorDetail) fullMessage += `\n\nDetail: ${errorDetail}`;
      if (errorHint) fullMessage += `\n\nHint: ${errorHint}`;

      this.postMessage("queryError", {
        message: fullMessage,
      });
    }
  }

  private async handleLoadQueries() {
    try {
      const queries = await this.queryService.getAllQueries();
      this.postMessage("queriesLoaded", { queries });
    } catch (error) {
      logError("Failed to load queries", error);
    }
  }

  private async handleSaveQuery(query: SavedQuery) {
    try {
      const savedQuery = await this.queryService.saveQuery(query);
      this.postMessage("querySaved", { query: savedQuery });
    } catch (error) {
      logError("Failed to save query", error);
    }
  }

  private async handleUpdateQuery(query: SavedQuery) {
    try {
      await this.queryService.updateQuery(query);
      this.postMessage("queryUpdated", { query });
    } catch (error) {
      logError("Failed to update query", error);
    }
  }

  private async handleDeleteQuery(id: string) {
    try {
      await this.queryService.deleteQuery(id);
      this.postMessage("queryDeleted", { id });
    } catch (error) {
      logError("Failed to delete query", error);
    }
  }
}
