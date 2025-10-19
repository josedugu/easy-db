import React, { useState, useEffect } from "react";
import { useVSCode, useMessageListener } from "./hooks/useVSCode";
import ConnectionPage from "./components/ConnectionPage";
import DataPage from "./components/DataPage";
import type { AppState, SavedConnection } from "./types";

type Tab = "connection" | "data";

function App() {
  const { postMessage } = useVSCode();
  const [activeTab, setActiveTab] = useState<Tab>("connection");
  const [hasAutoSwitched, setHasAutoSwitched] = useState(false);
  const [state, setState] = useState<AppState>({
    isConnected: false,
    isConnecting: false,
    lastError: null,
    errorDetail: null,
    activeSchema: null,
    activeTable: null,
    schemas: [],
    tables: [],
    columns: [],
    tableData: [],
    totalRows: 0,
    pageIndex: 0,
    pageSize: 100,
    schemasCollapsed: false,
    tablesCollapsed: false,
    isRefreshing: false,
    savedConnections: [],
    activeConnectionId: null,
    connectedConnectionId: null,
    editingConnectionId: null,
    isNewConnection: false,
    sorting: [],
    searchFilter: "",
  });

  // Handle messages from VS Code
  useMessageListener((event) => {
    const message = event.data;
    
    switch (message.type) {
      case "connecting":
        setState((prev) => ({
          ...prev,
          isConnecting: true,
          lastError: null,
        }));
        break;

      case "connectionSuccess":
        setState((prev) => ({
          ...prev,
          isConnected: true,
          isConnecting: false,
          lastError: null,
          errorDetail: null,
          connectedConnectionId: prev.activeConnectionId,
        }));
        break;

      case "connectionError":
        setState((prev) => ({
          ...prev,
          isConnected: false,
          isConnecting: false,
          lastError: message.payload.message,
          errorDetail: message.payload.detail,
        }));
        break;

      case "connectionCancelled":
        setState((prev) => ({
          ...prev,
          isConnecting: false,
        }));
        break;

      case "disconnected":
        setState((prev) => ({
          ...prev,
          isConnected: false,
          isConnecting: false,
          connectedConnectionId: null,
          lastError: null,
          schemas: [],
          tables: [],
          columns: [],
          tableData: [],
          activeSchema: null,
          activeTable: null,
        }));
        break;

      case "schemas":
        setState((prev) => ({
          ...prev,
          schemas: message.payload.schemas.map((s: any) => s.schema_name || s),
        }));
        break;

      case "tables":
        setState((prev) => ({
          ...prev,
          tables: message.payload.tables.map((t: any) => t.table_name || t),
        }));
        break;

      case "tableData":
        setState((prev) => ({
          ...prev,
          columns: message.payload.columns,
          tableData: message.payload.rows,
          totalRows: message.payload.totalCount,
          pageIndex: message.payload.page,
          pageSize: message.payload.pageSize,
          isRefreshing: false,
        }));
        break;

      case "dataError":
        setState((prev) => ({
          ...prev,
          isRefreshing: false,
          tableData: [],
          columns: [],
        }));
        break;

      case "cellUpdated":
        // Cell was successfully updated in the database
        // The optimistic update was already done in TableView
        break;

      case "cellUpdateError":
        // Revert the optimistic update by refreshing the data
        // Optionally show an error notification to the user
        break;

      case "connectionsLoaded":
        setState((prev) => ({
          ...prev,
          savedConnections: message.payload.connections,
        }));
        break;

      case "initialState":
        if (message.payload.activeConnectionId) {
          setState((prev) => ({
            ...prev,
            activeConnectionId: message.payload.activeConnectionId,
          }));
        }
        break;

      case "connectionSaved":
        setState((prev) => ({
          ...prev,
          savedConnections: [...prev.savedConnections, message.payload.connection],
          activeConnectionId: message.payload.connection.id,
          editingConnectionId: null,
          isNewConnection: false,
        }));
        break;

      case "connectionUpdated":
        setState((prev) => ({
          ...prev,
          savedConnections: prev.savedConnections.map((conn) =>
            conn.id === message.payload.connection.id
              ? message.payload.connection
              : conn
          ),
          editingConnectionId: null,
        }));
        break;

      case "connectionDeleted":
        setState((prev) => {
          const deletedId = message.payload.connectionId || message.payload.id;
          const newConnections = prev.savedConnections.filter(
            (conn) => conn.id !== deletedId
          );
          return {
            ...prev,
            savedConnections: newConnections,
            activeConnectionId:
              prev.activeConnectionId === deletedId
                ? newConnections[0]?.id || null
                : prev.activeConnectionId,
          };
        });
        break;

      default:
        break;
    }
  });

  // Send ready message on mount
  useEffect(() => {
    postMessage({ type: "ready" });
  }, []);

  // Auto-switch to data tab when connected (only once per connection)
  useEffect(() => {
    if (state.isConnected && activeTab === "connection" && !hasAutoSwitched) {
      setActiveTab("data");
      setHasAutoSwitched(true);
    }
  }, [state.isConnected, activeTab, hasAutoSwitched]);

  // Reset auto-switch flag when disconnected
  useEffect(() => {
    if (!state.isConnected) {
      setHasAutoSwitched(false);
    }
  }, [state.isConnected]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
      <header>
        <div className="tabs">
          <button
            className={activeTab === "connection" ? "active" : ""}
            onClick={() => setActiveTab("connection")}
          >
            Connection
          </button>
          <button
            className={activeTab === "data" ? "active" : ""}
            onClick={() => setActiveTab("data")}
            disabled={!state.isConnected}
          >
            Data
          </button>
        </div>
      </header>
      <div className="content">
        {activeTab === "connection" ? (
          <ConnectionPage state={state} setState={setState} />
        ) : activeTab === "data" ? (
          <DataPage state={state} setState={setState} />
        ) : null}
      </div>
    </div>
  );
}

export default App;

