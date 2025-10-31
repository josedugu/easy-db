import * as vscode from "vscode";

class ExplorerItem extends vscode.TreeItem {
  static action(
    label: string,
    command: string,
    tooltip?: string,
    icon?: vscode.ThemeIcon
  ): ExplorerItem {
    const item = new ExplorerItem(
      label,
      vscode.TreeItemCollapsibleState.None,
      tooltip
    );
    item.command = {
      command,
      title: label,
    };
    item.iconPath = icon;
    item.contextValue = "action";
    return item;
  }

  constructor(
    label: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    tooltip?: string
  ) {
    super(label, collapsibleState);
    this.tooltip = tooltip;
    this.id = label;
  }
}

export class ExplorerViewProvider
  implements vscode.TreeDataProvider<ExplorerItem>
{
  private readonly _onDidChangeTreeData =
    new vscode.EventEmitter<ExplorerItem | undefined | void>();

  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private readonly context: vscode.ExtensionContext) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: ExplorerItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: ExplorerItem): Promise<ExplorerItem[]> {
    if (element) {
      return [];
    }

    return [
      ExplorerItem.action(
        "Open Explorer",
        "postgresql.openDashboard",
        "Open the EasyDB dashboard",
        new vscode.ThemeIcon("database")
      ),
      ExplorerItem.action(
        "Configure Connection",
        "postgresql.configureConnection",
        "Set PostgreSQL connection credentials",
        new vscode.ThemeIcon("plug")
      ),
      ExplorerItem.action(
        "Clear Credentials",
        "postgresql.clearCredentials",
        "Remove stored connection credentials",
        new vscode.ThemeIcon("trash")
      ),
      ExplorerItem.action(
        "Show Logs",
        "postgresql.showLogs",
        "Display extension logs",
        new vscode.ThemeIcon("output")
      ),
    ];
  }
}

