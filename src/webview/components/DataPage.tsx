import React from "react";
import { useVSCode } from "../hooks/useVSCode";
import type { AppState } from "../types";
import Sidebar from "./Sidebar";
import TableView from "./TableView";

interface DataPageProps {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
}

function DataPage({ state, setState }: DataPageProps) {
  const { postMessage } = useVSCode();

  const handleSchemaSelect = (schema: string) => {
    setState((prev) => ({
      ...prev,
      activeSchema: schema,
      activeTable: null,
      tables: [],
      tableData: [],
      columns: [],
    }));
    postMessage({
      type: "fetchTables",
      schema,
    });
  };

  const handleTableSelect = (table: string) => {
    setState((prev) => ({
      ...prev,
      activeTable: table,
      pageIndex: 0,
      sorting: [],
      searchFilter: "",
      isRefreshing: true,
    }));

    // Request table data
    postMessage({
      type: "fetchTableData",
      payload: {
        schema: state.activeSchema!,
        table,
        page: 0,
        pageSize: state.pageSize,
        sorting: [],
        searchFilter: "",
      },
    });
  };

  const handleToggleSchemas = () => {
    setState((prev) => ({
      ...prev,
      schemasCollapsed: !prev.schemasCollapsed,
    }));
  };

  const handleToggleTables = () => {
    setState((prev) => ({
      ...prev,
      tablesCollapsed: !prev.tablesCollapsed,
    }));
  };

  return (
    <div id="data-page" className="data-page">
      <Sidebar
        schemas={state.schemas}
        tables={state.tables}
        activeSchema={state.activeSchema}
        activeTable={state.activeTable}
        schemasCollapsed={state.schemasCollapsed}
        tablesCollapsed={state.tablesCollapsed}
        onSchemaSelect={handleSchemaSelect}
        onTableSelect={handleTableSelect}
        onToggleSchemas={handleToggleSchemas}
        onToggleTables={handleToggleTables}
      />
      <TableView state={state} setState={setState} />
    </div>
  );
}

export default DataPage;

