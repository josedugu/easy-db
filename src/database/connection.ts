import { Pool, QueryResultRow, PoolConfig } from "pg";
import { logError, logInfo } from "../utils/logger";

let pool: Pool | null = null;
let poolConfig: DatabaseConfig | null = null;

export interface DatabaseConfig {
  hostname: string;
  port: number;
  database: string;
  username: string;
  password: string;
}

export function initializeConnection(config: DatabaseConfig): Pool {
  if (pool) {
    return pool;
  }

  const hostLower = config.hostname.toLowerCase();
  const shouldUseSSL = !["localhost", "127.0.0.1", "::1"].includes(hostLower);

  const poolOptions: PoolConfig = {
    host: config.hostname,
    port: config.port,
    database: config.database,
    user: config.username,
    password: config.password,
  };

  if (shouldUseSSL) {
    poolOptions.ssl = { rejectUnauthorized: false };
  }

  pool = new Pool(poolOptions);
  poolConfig = { ...config };

  pool.on("error", (error) => {
    logError("Unexpected PostgreSQL pool error", error);
  });

  logInfo(`PostgreSQL connection pool initialized (SSL=${shouldUseSSL})`);

  return pool;
}

export function getConnection(): Pool {
  if (!pool) {
    throw new Error(
      "Database connection not initialized. Call initializeConnection first."
    );
  }
  return pool;
}

export async function testConnection(): Promise<void> {
  const db = getConnection();
undefined
}

export async function runQuery<T extends QueryResultRow = QueryResultRow>(
  queryText: string,
  params: any[] = []
): Promise<T[]> {
  const db = getConnection();
  const result = await db.query<T>(queryText, params);
  return result.rows;
}

export function getCurrentConfig(): DatabaseConfig | null {
  return poolConfig ? { ...poolConfig } : null;
}

export async function resetConnection(): Promise<void> {
  if (pool) {
    try {
      await pool.end();
    } catch (error) {
      logError("Error while closing PostgreSQL pool", error);
    }
  }
  pool = null;
  poolConfig = null;
}

export interface Schema {
  schema_name: string;
}

export async function getSchemas(): Promise<Schema[]> {
  const query = `
    SELECT schema_name 
    FROM information_schema.schemata 
    WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
    ORDER BY schema_name
  `;
  return runQuery<Schema>(query);
}

export interface Table {
  table_name: string;
  table_schema: string;
}

export async function getTables(schema: string): Promise<Table[]> {
  const query = `
    SELECT table_name, table_schema
    FROM information_schema.tables
    WHERE table_schema = $1
      AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `;
  return runQuery<Table>(query, [schema]);
}
