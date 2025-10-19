import React from "react";
import type { SavedConnection } from "../types";

interface ConnectionSidebarProps {
  connections: SavedConnection[];
  activeConnectionId: string | null;
  connectedConnectionId: string | null;
  onNew: () => void;
  onSelect: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

function ConnectionSidebar({
  connections,
  activeConnectionId,
  connectedConnectionId,
  onNew,
  onSelect,
  onEdit,
  onDelete,
}: ConnectionSidebarProps) {
  return (
    <div className="connections-sidebar">
      <h3>Saved Connections</h3>
      <button className="primary new-connection-btn" onClick={onNew}>
        + New Connection
      </button>
      <div className="connections-list">
        {connections.map((conn) => {
          const isActive = conn.id === activeConnectionId;
          const isConnected = conn.id === connectedConnectionId;

          return (
            <div
              key={conn.id}
              className={`connection-item ${isActive ? "active" : ""}`}
              onClick={(e) => {
                if (!(e.target as HTMLElement).closest("button")) {
                  onSelect(conn.id);
                }
              }}
            >
              <div className="connection-item-header">
                <div className="connection-item-name">{conn.name}</div>
                <div
                  className={`connection-item-status ${
                    isConnected ? "connected" : "saved"
                  }`}
                />
              </div>
              <div className="connection-item-info">
                {conn.config.username}@{conn.config.hostname}
              </div>
              <div className="connection-item-actions">
                <button onClick={() => onSelect(conn.id)}>Select</button>
                <button onClick={() => onEdit(conn.id)}>Edit</button>
                <button onClick={() => onDelete(conn.id)}>Delete</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ConnectionSidebar;

