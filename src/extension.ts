import * as vscode from "vscode";
import { DashboardPanel } from "./views/dashboardPanel";
import { initializeLogger, showLogs } from "./utils/logger";
import { ExplorerViewProvider } from "./views/explorerView";

export async function activate(context: vscode.ExtensionContext) {
  const outputChannel = vscode.window.createOutputChannel(
    "PostgreSQL Explorer"
  );
  initializeLogger(outputChannel);
  context.subscriptions.push(outputChannel);

  const explorerProvider = new ExplorerViewProvider(context);
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider(
      "postgresqlExplorerView",
      explorerProvider
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("postgresql.openDashboard", () => {
      DashboardPanel.createOrShow(context);
    }),
    vscode.commands.registerCommand("postgresql.configureConnection", () => {
      DashboardPanel.showConnection(context);
    }),
    vscode.commands.registerCommand("postgresql.clearCredentials", async () => {
      await DashboardPanel.clearCredentials(context);
    }),
    vscode.commands.registerCommand("postgresql.refreshData", () => {
      DashboardPanel.notifyRefresh();
    }),
    vscode.commands.registerCommand("postgresql.showLogs", () => {
      showLogs();
    })
  );

  DashboardPanel.createOrShow(context);
}

export function deactivate() {}
