import * as vscode from "vscode";
import {
  DatabaseConfig,
  initializeConnection,
  resetConnection,
  testConnection,
} from "../database/connection";
import {
  getStoredCredentials,
  saveCredentials,
  clearCredentials,
  getAllConnections,
  saveConnection as saveConnectionToStorage,
  updateConnection as updateConnectionInStorage,
  deleteConnection as deleteConnectionFromStorage,
  updateLastUsed,
  SavedConnection,
} from "../database/credentials";
import { logInfo } from "../utils/logger";

export class ConnectionService {
  constructor(private readonly context: vscode.ExtensionContext) {}

  async connect(
    config: DatabaseConfig,
    remember: boolean,
    activeConnectionId?: string
  ): Promise<void> {
    await resetConnection();
    initializeConnection(config);
    await testConnection();

    if (remember) {
      await saveCredentials(this.context, config);
    } else {
      await clearCredentials(this.context);
    }

    if (activeConnectionId) {
      await updateLastUsed(this.context, activeConnectionId);
    }

    logInfo("Connected to PostgreSQL successfully.");
  }

  async disconnect(): Promise<void> {
    await resetConnection();
    logInfo("Disconnected from PostgreSQL.");
  }

  async getStoredCredentials(): Promise<DatabaseConfig | null> {
    return await getStoredCredentials(this.context);
  }

  async clearCredentials(): Promise<void> {
    await clearCredentials(this.context);
    await resetConnection();
  }

  async getAllConnections(): Promise<SavedConnection[]> {
    return await getAllConnections(this.context);
  }

  async saveConnection(
    name: string,
    config: DatabaseConfig
  ): Promise<SavedConnection> {
    return await saveConnectionToStorage(this.context, name, config);
  }

  async updateConnection(
    id: string,
    name: string,
    config: DatabaseConfig
  ): Promise<void> {
    await updateConnectionInStorage(this.context, id, name, config);
    logInfo(`Connection "${name}" updated successfully.`);
  }

  async deleteConnection(id: string): Promise<void> {
    const connections = await getAllConnections(this.context);
    const connection = connections.find((c) => c.id === id);

    if (!connection) {
      throw new Error("Connection not found");
    }

    const answer = await vscode.window.showWarningMessage(
      `Are you sure you want to delete the connection "${connection.name}"?`,
      { modal: true },
      "Delete",
      "Cancel"
    );

    if (answer !== "Delete") {
      return;
    }

    await deleteConnectionFromStorage(this.context, id);
    logInfo(`Connection deleted successfully.`);
  }

  validateConfig(config: DatabaseConfig): string | null {
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
}

