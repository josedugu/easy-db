import * as vscode from "vscode";

let channel: vscode.OutputChannel | null = null;

export function initializeLogger(
  outputChannel: vscode.OutputChannel
): void {
  channel = outputChannel;
}

export function logInfo(message: string): void {
  const timestamp = new Date().toISOString();
  channel?.appendLine(`[INFO ${timestamp}] ${message}`);
  if (!channel) {
    console.log(`[INFO ${timestamp}] ${message}`);
  }
}

export function logError(message: string, error?: unknown): void {
  const timestamp = new Date().toISOString();
  channel?.appendLine(`[ERROR ${timestamp}] ${message}`);
  if (error instanceof Error) {
    channel?.appendLine(error.stack ?? error.message);
    console.error(message, error);
  } else if (error) {
    const detail = typeof error === "string" ? error : JSON.stringify(error);
    channel?.appendLine(detail);
    console.error(message, error);
  }
  if (!channel) {
    console.error(`[ERROR ${timestamp}] ${message}`, error);
  }
}

export function showLogs(preserveFocus = false): void {
  channel?.show(preserveFocus);
}
