#!/usr/bin/env node

const { Client } = require("pg");

async function main() {
  const config = {
    host: process.env.PGHOST,
    port: Number(process.env.PGPORT || 5432),
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    connectionTimeoutMillis: Number(
      process.env.PGCONNECT_TIMEOUT || 10000
    ),
  };

  if (!config.host || !config.database || !config.user || !config.password) {
    console.error(
      "Missing connection details. Please set PGHOST, PGDATABASE, PGUSER, and PGPASSWORD environment variables."
    );
    process.exit(1);
  }

  const hostLower = config.host.toLowerCase();
  const shouldUseSSL = !["localhost", "127.0.0.1", "::1"].includes(hostLower);

  if (shouldUseSSL) {
    config.ssl = { rejectUnauthorized: false };
  }

  const client = new Client(config);

  try {
    console.log(
      `Connecting to ${config.user}@${config.host}:${config.port}/${config.database} (SSL=${shouldUseSSL}, timeout=${config.connectionTimeoutMillis}ms)`
    );
    await client.connect();
    console.log("Connection successful.");

    const schemaQuery = `
      SELECT schema_name
      FROM information_schema.schemata
      WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
      ORDER BY schema_name
    `;

    const { rows } = await client.query(schemaQuery);
    const schemaNames = rows.map((row) => row.schema_name);
    console.log("Schemas:", schemaNames.length ? schemaNames.join(", ") : "(none)");
  } catch (error) {
    console.error("Connection failed:", error.message);
    process.exitCode = 2;
  } finally {
    await client.end().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error("Unexpected error:", error);
  process.exit(1);
});
