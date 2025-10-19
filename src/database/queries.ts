import { getConnection, runQuery } from "./connection";

export interface ColumnInfo {
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
  ordinal_position: number;
}

export async function getTableColumns(
  tableName: string,
  schemaName: string
): Promise<ColumnInfo[]> {
  const query = `
    SELECT 
      column_name,
      data_type,
      is_nullable,
      column_default,
      ordinal_position
    FROM information_schema.columns
    WHERE table_schema = $1
      AND table_name = $2
    ORDER BY ordinal_position
  `;
  return runQuery<ColumnInfo>(query, [schemaName, tableName]);
}

export async function getTableRowCount(
  tableName: string,
  schemaName: string
): Promise<number> {
  const db = getConnection();
  const query = `SELECT COUNT(*) as count FROM "${schemaName}"."${tableName}"`;
  const result = await db.query<{ count: string }>(query);
  return Number(result.rows[0]?.count || 0);
}

export interface PaginationOptions {
  limit?: number;
  offset?: number;
}

export interface SortColumn {
  column: string;
  direction: "ASC" | "DESC";
}

export async function getAllData(
  tableName: string,
  schemaName: string,
  options: PaginationOptions = {},
  sorting: SortColumn[] = []
): Promise<any[]> {
  const limit = options.limit || 100;
  const offset = options.offset || 0;

  let query = `SELECT * FROM "${schemaName}"."${tableName}"`;

  // Add ORDER BY clause if sorting is specified
  if (sorting.length > 0) {
    const orderClauses = sorting.map(
      (sort) => `"${sort.column}" ${sort.direction}`
    );
    query += ` ORDER BY ${orderClauses.join(", ")}`;
  }

  query += ` LIMIT $1 OFFSET $2`;
  return runQuery(query, [limit, offset]);
}

export interface FilterCondition {
  column: string;
  operator: "=" | "!=" | ">" | "<" | ">=" | "<=" | "LIKE" | "IN";
  value: any;
}

export async function getFilteredData(
  tableName: string,
  schemaName: string,
  filters: FilterCondition[],
  options: PaginationOptions = {},
  sorting: SortColumn[] = []
): Promise<any[]> {
  const limit = options.limit || 100;
  const offset = options.offset || 0;

  if (filters.length === 0) {
    return getAllData(tableName, schemaName, options, sorting);
  }

  const clauses: string[] = [];
  const values: any[] = [];

  filters.forEach((filter) => {
    if (filter.operator === "LIKE") {
      values.push(`%${filter.value}%`);
      clauses.push(`"${filter.column}" LIKE $${values.length}`);
    } else if (filter.operator === "IN") {
      if (!Array.isArray(filter.value) || filter.value.length === 0) {
        clauses.push("FALSE");
        return;
      }
      const startIndex = values.length + 1;
      const placeholders = filter.value
        .map((_, idx) => `$${startIndex + idx}`)
        .join(", ");
      clauses.push(`"${filter.column}" IN (${placeholders})`);
      filter.value.forEach((val: any) => values.push(val));
    } else {
      values.push(filter.value);
      clauses.push(`"${filter.column}" ${filter.operator} $${values.length}`);
    }
  });

  if (clauses.length === 0) {
    return getAllData(tableName, schemaName, options, sorting);
  }

  values.push(limit);
  values.push(offset);

  let query = `
    SELECT * 
    FROM "${schemaName}"."${tableName}"
    WHERE ${clauses.join(" AND ")}`;

  // Add ORDER BY clause if sorting is specified
  if (sorting.length > 0) {
    const orderClauses = sorting.map(
      (sort) => `"${sort.column}" ${sort.direction}`
    );
    query += `
    ORDER BY ${orderClauses.join(", ")}`;
  }

  query += `
    LIMIT $${values.length - 1}
    OFFSET $${values.length}
  `;

  return runQuery(query, values);
}

export async function insertRow(
  tableName: string,
  schemaName: string,
  data: Record<string, any>
): Promise<any> {
  const db = getConnection();

  const columns = Object.keys(data);
  const values = Object.values(data);

  if (columns.length === 0) {
    throw new Error("No data provided for insert operation.");
  }

  const placeholders = values.map((_, i) => `$${i + 1}`).join(", ");
  const columnNames = columns.map((c) => `"${c}"`).join(", ");

  const query = `
    INSERT INTO "${schemaName}"."${tableName}" 
    (${columnNames})
    VALUES (${placeholders})
    RETURNING *
  `;

  const result = await db.query(query, values);
  return result.rows[0];
}

export async function executeCustomQuery(queryString: string): Promise<{
  rows: any[];
  rowCount: number;
  command: string;
}> {
  const db = getConnection();

  try {
    const result = await db.query(queryString);

    // Determine query type
    const command =
      queryString.trim().split(/\s+/)[0]?.toUpperCase() || "UNKNOWN";

    return {
      rows: result.rows,
      rowCount: result.rowCount ?? 0,
      command,
    };
  } catch (error: any) {
    throw new Error("Query execution failed");
  }
}
