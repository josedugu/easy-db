import { getSchemas, getTables, Schema, Table } from "../database/connection";
import {
  getViews,
  getMaterializedViews,
  getFunctions,
  getSequences,
} from "../database/queries";
import { logInfo } from "../utils/logger";

export class SchemaService {
  async getSchemas(): Promise<Schema[]> {
    const schemas = await getSchemas();
    logInfo(`Loaded ${schemas.length} schemas from PostgreSQL.`);
    return schemas;
  }

  async getTables(schema: string): Promise<Table[]> {
    logInfo(`Loading tables for schema ${schema}`);
    const tables = await getTables(schema);
    logInfo(`Loaded ${tables.length} tables from schema ${schema}.`);
    return tables;
  }

  async getViews(schema: string): Promise<string[]> {
    logInfo(`Loading views for schema ${schema}`);
    const views = await getViews(schema);
    logInfo(`Loaded ${views.length} views from schema ${schema}.`);
    return views;
  }

  async getMaterializedViews(schema: string): Promise<string[]> {
    logInfo(`Loading materialized views for schema ${schema}`);
    const views = await getMaterializedViews(schema);
    logInfo(`Loaded ${views.length} materialized views from schema ${schema}.`);
    return views;
  }

  async getFunctions(schema: string): Promise<string[]> {
    logInfo(`Loading functions for schema ${schema}`);
    const functions = await getFunctions(schema);
    logInfo(`Loaded ${functions.length} functions from schema ${schema}.`);
    return functions;
  }

  async getSequences(schema: string): Promise<string[]> {
    logInfo(`Loading sequences for schema ${schema}`);
    const sequences = await getSequences(schema);
    logInfo(`Loaded ${sequences.length} sequences from schema ${schema}.`);
    return sequences;
  }
}

