import * as vscode from "vscode";

const QUERIES_KEY = "postgresql.queries";

export interface SavedQuery {
  id: string;
  name: string;
  sql: string;
  createdAt: string;
  lastExecuted?: string;
  isFavorite?: boolean;
}

export async function getAllQueries(
  context: vscode.ExtensionContext
): Promise<SavedQuery[]> {
  const queriesData = context.globalState.get<SavedQuery[]>(QUERIES_KEY);
  return queriesData || [];
}

export async function saveQuery(
  context: vscode.ExtensionContext,
  query: SavedQuery
): Promise<SavedQuery> {
  const queries = await getAllQueries(context);
  queries.push(query);
  await context.globalState.update(QUERIES_KEY, queries);
  return query;
}

export async function updateQuery(
  context: vscode.ExtensionContext,
  query: SavedQuery
): Promise<void> {
  const queries = await getAllQueries(context);
  const index = queries.findIndex((q) => q.id === query.id);
  if (index !== -1) {
    queries[index] = query;
    await context.globalState.update(QUERIES_KEY, queries);
  }
}

export async function deleteQuery(
  context: vscode.ExtensionContext,
  id: string
): Promise<void> {
  const queries = await getAllQueries(context);
  const filtered = queries.filter((q) => q.id !== id);
  await context.globalState.update(QUERIES_KEY, filtered);
}
