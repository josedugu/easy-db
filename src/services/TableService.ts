import { getConnection } from "../database/connection";
import {
  getTableColumns,
  getAllData,
  getTableRowCount,
  ColumnInfo,
  SortColumn,
  PaginationOptions,
} from "../database/queries";

export class TableService {
  async getTableColumns(
    tableName: string,
    schemaName: string
  ): Promise<ColumnInfo[]> {
    return await getTableColumns(tableName, schemaName);
  }

  async getTableData(
    tableName: string,
    schemaName: string,
    page: number,
    pageSize: number,
    sorting: SortColumn[] = [],
    searchFilter?: string
  ): Promise<{
    rows: any[];
    columns: ColumnInfo[];
    totalCount: number;
  }> {
    const offset = page * pageSize;
    const columns = await getTableColumns(tableName, schemaName);

    let data: any[];
    let totalCount: number;

    if (searchFilter) {
      const whereClause = searchFilter;
      let query = `SELECT * FROM "${schemaName}"."${tableName}" WHERE ${whereClause}`;

      if (sorting.length > 0) {
        const orderClauses = sorting.map(
          (sort) => `"${sort.column}" ${sort.direction}`
        );
        query += ` ORDER BY ${orderClauses.join(", ")}`;
      }

      query += ` LIMIT ${pageSize} OFFSET ${offset}`;

      const db = getConnection();
      const result = await db.query(query);
      data = result.rows;

      const countQuery = `SELECT COUNT(*) as count FROM "${schemaName}"."${tableName}" WHERE ${whereClause}`;
      const countResult = await db.query<{ count: string }>(countQuery);
      totalCount = Number(countResult.rows[0]?.count || 0);
    } else {
      totalCount = await getTableRowCount(tableName, schemaName);
      data = await getAllData(
        tableName,
        schemaName,
        { limit: pageSize, offset },
        sorting
      );
    }

    return {
      rows: data,
      columns,
      totalCount,
    };
  }

  async updateCell(
    schema: string,
    table: string,
    columnName: string,
    newValue: any,
    primaryKey: { column: string; value: any }
  ): Promise<void> {
    const db = getConnection();
    const query = `UPDATE "${schema}"."${table}" SET "${columnName}" = $1 WHERE "${primaryKey.column}" = $2`;
    await db.query(query, [newValue, primaryKey.value]);
  }
}

