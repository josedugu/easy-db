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
  getAllQueries,
  saveQuery as saveQueryToStorage,
  updateQuery as updateQueryInStorage,
  deleteQuery as deleteQueryFromStorage,
  SavedQuery,
} from "../database/credentials";
import { logError, logInfo } from "../utils/logger";

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
    const validationError = this.validateConfig(config);
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
                await resetConnection();

                // Check if cancelled before connecting
                if (token.isCancellationRequested) {
                  throw new Error("Connection cancelled");
                }

                initializeConnection(config);

                // Check if cancelled before testing
                if (token.isCancellationRequested) {
                  throw new Error("Connection cancelled");
                }

                await testConnection();

                // Check if cancelled after testing
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

      await this.persistCredentials(remember);

      // Update lastUsed for the active connection if provided
      if (activeConnectionId) {
        await updateLastUsed(this.context, activeConnectionId);
      }

      logInfo("Connected to PostgreSQL successfully.");

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
    // If there's an ongoing connection attempt, cancel it
    if (this.connectionCancellation) {
      this.connectionCancellation.cancel();
      this.connectionCancellation.dispose();
      this.connectionCancellation = undefined;
    }

    // Always reset the connection pool to stop any pending queries
    await resetConnection();

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
      const { getConnection } = await import("../database/connection");
      const db = getConnection();

      // Construct UPDATE query using primary key
      const query = `UPDATE "${schema}"."${table}" SET "${columnName}" = $1 WHERE "${primaryKey.column}" = $2`;

      await db.query(query, [newValue, primaryKey.value]);

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
      const connection = await saveConnection(this.context, name, config);
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
      await updateConnection(this.context, connectionId, name, config);
      logInfo(`Connection "${name}" updated successfully.`);

      // Reload all connections and send to webview
      const connections = await getAllConnections(this.context);
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
      // Get the connection name for the confirmation dialog
      const connections = await getAllConnections(this.context);
      const connection = connections.find((c) => c.id === connectionId);

      if (!connection) {
        vscode.window.showErrorMessage("Connection not found");
        return;
      }

      // Show confirmation dialog
      const answer = await vscode.window.showWarningMessage(
        `Are you sure you want to delete the connection "${connection.name}"?`,
        { modal: true },
        "Delete",
        "Cancel"
      );

      if (answer !== "Delete") {
        return;
      }

      logInfo(`Attempting to delete connection with ID: ${connectionId}`);
      await deleteConnection(this.context, connectionId);
      logInfo(`Connection deleted successfully.`);
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
      const schemas = await getSchemas();
      logInfo(`Loaded ${schemas.length} schemas from PostgreSQL.`);
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
      logInfo(
        `Skipped loading tables for schema ${schema}: connected=${this.isConnected}`
      );
      return;
    }

    try {
      logInfo(
        `Loading tables for schema ${schema} (connectionId=${
          connectionId ?? "unknown"
        })`
      );
      const tables = await getTables(schema);
      logInfo(`Loaded ${tables.length} tables from schema ${schema}.`);
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
      logInfo(
        `Skipped loading views for schema ${schema}: connected=${this.isConnected}`
      );
      return;
    }

    try {
      logInfo(
        `Loading views for schema ${schema} (connectionId=${
          connectionId ?? "unknown"
        })`
      );
      const views = await getViews(schema);
      logInfo(`Loaded ${views.length} views from schema ${schema}.`);
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
      logInfo(
        `Skipped loading materialized views for schema ${schema}: connected=${this.isConnected}`
      );
      return;
    }

    try {
      logInfo(
        `Loading materialized views for schema ${schema} (connectionId=${
          connectionId ?? "unknown"
        })`
      );
      const views = await getMaterializedViews(schema);
      logInfo(
        `Loaded ${views.length} materialized views from schema ${schema}.`
      );
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
      logInfo(
        `Skipped loading sequences for schema ${schema}: connected=${this.isConnected}`
      );
      return;
    }

    try {
      logInfo(
        `Loading sequences for schema ${schema} (connectionId=${
          connectionId ?? "unknown"
        })`
      );
      const sequences = await getSequences(schema);
      logInfo(`Loaded ${sequences.length} sequences from schema ${schema}.`);
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
      const searchFilter = payload.searchFilter || "";
      const offset = page * pageSize;
      const sorting = payload.sorting || [];

      let data: any[];
      let totalCount: number;
      const columns = await getTableColumns(table, schema);

      // If there's a search filter, use raw query
      if (searchFilter) {
        const whereClause = searchFilter;
        let query = `SELECT * FROM "${schema}"."${table}" WHERE ${whereClause}`;

        // Add ORDER BY if sorting exists
        if (sorting.length > 0) {
          const orderClauses = sorting.map(
            (sort) => `"${sort.column}" ${sort.direction}`
          );
          query += ` ORDER BY ${orderClauses.join(", ")}`;
        }

        query += ` LIMIT ${pageSize} OFFSET ${offset}`;

        // Execute the query
        const { getConnection } = await import("../database/connection");
        const db = getConnection();
        const result = await db.query(query);
        data = result.rows;

        // Get count with the same filter
        const countQuery = `SELECT COUNT(*) as count FROM "${schema}"."${table}" WHERE ${whereClause}`;
        const countResult = await db.query<{ count: string }>(countQuery);
        totalCount = Number(countResult.rows[0]?.count || 0);
      } else {
        // No search filter, use normal getAllData
        totalCount = await getTableRowCount(table, schema);

        data = await getAllData(
          table,
          schema,
          {
            limit: pageSize,
            offset,
          },
          sorting
        );
      }

      this.postMessage("tableData", {
        schema,
        table,
        columns,
        rows: data,
        totalCount,
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
  private getHtmlOld(): string {
    const nonce = this.getNonce();
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>easydb</title>
  <style>
    :root {
      color-scheme: var(--vscode-color-scheme);
    }
    html, body {
      height: 100%;
      margin: 0;
      padding: 0;
      overflow: hidden;
    }
    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      display: flex;
      flex-direction: column;
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 20px;
      border-bottom: 1px solid var(--vscode-editor-foreground, rgba(255,255,255,0.08));
      background: var(--vscode-editor-background);
      position: sticky;
      top: 0;
      z-index: 10;
    }
    header h1 {
      margin: 0;
      font-size: 18px;
    }
    .tabs {
      display: flex;
      gap: 8px;
    }
    .tabs button {
      border: none;
      border-radius: 4px;
      background: transparent;
      color: var(--vscode-foreground);
      padding: 6px 12px;
      cursor: pointer;
    }
    .tabs button.active {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }
    .tabs button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .content {
      display: flex;
      flex-direction: column;
      flex: 1;
      padding: 24px;
      gap: 24px;
      align-items: center;
      overflow: auto;
      min-height: 0;
    }
    .page {
      display: none;
    }
    .page.active {
      display: flex;
      flex-direction: column;
      gap: 24px;
      width: 100%;
      max-width: 600px;
    }
    #connection-page.active {
      max-width: 100%;
      flex-direction: row;
      gap: 24px;
      height: 100%;
    }
    #data-page.active {
      max-width: 100%;
      height: 100%;
      overflow: hidden;
    }
    .connections-sidebar {
      min-width: 250px;
      max-width: 300px;
      border-radius: 6px;
      border: 1px solid var(--vscode-editorWidget-border, rgba(255,255,255,0.08));
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      background: var(--vscode-sideBar-background, rgba(255,255,255,0.02));
      overflow: hidden;
    }
    .connections-list {
      flex: 1;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .connection-item {
      padding: 12px;
      border-radius: 4px;
      border: 1px solid var(--vscode-editorWidget-border, rgba(255,255,255,0.08));
      background: var(--vscode-editor-background);
      cursor: pointer;
      transition: background 0.2s;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .connection-item:hover {
      background: rgba(255,255,255,0.05);
    }
    .connection-item.active {
      border-color: var(--vscode-button-background);
      background: rgba(100, 149, 237, 0.1);
    }
    .connection-item-header {
      display: flex;
      align-items: center;
      gap: 8px;
      justify-content: space-between;
    }
    .connection-item-name {
      font-weight: 600;
      font-size: 13px;
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .connection-item-status {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .connection-item-status.connected {
      background: #00a500;
      box-shadow: 0 0 4px #00a500;
    }
    .connection-item-status.saved {
      background: rgba(255,255,255,0.3);
    }
    .connection-item-info {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .connection-item-actions {
      display: flex;
      gap: 4px;
      margin-top: 4px;
    }
    .connection-item-actions button {
      flex: 1;
      padding: 4px 8px;
      font-size: 11px;
      border-radius: 3px;
      border: 1px solid var(--vscode-button-border, rgba(255,255,255,0.2));
      background: transparent;
      color: var(--vscode-foreground);
      cursor: pointer;
    }
    .connection-item-actions button:hover {
      background: rgba(255,255,255,0.05);
    }
    .connection-form-wrapper {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 24px;
      overflow: auto;
    }
    .new-connection-btn {
      width: 100%;
    }
    form {
      width: 100%;
      display: grid;
      gap: 20px;
    }
    label {
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-size: 13px;
    }
    input, select {
      padding: 9px 10px;
      border-radius: 4px;
      border: 1px solid var(--vscode-input-border, transparent);
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
    }
    .row {
      display: grid;
      gap: 16px;
    }
    .row.two {
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    }
    .actions {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .link-button {
      border: none;
      background: transparent;
      color: var(--vscode-textLink-foreground);
      text-decoration: underline;
      padding: 0;
      cursor: pointer;
      font-size: 13px;
    }
    .link-button:hover {
      color: var(--vscode-textLink-activeForeground);
    }
    button.primary {
      border: none;
      border-radius: 4px;
      padding: 10px 20px;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
    }
    button.primary:hover:not(:disabled) {
      background: var(--vscode-button-hoverBackground);
    }
    button.primary:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    button.success {
      border: none;
      border-radius: 4px;
      padding: 10px 20px;
      background: rgba(0, 165, 0, 0.2);
      color: var(--vscode-terminal-ansiGreen, #00a500);
      border: 1px solid rgba(0, 165, 0, 0.4);
      cursor: default;
      font-size: 13px;
      font-weight: 500;
    }
    button.secondary {
      border: 1px solid var(--vscode-button-border, rgba(255,255,255,0.2));
      border-radius: 4px;
      padding: 10px 20px;
      background: transparent;
      color: var(--vscode-foreground);
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
    }
    button.secondary:hover:not(:disabled) {
      background: rgba(255,255,255,0.05);
    }
    button.secondary:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .button-group {
      display: flex;
      gap: 12px;
      align-items: center;
    }
    .banner {
      border-radius: 6px;
      padding: 12px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 8px;
    }
    .error-banner {
      background: var(--vscode-inputValidation-errorBackground);
      border: 1px solid var(--vscode-inputValidation-errorBorder);
      color: var(--vscode-inputValidation-errorForeground);
    }
    .success-banner {
      background: rgba(0, 165, 0, 0.15);
      border: 1px solid rgba(0, 165, 0, 0.4);
      color: var(--vscode-terminal-ansiGreen, #00a500);
    }
    .info-banner {
      background: rgba(100, 149, 237, 0.15);
      border: 1px solid rgba(100, 149, 237, 0.4);
      color: var(--vscode-textLink-foreground);
    }
    .banner-content {
      flex: 1;
    }
    .banner-close {
      border: none;
      background: transparent;
      color: currentColor;
      cursor: pointer;
      padding: 4px;
      opacity: 0.7;
      font-size: 16px;
      line-height: 1;
    }
    .banner-close:hover {
      opacity: 1;
    }
    .remember,
    .hide-password {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      color: var(--vscode-descriptionForeground);
    }
    .data-page {
      display: grid;
      grid-template-columns: minmax(220px, 280px) 1fr;
      grid-template-rows: 1fr;
      gap: 24px;
      height: 100%;
      width: 100%;
      max-width: 100%;
      overflow: hidden;
    }
    .sidebar {
      border-radius: 6px;
      border: 1px solid var(--vscode-editorWidget-border, rgba(255,255,255,0.08));
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      background: var(--vscode-sideBar-background, rgba(255,255,255,0.02));
      overflow: hidden;
    }
    .sidebar section {
      display: flex;
      flex-direction: column;
      gap: 8px;
      flex: 1;
      min-height: 0;
    }
    .sidebar section.collapsed {
      flex: 0;
      min-height: auto;
    }
    .sidebar-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      cursor: pointer;
      padding: 4px 0;
      user-select: none;
    }
    .sidebar-header:hover {
      opacity: 0.8;
    }
    .sidebar h3 {
      margin: 0;
      font-size: 13px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: var(--vscode-descriptionForeground);
    }
    .collapse-icon {
      font-size: 16px;
      transition: transform 0.2s;
    }
    .collapse-icon.collapsed {
      transform: rotate(-90deg);
    }
    .main-panel {
      border-radius: 6px;
      border: 1px solid var(--vscode-editorWidget-border, rgba(255,255,255,0.08));
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      background: var(--vscode-editor-background);
      overflow: hidden;
    }
    #table-container:not(.placeholder) {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      overflow: hidden;
    }
    .table-header-info {
      flex-shrink: 0;
      margin-bottom: 0;
    }
    .table-wrapper {
      flex: 1;
      overflow: auto;
      min-height: 0;
      margin-top: 0;
    }
    .pagination-wrapper {
      flex-shrink: 0;
      padding-top: 12px;
      margin-top: 0;
      border-top: 1px solid var(--vscode-editorWidget-border, rgba(255,255,255,0.08));
      background: var(--vscode-editor-background);
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }
    th, td {
      border: 1px solid var(--vscode-editorWidget-border, rgba(255,255,255,0.08));
      padding: 8px 10px;
      text-align: center;
      vertical-align: middle;
    }
    th {
      background: var(--vscode-sideBarSectionHeader-background, rgba(255,255,255,0.04));
      font-weight: 600;
    }
    .placeholder {
      border: 1px dashed rgba(255,255,255,0.1);
      border-radius: 6px;
      padding: 32px;
      text-align: center;
      color: var(--vscode-descriptionForeground);
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 8px;
      background: var(--vscode-editorHoverWidget-background, rgba(255,255,255,0.04));
      border-radius: 999px;
      font-size: 12px;
    }
    .pagination {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .pagination button {
      border: 1px solid var(--vscode-button-border, rgba(255,255,255,0.2));
      background: transparent;
      color: var(--vscode-foreground);
      border-radius: 4px;
      padding: 6px 12px;
      cursor: pointer;
    }
    .pagination button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .schema-list, .table-list {
      flex: 1;
      overflow-y: auto;
      border: 1px solid var(--vscode-editorWidget-border, rgba(255,255,255,0.08));
      border-radius: 6px;
      min-height: 0;
    }
    .schema-list.collapsed, .table-list.collapsed {
      display: none;
    }
    .schema-item, .table-item {
      padding: 8px 12px;
      cursor: pointer;
      border-bottom: 1px solid rgba(255,255,255,0.05);
    }
    .schema-item:last-child, .table-item:last-child {
      border-bottom: none;
    }
    .schema-item.active, .table-item.active {
      background: var(--vscode-list-activeSelectionBackground);
      color: var(--vscode-list-activeSelectionForeground);
    }
    .controls {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
    }
    .controls button {
      border-radius: 4px;
      border: 1px solid var(--vscode-button-border, rgba(255,255,255,0.2));
      background: transparent;
      color: var(--vscode-foreground);
      padding: 6px 12px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .controls button:hover:not(:disabled) {
      background: rgba(255,255,255,0.05);
    }
    .controls button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    #refresh-data {
      min-width: 140px;
      justify-content: center;
    }
    #search-input {
      padding: 6px 12px;
      border: 1px solid var(--vscode-input-border, rgba(255,255,255,0.2));
      border-radius: 4px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      font-family: var(--vscode-font-family);
      font-size: 13px;
      outline: none;
    }
    #search-input:focus {
      border-color: var(--vscode-focusBorder);
    }
    #search-input.error {
      border-color: var(--vscode-inputValidation-errorBorder);
      color: var(--vscode-inputValidation-errorForeground);
      background: var(--vscode-inputValidation-errorBackground);
    }
    .spinner {
      display: inline-block;
      width: 12px;
      height: 12px;
      border: 2px solid rgba(255,255,255,0.3);
      border-top-color: currentColor;
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .sortable-header {
      cursor: pointer;
      user-select: none;
      position: relative;
    }
    .sortable-header:hover {
      background: rgba(255,255,255,0.05);
    }
    .sort-menu {
      background: var(--vscode-menu-background);
      border: 1px solid var(--vscode-menu-border);
      border-radius: 4px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      min-width: 200px;
      padding: 4px 0;
    }
    .sort-menu-item {
      padding: 8px 12px;
      cursor: pointer;
      color: var(--vscode-menu-foreground);
    }
    .sort-menu-item:hover {
      background: var(--vscode-menu-selectionBackground);
      color: var(--vscode-menu-selectionForeground);
    }
  </style>
</head>
<body>
  <header>
    <h1>easydb</h1>
    <div class="tabs">
      <button id="connection-tab" class="active" data-target="connection">Connection</button>
      <button id="data-tab" data-target="data" disabled>Data</button>
    </div>
  </header>
  <div class="content">
    <section id="connection-page" class="page active">
      <aside class="connections-sidebar">
        <h3 style="margin: 0 0 12px 0; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.6px; color: var(--vscode-descriptionForeground);">Saved Connections</h3>
        <button id="new-connection-btn" class="primary new-connection-btn">+ New Connection</button>
        <div id="connections-list" class="connections-list"></div>
      </aside>
      
      <div class="connection-form-wrapper">
        <div id="connection-status"></div>
        <div id="connection-name-wrapper" style="display: none;">
          <label>
            Connection Name
            <input type="text" id="connection-name-input" placeholder="My Database" />
          </label>
        </div>
        <form id="connection-form">
          <div class="row">
            <label>
              Hostname
              <input type="text" name="hostname" id="hostname-input" required />
            </label>
          </div>
          <div class="row two">
            <label>
              Port
              <input type="number" name="port" id="port-input" min="1" max="65535" required />
            </label>
            <label>
              Database
              <input type="text" name="database" id="database-input" required />
            </label>
          </div>
          <div class="row two">
            <label>
              Username
              <input type="text" name="username" id="username-input" required />
            </label>
            <label>
              Password
              <input type="text" name="password" id="password-input" />
            </label>
          </div>
          <div class="row two">
            <label class="hide-password">
              <input type="checkbox" id="hide-password-toggle" />
              Hide password with asterisks
            </label>
            <label class="remember">
              <input type="checkbox" name="remember" id="remember-input" />
              Save this connection
            </label>
          </div>
          <div class="button-group">
            <button id="connect-btn" class="primary" type="submit">Connect</button>
            <button id="connected-btn" class="success" type="button" style="display: none;">✅ Connected</button>
            <button id="disconnect-btn" class="secondary" type="button" disabled>Disconnect</button>
          </div>
        </form>
      </div>
    </section>

    <section id="data-page" class="page">
      <div class="data-page">
        <aside class="sidebar">
          <section id="schemas-section">
            <div class="sidebar-header" id="schemas-header">
              <h3>Schemas</h3>
              <span class="collapse-icon" id="schemas-icon">▼</span>
            </div>
            <div id="schemas" class="schema-list"></div>
          </section>
          <section id="tables-section">
            <div class="sidebar-header" id="tables-header">
              <h3>Tables</h3>
              <span class="collapse-icon" id="tables-icon">▼</span>
            </div>
            <div id="tables" class="table-list"></div>
          </section>
        </aside>
        <section class="main-panel">
          <div class="controls">
            <div>
              <span class="badge" id="active-database"></span>
            </div>
            <div style="flex: 1; display: flex; gap: 8px; align-items: center;">
              <input 
                type="text" 
                id="search-input" 
                placeholder="Enter a SQL expression to filter results (use Ctrl+Space)"
                style="flex: 1;"
              />
              <button id="refresh-data">
                <span id="refresh-text">Refresh Data</span>
              </button>
            </div>
          </div>
          <div id="table-container" class="placeholder">
            Select a schema and table to view its rows.
          </div>
        </section>
      </div>
    </section>
  </div>

  <script nonce="${nonce}">
    (function () {
      const vscode = acquireVsCodeApi();

      const state = {
        page: "connection",
        config: {
          hostname: "",
          port: 5432,
          database: "",
          username: "",
          password: "",
        },
        remember: false,
        hidePassword: false,
        isConnected: false,
        isConnecting: false,
        schemas: [],
        tables: [],
        activeSchema: null,
        activeTable: null,
        tableData: [],
        columns: [],
        totalCount: 0,
        pageIndex: 0,
        pageSize: 100,
        lastError: null,
        errorDetail: null,
        schemasCollapsed: false,
        tablesCollapsed: false,
        isRefreshing: false,
        savedConnections: [],
        activeConnectionId: null,
        connectedConnectionId: null,
        editingConnectionId: null,
        isNewConnection: false,
        sorting: [],
        searchFilter: "",
      };

      const connectionTab = document.getElementById("connection-tab");
      const dataTab = document.getElementById("data-tab");
      const connectionPage = document.getElementById("connection-page");
      const dataPage = document.getElementById("data-page");
      const statusEl = document.getElementById("connection-status");
      const rememberInput = document.getElementById("remember-input");
      const hidePasswordToggle = document.getElementById("hide-password-toggle");
      const passwordInput = document.getElementById("password-input");
      const hostnameInput = document.getElementById("hostname-input");
      const portInput = document.getElementById("port-input");
      const databaseInput = document.getElementById("database-input");
      const usernameInput = document.getElementById("username-input");
      const connectionForm = document.getElementById("connection-form");
      const connectBtn = document.getElementById("connect-btn");
      const connectedBtn = document.getElementById("connected-btn");
      const disconnectBtn = document.getElementById("disconnect-btn");
      const connectionsList = document.getElementById("connections-list");
      const newConnectionBtn = document.getElementById("new-connection-btn");
      const connectionNameWrapper = document.getElementById("connection-name-wrapper");
      const connectionNameInput = document.getElementById("connection-name-input");
      const schemasEl = document.getElementById("schemas");
      const tablesEl = document.getElementById("tables");
      const schemasSection = document.getElementById("schemas-section");
      const tablesSection = document.getElementById("tables-section");
      const schemasHeader = document.getElementById("schemas-header");
      const tablesHeader = document.getElementById("tables-header");
      const schemasIcon = document.getElementById("schemas-icon");
      const tablesIcon = document.getElementById("tables-icon");
      const tableContainer = document.getElementById("table-container");
      const refreshButton = document.getElementById("refresh-data");
      const refreshText = document.getElementById("refresh-text");
      const activeDatabaseBadge = document.getElementById("active-database");
      const searchInput = document.getElementById("search-input");

      function postMessage(type, payload) {
        vscode.postMessage({ type, ...(payload || {}) });
      }

      function applyFormValues() {
        hostnameInput.value = state.config.hostname ?? "";
        portInput.value = String(state.config.port ?? 5432);
        databaseInput.value = state.config.database ?? "";
        usernameInput.value = state.config.username ?? "";
        passwordInput.value = state.config.password ?? "";
        rememberInput.checked = !!state.remember;
        hidePasswordToggle.checked = state.hidePassword;
        updatePasswordVisibility();
      }

      function updatePasswordVisibility() {
        passwordInput.type = hidePasswordToggle.checked ? "password" : "text";
      }

      function setActivePage(page) {
        state.page = page;
        if (page === "connection") {
          connectionTab.classList.add("active");
          dataTab.classList.remove("active");
          connectionPage.classList.add("active");
          dataPage.classList.remove("active");
        } else {
          connectionTab.classList.remove("active");
          dataTab.classList.add("active");
          connectionPage.classList.remove("active");
          dataPage.classList.add("active");
        }
      }

      function renderStatus() {
        if (state.isConnecting) {
          statusEl.innerHTML = '<div class="banner info-banner"><div class="banner-content">🔄 Connecting to ' + escapeHtml(state.config.hostname) + '...</div></div>';
        } else if (state.lastError) {
          const detailHtml = state.errorDetail
            ? '<div style="margin-top:8px;"><button id="open-log-button" class="link-button">View detailed logs</button></div>'
            : "";
          statusEl.innerHTML =
            '<div class="banner error-banner"><div class="banner-content">' +
            escapeHtml(state.lastError) +
            detailHtml +
            '</div><button class="banner-close" id="close-error">×</button></div>';
          const openLogButton = document.getElementById("open-log-button");
          openLogButton?.addEventListener("click", () => {
            postMessage("showLogs");
          });
          const closeButton = document.getElementById("close-error");
          closeButton?.addEventListener("click", () => {
            state.lastError = null;
            state.errorDetail = null;
            renderStatus();
          });
        } else {
          // Only show errors, not success messages
          statusEl.innerHTML = "";
        }
        updateButtonStates();
      }
      
      function updateButtonStates() {
        // Check if the selected connection is the same as the connected one
        const isSelectedConnectionActive = state.activeConnectionId === state.connectedConnectionId;
        
        if (state.isConnecting) {
          // When connecting, show connect button disabled and enable disconnect to cancel
          connectBtn.style.display = "block";
          connectBtn.disabled = true;
          connectedBtn.style.display = "none";
          disconnectBtn.disabled = false;
          disconnectBtn.textContent = "Cancel";
        } else if (state.isConnected && isSelectedConnectionActive) {
          // When connected AND the selected connection is the connected one, show connected button
          connectBtn.style.display = "none";
          connectBtn.disabled = false;
          connectedBtn.style.display = "block";
          disconnectBtn.disabled = false;
          disconnectBtn.textContent = "Disconnect";
        } else {
          // When not connected OR selected connection is different, show connect button
          connectBtn.style.display = "block";
          connectBtn.disabled = false;
          connectedBtn.style.display = "none";
          // Enable disconnect only if there's an active connection
          disconnectBtn.disabled = !state.isConnected;
          disconnectBtn.textContent = "Disconnect";
        }
      }

      function toggleSchemasCollapse() {
        state.schemasCollapsed = !state.schemasCollapsed;
        if (state.schemasCollapsed) {
          schemasSection.classList.add("collapsed");
          schemasEl.classList.add("collapsed");
          schemasIcon.classList.add("collapsed");
        } else {
          schemasSection.classList.remove("collapsed");
          schemasEl.classList.remove("collapsed");
          schemasIcon.classList.remove("collapsed");
        }
      }

      function toggleTablesCollapse() {
        state.tablesCollapsed = !state.tablesCollapsed;
        if (state.tablesCollapsed) {
          tablesSection.classList.add("collapsed");
          tablesEl.classList.add("collapsed");
          tablesIcon.classList.add("collapsed");
        } else {
          tablesSection.classList.remove("collapsed");
          tablesEl.classList.remove("collapsed");
          tablesIcon.classList.remove("collapsed");
        }
      }

      function setRefreshLoading(loading) {
        state.isRefreshing = loading;
        refreshButton.disabled = loading;
        if (loading) {
          refreshText.textContent = 'Refreshing...';
        } else {
          refreshText.textContent = 'Refresh Data';
        }
      }

      function renderConnections() {
        if (!state.savedConnections.length) {
          connectionsList.innerHTML = '<div class="placeholder">No saved connections.<br>Click "+ New Connection" to add one.</div>';
          return;
        }

        connectionsList.innerHTML = state.savedConnections
          .map((conn) => {
            const isActive = conn.id === state.activeConnectionId;
            const isConnected = conn.id === state.connectedConnectionId;
            const statusClass = isConnected ? 'connected' : 'saved';
            const activeClass = isActive ? 'active' : '';
            
            return \`
              <div class="connection-item \${activeClass}" data-connection-id="\${conn.id}">
                <div class="connection-item-header">
                  <div class="connection-item-name">\${escapeHtml(conn.name)}</div>
                  <div class="connection-item-status \${statusClass}"></div>
                </div>
                <div class="connection-item-info">\${escapeHtml(conn.config.username)}@\${escapeHtml(conn.config.hostname)}:\${conn.config.port}</div>
                <div class="connection-item-info">\${escapeHtml(conn.config.database)}</div>
                <div class="connection-item-actions">
                  <button data-action="select">Select</button>
                  <button data-action="edit">Edit</button>
                  <button data-action="delete">Delete</button>
                </div>
              </div>
            \`;
          })
          .join("");

        // Add event listeners to connection items
        document.querySelectorAll('.connection-item').forEach(item => {
          const connectionId = item.getAttribute('data-connection-id');
          
          // Make the whole item clickable to select
          item.addEventListener('click', (e) => {
            // Don't trigger if clicking on a button
            if (e.target.closest('button')) {
              return;
            }
            selectConnection(connectionId);
          });
          
          // Add event listeners to buttons
          const selectBtn = item.querySelector('button[data-action="select"]');
          const editBtn = item.querySelector('button[data-action="edit"]');
          const deleteBtn = item.querySelector('button[data-action="delete"]');
          
          if (selectBtn) {
            selectBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              selectConnection(connectionId);
            });
          }
          
          if (editBtn) {
            editBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              editConnection(connectionId);
            });
          }
          
          if (deleteBtn) {
            deleteBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              deleteConnection(connectionId);
            });
          }
        });
      }

      function selectConnection(connectionId) {
        const connection = state.savedConnections.find(c => c.id === connectionId);
        if (!connection) return;

        state.activeConnectionId = connectionId;
        state.config = { ...connection.config };
        state.isNewConnection = false;
        state.editingConnectionId = null;
        
        applyFormValues();
        renderConnections();
        updateButtonStates(); // Update button states when changing selection
        connectionNameWrapper.style.display = 'none';
      }

      function editConnection(connectionId) {
        const connection = state.savedConnections.find(c => c.id === connectionId);
        if (!connection) return;

        state.editingConnectionId = connectionId;
        state.config = { ...connection.config };
        state.isNewConnection = false;
        
        connectionNameInput.value = connection.name;
        connectionNameWrapper.style.display = 'block';
        rememberInput.checked = true;
        
        applyFormValues();
        renderConnections();
      }

      function deleteConnection(connectionId) {
        // Send message to backend to handle confirmation and deletion
        postMessage('deleteConnection', { connectionId });
      }

      function newConnection() {
        state.isNewConnection = true;
        state.editingConnectionId = null;
        state.activeConnectionId = null;
        state.isConnected = false;
        state.isConnecting = false;
        state.lastError = null;
        state.errorDetail = null;
        state.config = {
          hostname: '',
          port: 5432,
          database: '',
          username: '',
          password: ''
        };
        
        connectionNameInput.value = '';
        connectionNameWrapper.style.display = 'block';
        rememberInput.checked = true;
        
        applyFormValues();
        renderConnections();
        renderStatus();
        updateButtonStates();
      }

      function renderSchemas() {
        if (!state.schemas.length) {
          schemasEl.innerHTML = '<div class="placeholder">No schemas found.</div>';
          return;
        }
        schemasEl.innerHTML = state.schemas
          .map((schema) => {
            const name = schema.schema_name;
            const active = state.activeSchema === name ? "active" : "";
            return '<div class="schema-item ' + active + '" data-schema="' + encodeURIComponent(name) + '">' + escapeHtml(name) + "</div>";
          })
          .join("");
      }

      function renderTables() {
        if (!state.tables.length) {
          tablesEl.innerHTML = '<div class="placeholder">Select a schema to view tables.</div>';
          return;
        }
        tablesEl.innerHTML = state.tables
          .map((table) => {
            const name = table.table_name;
            const qualified = table.table_schema + "." + name;
            const active = state.activeTable === name ? "active" : "";
            return '<div class="table-item ' + active + '" data-table="' + encodeURIComponent(name) + '">' + escapeHtml(name) + "</div>";
          })
          .join("");
      }

      function getSortIcon(columnName) {
        const sort = state.sorting.find(s => s.column === columnName);
        if (!sort) return '';
        return sort.direction === 'ASC' ? ' ↑' : ' ↓';
      }

      function renderTable() {
        if (!state.activeTable) {
          tableContainer.className = "placeholder";
          tableContainer.innerHTML = "Select a schema and table to view its rows.";
          return;
        }

        tableContainer.className = "";

        const totalPages = Math.max(1, Math.ceil(state.totalCount / state.pageSize));
        const currentPage = state.pageIndex + 1;
        const columnsHtml = state.columns
          .map((col) => {
            const sortIcon = getSortIcon(col.column_name);
            return \`<th class="sortable-header" data-column="\${escapeHtml(col.column_name)}">\${escapeHtml(col.column_name)}\${sortIcon}</th>\`;
          })
          .join("");
        const rowsHtml = state.tableData.length
          ? state.tableData
              .map((row) => {
                return "<tr>" + state.columns
                  .map((col) => {
                    const value = row[col.column_name];
                    if (value === null || value === undefined) {
                      return '<td><span class="badge">NULL</span></td>';
                    }
                    return "<td>" + escapeHtml(String(value)) + "</td>";
                  })
                  .join("") + "</tr>";
              })
              .join("")
          : '<tr><td colspan="' + state.columns.length + '">No rows returned.</td></tr>';

        tableContainer.innerHTML = \`
          <div class="table-header-info">
            <h2 style="margin: 0 0 8px 0;">\${escapeHtml(state.activeSchema)}.\${escapeHtml(state.activeTable)}</h2>
            <p style="margin: 0 0 16px 0; color: var(--vscode-descriptionForeground);">\${state.totalCount.toLocaleString()} rows • Page \${currentPage} of \${totalPages}</p>
          </div>
          <div class="table-wrapper">
            <table>
              <thead><tr>\${columnsHtml}</tr></thead>
              <tbody>\${rowsHtml}</tbody>
            </table>
          </div>
          <div class="pagination-wrapper">
            <div class="pagination">
              <button id="prev-page" \${state.pageIndex === 0 ? "disabled" : ""}>Previous</button>
              <button id="next-page" \${currentPage >= totalPages ? "disabled" : ""}>Next</button>
              <span>Page \${currentPage} of \${totalPages}</span>
            </div>
          </div>
        \`;

        const prevButton = document.getElementById("prev-page");
        const nextButton = document.getElementById("next-page");
        prevButton?.addEventListener("click", () => {
          if (state.pageIndex > 0) {
            state.pageIndex -= 1;
            setRefreshLoading(true);
            requestTableData();
          }
        });
        nextButton?.addEventListener("click", () => {
          const totalPages = Math.max(1, Math.ceil(state.totalCount / state.pageSize));
          if (state.pageIndex + 1 < totalPages) {
            state.pageIndex += 1;
            setRefreshLoading(true);
            requestTableData();
          }
        });
        
        // Add click listeners to sortable headers
        document.querySelectorAll('.sortable-header').forEach(header => {
          header.addEventListener('click', (e) => {
            const columnName = header.getAttribute('data-column');
            if (columnName) {
              showSortMenu(columnName, e);
            }
          });
        });
      }

      function showSortMenu(columnName, event) {
        event.stopPropagation();
        
        // Remove any existing menu
        const existingMenu = document.querySelector('.sort-menu');
        if (existingMenu) {
          existingMenu.remove();
        }
        
        // Create menu
        const menu = document.createElement('div');
        menu.className = 'sort-menu';
        menu.innerHTML = \`
          <div class="sort-menu-item" data-action="asc">Sort Ascending</div>
          <div class="sort-menu-item" data-action="desc">Sort Descending</div>
          <div class="sort-menu-item" data-action="clear">Clear Sort</div>
        \`;
        
        // Position menu near the clicked header
        const rect = event.target.getBoundingClientRect();
        menu.style.position = 'fixed';
        menu.style.top = rect.bottom + 'px';
        menu.style.left = rect.left + 'px';
        menu.style.zIndex = '10000';
        
        document.body.appendChild(menu);
        
        // Add click listeners to menu items
        menu.querySelectorAll('.sort-menu-item').forEach(item => {
          item.addEventListener('click', (e) => {
            e.stopPropagation();
            const action = item.getAttribute('data-action');
            if (action === 'asc') {
              applySorting(columnName, 'ASC');
            } else if (action === 'desc') {
              applySorting(columnName, 'DESC');
            } else if (action === 'clear') {
              clearSorting(columnName);
            }
            menu.remove();
          });
        });
        
        // Close menu when clicking outside
        const closeMenu = (e) => {
          if (!menu.contains(e.target)) {
            menu.remove();
            document.removeEventListener('click', closeMenu);
          }
        };
        setTimeout(() => document.addEventListener('click', closeMenu), 0);
      }
      
      function applySorting(columnName, direction) {
        // Remove existing sort for this column
        state.sorting = state.sorting.filter(s => s.column !== columnName);
        
        // Add new sort
        state.sorting.push({
          column: columnName,
          direction: direction
        });
        
        // Reset to first page and refresh
        state.pageIndex = 0;
        setRefreshLoading(true);
        requestTableData();
      }
      
      function clearSorting(columnName) {
        state.sorting = state.sorting.filter(s => s.column !== columnName);
        state.pageIndex = 0;
        setRefreshLoading(true);
        requestTableData();
      }

      function requestTableData() {
        if (!state.activeSchema || !state.activeTable) {
          return;
        }
        postMessage("fetchTableData", {
          payload: {
            schema: state.activeSchema,
            table: state.activeTable,
            page: state.pageIndex,
            pageSize: state.pageSize,
            sorting: state.sorting,
            searchFilter: state.searchFilter,
          },
        });
      }

      function escapeHtml(value) {
        return value
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#39;");
      }

      connectionTab.addEventListener("click", () => {
        setActivePage("connection");
      });

      dataTab.addEventListener("click", () => {
        if (dataTab.disabled) {
          return;
        }
        setActivePage("data");
        if (!state.schemas.length) {
          postMessage("fetchSchemas");
        }
      });

      hidePasswordToggle.addEventListener("change", () => {
        state.hidePassword = hidePasswordToggle.checked;
        updatePasswordVisibility();
      });

      rememberInput.addEventListener("change", () => {
        state.remember = rememberInput.checked;
      });

      connectionForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const config = {
          hostname: hostnameInput.value.trim(),
          port: Number(portInput.value),
          database: databaseInput.value.trim(),
          username: usernameInput.value.trim(),
          password: passwordInput.value,
        };
        state.config = config;
        state.lastError = null;
        state.isConnecting = true;
        renderStatus();
        
        // If connected to a different connection, disconnect first
        if (state.isConnected && state.activeConnectionId !== state.connectedConnectionId) {
          postMessage("disconnect", {});
        }
        
        // Handle saving connection
        if (state.remember) {
          const connectionName = connectionNameInput.value.trim() || \`\${config.username}@\${config.hostname}\`;
          
          if (state.editingConnectionId) {
            // Update existing connection
            postMessage("updateConnection", { 
              connectionId: state.editingConnectionId,
              name: connectionName,
              config 
            });
          } else if (state.isNewConnection || !state.activeConnectionId) {
            // Save new connection
            postMessage("saveConnection", { 
              name: connectionName,
              config 
            });
          }
        }
        
        postMessage("connect", { 
          config, 
          remember: state.remember,
          activeConnectionId: state.activeConnectionId // Send active connection ID
        });
      });

      disconnectBtn.addEventListener("click", () => {
        postMessage("disconnect");
      });

      newConnectionBtn.addEventListener("click", () => {
        newConnection();
      });

      schemasHeader.addEventListener("click", () => {
        toggleSchemasCollapse();
      });

      tablesHeader.addEventListener("click", () => {
        toggleTablesCollapse();
      });

      refreshButton.addEventListener("click", () => {
        if (state.isRefreshing) return;
        setRefreshLoading(true);
        requestTableData();
      });

      // Search input event listeners
      searchInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          state.searchFilter = searchInput.value.trim();
          state.pageIndex = 0;
          searchInput.classList.remove("error");
          setRefreshLoading(true);
          requestTableData();
        }
      });

      searchInput.addEventListener("input", () => {
        // Remove error class when user modifies the input
        if (searchInput.classList.contains("error")) {
          searchInput.classList.remove("error");
        }
      });

      schemasEl.addEventListener("click", (event) => {
        const target = event.target.closest(".schema-item");
        if (!target) return;
        const schema = decodeURIComponent(target.getAttribute("data-schema"));
        if (schema === state.activeSchema) return;
        state.activeSchema = schema;
        state.activeTable = null;
        state.tables = [];
        state.tableData = [];
        state.columns = [];
        state.totalCount = 0;
        state.pageIndex = 0;
        renderSchemas();
        renderTables();
        renderTable();
        postMessage("fetchTables", { schema });
      });

      tablesEl.addEventListener("click", (event) => {
        const target = event.target.closest(".table-item");
        if (!target) return;
        const table = decodeURIComponent(target.getAttribute("data-table"));
        if (table === state.activeTable) return;
        state.activeTable = table;
        state.pageIndex = 0;
        state.sorting = []; // Clear sorting when changing tables
        state.searchFilter = ""; // Clear search filter when changing tables
        searchInput.value = ""; // Clear search input
        searchInput.classList.remove("error"); // Remove error class
        renderTables();
        setRefreshLoading(true);
        requestTableData();
      });

      window.addEventListener("message", (event) => {
        const message = event.data;
        switch (message.type) {
          case "initialState": {
            const payload = message.payload;
            if (payload?.config) {
              state.config = payload.config;
            }
            if (typeof payload?.remember === "boolean") {
              state.remember = payload.remember;
            }
            if (payload?.activeConnectionId) {
              state.activeConnectionId = payload.activeConnectionId;
            }
            state.isConnected = !!payload?.isConnected;
            state.isConnecting = false;
            state.lastError = payload?.lastError;
            state.errorDetail = null;
            dataTab.disabled = !state.isConnected;
            activeDatabaseBadge.textContent = state.config.database
              ? "Connected to " + state.config.database
              : "";
            applyFormValues();
            renderStatus();
            break;
          }
          case "connecting": {
            const payload = message.payload;
            state.isConnecting = true;
            state.isConnected = false;
            state.lastError = null;
            state.errorDetail = null;
            if (payload?.config) {
              state.config = payload.config;
            }
            renderStatus();
            break;
          }
          case "connectionSuccess": {
            const payload = message.payload;
            state.isConnecting = false;
            state.isConnected = true;
            state.connectedConnectionId = state.activeConnectionId; // Mark this connection as connected
            state.config = payload.config;
            state.remember = !!payload.remember;
            state.errorDetail = null;
            dataTab.disabled = false;
            activeDatabaseBadge.textContent = "Connected to " + state.config.database;
            applyFormValues();
            renderStatus();
            renderConnections(); // Update connection status indicator
            setActivePage("data");
            postMessage("fetchSchemas");
            break;
          }
          case "connectionError": {
            const payload = message.payload;
            state.isConnecting = false;
            state.isConnected = false;
            state.lastError = payload.message;
            state.errorDetail = payload.detail || null;
            dataTab.disabled = true;
            if (payload.config) {
              state.config = payload.config;
              applyFormValues();
            }
            renderStatus();
            renderConnections(); // Update connection status indicator
            updateButtonStates(); // Update button states
            break;
          }
          case "connectionCancelled": {
            state.isConnecting = false;
            state.isConnected = false;
            state.lastError = null;
            state.errorDetail = null;
            dataTab.disabled = true;
            renderStatus();
            renderConnections(); // Update connection status indicator
            updateButtonStates(); // Update button states
            break;
          }
          case "schemas": {
            const payload = message.payload;
            state.schemas = payload.schemas || [];
            renderSchemas();
            break;
          }
          case "tables": {
            const payload = message.payload;
            if (state.activeSchema === payload.schema) {
              state.tables = payload.tables || [];
              renderTables();
            }
            break;
          }
          case "tableData": {
            const payload = message.payload;
            state.columns = payload.columns || [];
            state.tableData = payload.rows || [];
            state.totalCount = payload.totalCount || 0;
            state.pageIndex = payload.page ?? 0;
            state.pageSize = payload.pageSize ?? 100;
            state.activeSchema = payload.schema;
            state.activeTable = payload.table;
            setRefreshLoading(false);
            renderSchemas();
            renderTables();
            renderTable();
            break;
          }
          case "dataError": {
            const payload = message.payload;
            setRefreshLoading(false);
            tableContainer.className = "placeholder";
            tableContainer.innerHTML = '<div class="error-banner">' + escapeHtml(payload.message || "Unexpected error.") + "</div>";
            
            // If the error was caused by invalid search, mark the input as error
            if (payload.invalidSearch) {
              searchInput.classList.add("error");
            }
            break;
          }
          case "disconnected": {
            state.isConnected = false;
            state.isConnecting = false;
            state.connectedConnectionId = null; // Clear connected connection
            state.lastError = null;
            dataTab.disabled = true;
            state.schemas = [];
            state.tables = [];
            state.activeSchema = null;
            state.activeTable = null;
            state.tableData = [];
            activeDatabaseBadge.textContent = "";
            renderSchemas();
            renderTables();
            renderTable();
            renderConnections(); // Update connection status indicator
            setActivePage("connection");
            renderStatus();
            updateButtonStates(); // Update button states
            statusEl.innerHTML = "";
            break;
          }
          case "credentialsCleared": {
            state.remember = false;
            state.isConnected = false;
            state.config = message.payload || state.config;
            dataTab.disabled = true;
            state.schemas = [];
            state.tables = [];
            state.activeSchema = null;
            state.activeTable = null;
            state.tableData = [];
            activeDatabaseBadge.textContent = "";
            applyFormValues();
            renderSchemas();
            renderTables();
            renderTable();
            setActivePage("connection");
            renderStatus();
            break;
          }
          case "refreshCurrentTable": {
            requestTableData();
            break;
          }
          case "showConnection": {
            setActivePage("connection");
            break;
          }
          case "connectionsLoaded": {
            const payload = message.payload;
            state.savedConnections = payload.connections || [];
            // Set active connection ID if provided
            if (payload.activeConnectionId) {
              state.activeConnectionId = payload.activeConnectionId;
            }
            renderConnections();
            break;
          }
          case "connectionSaved": {
            const payload = message.payload;
            state.savedConnections.push(payload.connection);
            state.activeConnectionId = payload.connection.id;
            state.isNewConnection = false;
            state.editingConnectionId = null;
            connectionNameWrapper.style.display = 'none';
            renderConnections();
            break;
          }
          case "connectionUpdated": {
            const payload = message.payload;
            const index = state.savedConnections.findIndex(c => c.id === payload.connectionId);
            if (index !== -1) {
              state.savedConnections[index] = { ...state.savedConnections[index], ...payload.connection };
            }
            state.editingConnectionId = null;
            connectionNameWrapper.style.display = 'none';
            renderConnections();
            break;
          }
          case "connectionDeleted": {
            const payload = message.payload;
            const wasActive = state.activeConnectionId === payload.connectionId;
            const wasConnected = wasActive && state.isConnected;
            
            state.savedConnections = state.savedConnections.filter(c => c.id !== payload.connectionId);
            
            if (wasActive) {
              state.activeConnectionId = null;
              
              // If we were connected to this connection, disconnect first
              if (wasConnected) {
                postMessage('disconnect', {});
              }
              
              // If there are other connections, auto-select and connect to the first one
              if (state.savedConnections.length > 0) {
                const nextConnection = state.savedConnections[0];
                state.activeConnectionId = nextConnection.id;
                state.config = { ...nextConnection.config };
                applyFormValues();
                
                // Auto-connect to the next available connection
                postMessage('connect', { config: nextConnection.config, remember: true });
              } else {
                // No more connections, reset form
                state.config = {
                  hostname: '',
                  port: 5432,
                  database: '',
                  username: '',
                  password: ''
                };
                applyFormValues();
              }
            }
            
            renderConnections();
            break;
          }
          default:
            break;
        }
      });

      vscode.postMessage({ type: "ready" });
    })();
  </script>
</body>
</html>`;
  }

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

    const startTime = Date.now();
    try {
      logInfo(`[BP] Executing query: ${sql.substring(0, 50)}...`);
      const result = await executeCustomQuery(sql);
      const executionTime = Date.now() - startTime;

      logInfo(
        `[BP] Query executed: ${result.rowCount} rows in ${executionTime}ms`
      );

      this.postMessage("queryResult", {
        rows: result.rows,
        rowCount: result.rowCount,
        executionTime,
        command: result.command,
      });
    } catch (error: any) {
      logError("Query execution failed", error);

      // Extract detailed error message from PostgreSQL
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
      const queries = await getAllQueries(this.context);
      this.postMessage("queriesLoaded", { queries });
    } catch (error) {
      logError("Failed to load queries", error);
    }
  }

  private async handleSaveQuery(query: SavedQuery) {
    try {
      const savedQuery = await saveQueryToStorage(this.context, query);
      this.postMessage("querySaved", { query: savedQuery });
      logInfo(`Query "${query.name}" saved successfully.`);
    } catch (error) {
      logError("Failed to save query", error);
    }
  }

  private async handleUpdateQuery(query: SavedQuery) {
    try {
      await updateQueryInStorage(this.context, query);
      this.postMessage("queryUpdated", { query });
      logInfo(`Query "${query.name}" updated successfully.`);
    } catch (error) {
      logError("Failed to update query", error);
    }
  }

  private async handleDeleteQuery(id: string) {
    try {
      await deleteQueryFromStorage(this.context, id);
      this.postMessage("queryDeleted", { id });
      logInfo(`Query deleted successfully.`);
    } catch (error) {
      logError("Failed to delete query", error);
    }
  }
}
