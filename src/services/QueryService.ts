import * as vscode from "vscode";
import { executeCustomQuery } from "../database/queries";
import {
  getAllQueries,
  saveQuery as saveQueryToStorage,
  updateQuery as updateQueryInStorage,
  deleteQuery as deleteQueryFromStorage,
  SavedQuery,
} from "../database/savedQueries";

export class QueryService {
  constructor(private readonly context: vscode.ExtensionContext) {}

  async executeQuery(sql: string): Promise<{
    rows: any[];
    rowCount: number;
    executionTime: number;
    command: string;
  }> {
    const startTime = Date.now();
    const result = await executeCustomQuery(sql);
    const executionTime = Date.now() - startTime;
    return {
      rows: result.rows,
      rowCount: result.rowCount,
      executionTime,
      command: result.command,
    };
  }

  async getAllQueries(): Promise<SavedQuery[]> {
    return await getAllQueries(this.context);
  }

  async saveQuery(query: SavedQuery): Promise<SavedQuery> {
    return await saveQueryToStorage(this.context, query);
  }

  async updateQuery(query: SavedQuery): Promise<void> {
    await updateQueryInStorage(this.context, query);
  }

  async deleteQuery(id: string): Promise<void> {
    await deleteQueryFromStorage(this.context, id);
  }
}

