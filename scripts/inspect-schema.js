#!/usr/bin/env node

const { Client } = require("pg");

async function main() {
  const schema = process.argv[2] || process.env.PGSCHEMA;
  if (!schema) {
    console.error(
      "Usage: PGHOST=... PGUSER=... PGPASSWORD=... PGDATABASE=... node scripts/inspect-schema.js <schema>"
    );
    process.exit(1);
  }

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
      `Inspecting schema '${schema}' on ${config.user}@${config.host}:${config.port}/${config.database}`
    );
    await client.connect();

    const tables = await client.query(
      `
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = $1
          AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `,
      [schema]
    );

    const views = await client.query(
      `
        SELECT table_name
        FROM information_schema.views
        WHERE table_schema = $1
        ORDER BY table_name
      `,
      [schema]
    );

    const materializedViews = await client.query(
      `
        SELECT matviewname
        FROM pg_matviews
        WHERE schemaname = $1
        ORDER BY matviewname
      `,
      [schema]
    );

    const functions = await client.query(
      `
        SELECT routine_name
        FROM information_schema.routines
        WHERE specific_schema = $1
        ORDER BY routine_name
      `,
      [schema]
    );

    const sequences = await client.query(
      `
        SELECT sequence_name
        FROM information_schema.sequences
        WHERE sequence_schema = $1
        ORDER BY sequence_name
      `,
      [schema]
    );

    console.log("Tables:", tables.rows.map((r) => r.table_name));
    console.log("Views:", views.rows.map((r) => r.table_name));
    console.log(
      "Materialized Views:",
      materializedViews.rows.map((r) => r.matviewname)
    );
    console.log(
      "Functions:",
      functions.rows.map((r) => r.routine_name)
    );
    console.log(
      "Sequences:",
      sequences.rows.map((r) => r.sequence_name)
    );
  } catch (error) {
    console.error("Inspection failed:", error.message);
    process.exitCode = 2;
  } finally {
    await client.end().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error("Unexpected error:", error);
  process.exit(1);
});
