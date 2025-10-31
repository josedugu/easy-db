import * as vscode from "vscode";
import { DatabaseConfig } from "./connection";

const CREDENTIALS_KEY = "postgresql.credentials";
const CONNECTIONS_KEY = "postgresql.connections";

// Legacy function - keep for backwards compatibility
export async function getStoredCredentials(
  context: vscode.ExtensionContext
): Promise<DatabaseConfig | null> {
  const raw = await context.secrets.get(CREDENTIALS_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DatabaseConfig;
  } catch {
    return null;
  }
}

// Legacy function - keep for backwards compatibility
export async function saveCredentials(
  context: vscode.ExtensionContext,
  config: DatabaseConfig
): Promise<void> {
  await context.secrets.store(CREDENTIALS_KEY, JSON.stringify(config));
}

// Legacy function - keep for backwards compatibility
export async function clearCredentials(
  context: vscode.ExtensionContext
): Promise<void> {
  if (typeof (context.secrets as any).delete === "function") {
    await (context.secrets as any).delete(CREDENTIALS_KEY);
  } else {
    await context.secrets.store(CREDENTIALS_KEY, "");
  }
}

export interface SavedConnection {
  id: string;
  name: string;
  config: DatabaseConfig;
  createdAt: string;
  lastUsed?: string;
}


// New multi-connection functions
export async function getAllConnections(
  context: vscode.ExtensionContext
): Promise<SavedConnection[]> {
  const storedData = await context.secrets.get(CONNECTIONS_KEY);
  if (!storedData) {
    return [];
  }

  try {
    return JSON.parse(storedData) as SavedConnection[];
  } catch {
    return [];
  }
}

export async function saveConnection(
  context: vscode.ExtensionContext,
  name: string,
  config: DatabaseConfig
): Promise<SavedConnection> {
  const connections = await getAllConnections(context);

  const newConnection: SavedConnection = {
    id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
    name,
    config,
    createdAt: new Date().toISOString(),
  };

  connections.push(newConnection);
  await context.secrets.store(CONNECTIONS_KEY, JSON.stringify(connections));

  return newConnection;
}

export async function updateConnection(
  context: vscode.ExtensionContext,
  id: string,
  name: string,
  config: DatabaseConfig
): Promise<void> {
  const connections = await getAllConnections(context);
  const index = connections.findIndex((conn) => conn.id === id);

  if (index !== -1) {
    connections[index] = {
      ...connections[index],
      name,
      config,
    };
    await context.secrets.store(CONNECTIONS_KEY, JSON.stringify(connections));
  }
}

export async function deleteConnection(
  context: vscode.ExtensionContext,
  id: string
): Promise<void> {
  const connections = await getAllConnections(context);
  const filtered = connections.filter((conn) => conn.id !== id);
  await context.secrets.store(CONNECTIONS_KEY, JSON.stringify(filtered));
}

export async function updateLastUsed(
  context: vscode.ExtensionContext,
  id: string
): Promise<void> {
  const connections = await getAllConnections(context);
  const index = connections.findIndex((conn) => conn.id === id);

  if (index !== -1) {
    connections[index].lastUsed = new Date().toISOString();
    await context.secrets.store(CONNECTIONS_KEY, JSON.stringify(connections));
  }
}

export async function promptForCredentials(): Promise<DatabaseConfig | null> {
  // Step 1: Hostname
  const hostname = await vscode.window.showInputBox({
    prompt: "PostgreSQL Hostname",
    placeHolder: "localhost or 127.0.0.1",
    value: "localhost",
    ignoreFocusOut: true,
  });

  if (!hostname) {
    return null;
  }

  // Step 2: Port
  const portString = await vscode.window.showInputBox({
    prompt: "PostgreSQL Port",
    placeHolder: "5432",
    value: "5432",
    ignoreFocusOut: true,
    validateInput: (value) => {
      const port = parseInt(value);
      if (isNaN(port) || port < 1 || port > 65535) {
        return "Please enter a valid port number (1-65535)";
      }
      return null;
    },
  });

  if (!portString) {
    return null;
  }

  const port = parseInt(portString);

  // Step 3: Database Name
  const database = await vscode.window.showInputBox({
    prompt: "Database Name",
    placeHolder: "my_database",
    ignoreFocusOut: true,
  });

  if (!database) {
    return null;
  }

  // Step 4: Username
  const username = await vscode.window.showInputBox({
    prompt: "Database Username",
    placeHolder: "postgres",
    ignoreFocusOut: true,
  });

  if (!username) {
    return null;
  }

  // Step 5: Password
  const password = await vscode.window.showInputBox({
    prompt: "Database Password",
    password: true, // This masks the input
    ignoreFocusOut: true,
  });

  if (password === undefined) {
    // User cancelled
    return null;
  }

  return {
    hostname,
    port,
    database,
    username,
    password: password || "", // Allow empty password
  };
}

export async function promptToSaveCredentials(
  config: DatabaseConfig
): Promise<boolean> {
  const choice = await vscode.window.showQuickPick(
    [
      {
        label: "$(key) Save credentials securely",
        description: "Credentials will be stored in VS Code's secure storage",
        value: true,
      },
      {
        label: "$(circle-slash) Don't save",
        description: "You'll need to enter credentials again next time",
        value: false,
      },
    ],
    {
      placeHolder: "Would you like to save these credentials?",
      ignoreFocusOut: true,
    }
  );

  return choice?.value ?? false;
}
