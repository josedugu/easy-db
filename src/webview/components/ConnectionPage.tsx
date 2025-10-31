import React, { useState, FormEvent } from "react";
import { useVSCode } from "../hooks/useVSCode";
import type { AppState, DatabaseConfig } from "../types";
import ConnectionSidebar from "./ConnectionSidebar";
import ConnectionForm from "./ConnectionForm";

interface ConnectionPageProps {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
}

function ConnectionPage({ state, setState }: ConnectionPageProps) {
  const { postMessage } = useVSCode();

  const handleNewConnection = () => {
    setState((prev) => ({
      ...prev,
      activeConnectionId: null,
      editingConnectionId: null,
      isNewConnection: true,
      isConnected: false,
      isConnecting: false,
      lastError: null,
      errorDetail: null,
    }));
  };

  const handleSelectConnection = (id: string) => {
    setState((prev) => ({
      ...prev,
      activeConnectionId: id,
      editingConnectionId: null,
      isNewConnection: false,
    }));
  };

  const handleEditConnection = (id: string) => {
    setState((prev) => ({
      ...prev,
      activeConnectionId: id,
      editingConnectionId: id,
      isNewConnection: false,
    }));
  };

  const handleDeleteConnection = (id: string) => {
    postMessage({
      type: "deleteConnection",
      payload: { id },
    });
  };

  const handleConnect = (config: DatabaseConfig, remember: boolean, name?: string) => {
    // If a different connection is active, disconnect first
    if (state.connectedConnectionId && state.connectedConnectionId !== state.activeConnectionId) {
      postMessage({ type: "disconnect" });
    }

    setState((prev) => ({ ...prev, isConnecting: true }));

    // Handle save/update logic
    if (remember) {
      if (state.editingConnectionId) {
        // Update existing connection
        postMessage({
          type: "updateConnection",
          payload: {
            id: state.editingConnectionId,
            name: name || "Unnamed Connection",
            config,
          },
        });
      } else if (state.isNewConnection || !state.activeConnectionId) {
        // Save new connection
        postMessage({
          type: "saveConnection",
          payload: {
            name: name || "Unnamed Connection",
            config,
          },
        });
      }
    }

    // Connect
    postMessage({
      type: "connect",
      payload: {
        config,
        remember,
        activeConnectionId: state.activeConnectionId || undefined,
      },
    });
  };

  const handleDisconnect = () => {
    postMessage({ type: "disconnect" });
  };

  return (
    <div id="connection-page">
      <ConnectionSidebar
        connections={state.savedConnections}
        activeConnectionId={state.activeConnectionId}
        connectedConnectionId={state.connectedConnectionId}
        onNew={handleNewConnection}
        onSelect={handleSelectConnection}
        onEdit={handleEditConnection}
        onDelete={handleDeleteConnection}
      />
      <ConnectionForm
        state={state}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
      />
    </div>
  );
}

export default ConnectionPage;

