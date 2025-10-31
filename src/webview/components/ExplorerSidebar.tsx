import React, { useMemo } from "react";
import type { SavedConnection, SchemaResources } from "../types";
import {
  connectionNodeId,
  schemaNodeId,
  categoryNodeId,
  itemNodeId,
} from "../utils/explorerIds";

export type ExplorerCategory = keyof SchemaResources;

export type ExplorerNodeContext =
  | { kind: "connection"; connectionId: string }
  | { kind: "schema"; connectionId: string; schema: string }
  | {
      kind: "category";
      connectionId: string;
      schema: string;
      category: ExplorerCategory;
    }
  | {
      kind: "item";
      connectionId: string;
      schema: string;
      category: ExplorerCategory;
      name: string;
    };

interface ExplorerSidebarProps {
  connections: SavedConnection[];
  activeConnectionId: string | null;
  connectedConnectionId: string | null;
  schemas: string[];
  schemaResources: Record<string, SchemaResources>;
  expandedNodes: string[];
  loadingNodes: string[];
  selectedNodeId: string | null;
  onToggleNode: (nodeId: string, context: ExplorerNodeContext) => void;
  onSelectNode: (nodeId: string, context: ExplorerNodeContext) => void;
  activeSchema: string | null;
  activeTable: string | null;
}

const CATEGORY_LABELS: Record<ExplorerCategory, string> = {
  tables: "Tables",
  views: "Views",
  materializedViews: "Materialized Views",
  functions: "Functions",
  sequences: "Sequences",
};

const depthStyle = (depth: number): React.CSSProperties => ({
  "--depth": depth,
} as React.CSSProperties);

function ExplorerSidebar({
  connections,
  activeConnectionId,
  connectedConnectionId,
  schemas,
  schemaResources,
  expandedNodes,
  loadingNodes,
  selectedNodeId,
  onToggleNode,
  onSelectNode,
  activeSchema,
  activeTable,
}: ExplorerSidebarProps) {
  const expandedSet = useMemo(() => new Set(expandedNodes), [expandedNodes]);
  const loadingSet = useMemo(() => new Set(loadingNodes), [loadingNodes]);

  const renderCategoryChildren = (
    connectionId: string,
    schema: string,
    category: ExplorerCategory,
    depth: number
  ) => {
    const nodeId = categoryNodeId(connectionId, schema, category);
    const isExpanded = expandedSet.has(nodeId);
    const isLoading = loadingSet.has(nodeId);
    const resources = schemaResources[schema] || {};
    const items = resources[category];
    
    console.log(`[ES] render ${category}: expanded=${isExpanded}, loading=${isLoading}, items=${items?.length ?? 'undefined'}`);

    return (
      <div key={nodeId} className="explorer-node" style={depthStyle(depth)}>
        <div className="explorer-node-row">
          <button
            type="button"
            className="caret"
            onClick={() => {
              console.log(`[ES] caret clicked: ${category} in ${schema}`);
              onToggleNode(nodeId, {
                kind: "category",
                connectionId,
                schema,
                category,
              });
            }}
            aria-label={`${
              isExpanded ? "Collapse" : "Expand"
            } ${CATEGORY_LABELS[category]}`}
          >
            {isExpanded ? "▾" : "▸"}
          </button>
          <button
            type="button"
            className="label"
            onClick={() =>
              onToggleNode(nodeId, {
                kind: "category",
                connectionId,
                schema,
                category,
              })
            }
          >
            {CATEGORY_LABELS[category]}
          </button>
          {isLoading && <span className="loading-dots" aria-hidden />}
        </div>
        {isExpanded && (
          <div className="explorer-children">
            {items && items.length > 0 ? (
              items.map((item) => {
                const itemId = itemNodeId(connectionId, schema, category, item);
                const isSelected = selectedNodeId === itemId;
                const isTable =
                  category === "tables" &&
                  activeSchema === schema &&
                  activeTable === item;

                return (
                  <div
                    key={itemId}
                    className="explorer-node leaf"
                    style={depthStyle(depth + 1)}
                  >
                    <span className="caret spacer" aria-hidden>
                      •
                    </span>
                    <button
                      type="button"
                      className={`label ${
                        isSelected || isTable ? "selected" : ""
                      }`}
                      title={item}
                      onClick={() =>
                        onSelectNode(itemId, {
                          kind: "item",
                          connectionId,
                          schema,
                          category,
                          name: item,
                        })
                      }
                    >
                      {item}
                    </button>
                  </div>
                );
              })
            ) : items && items.length === 0 ? (
              <div
                className="explorer-placeholder nested"
                style={depthStyle(depth + 1)}
              >
                No {CATEGORY_LABELS[category].toLowerCase()} found.
              </div>
            ) : null}
          </div>
        )}
      </div>
    );
  };

  const renderSchema = (
    connectionId: string,
    schema: string,
    depth: number
  ) => {
    const nodeId = schemaNodeId(connectionId, schema);
    const isExpanded = expandedSet.has(nodeId);
    const isActive = activeSchema === schema;

    return (
      <div key={nodeId} className="explorer-node" style={depthStyle(depth)}>
        <div className="explorer-node-row">
          <button
            type="button"
            className="caret"
            onClick={() =>
              onToggleNode(nodeId, { kind: "schema", connectionId, schema })
            }
            aria-label={`${isExpanded ? "Collapse" : "Expand"} schema ${schema}`}
          >
            {isExpanded ? "▾" : "▸"}
          </button>
          <button
            type="button"
            className={`label ${isActive ? "selected" : ""}`}
            onClick={() =>
              onSelectNode(nodeId, { kind: "schema", connectionId, schema })
            }
          >
            {schema}
          </button>
        </div>
        {isExpanded && (
          <div className="explorer-children">
            {(Object.keys(CATEGORY_LABELS) as ExplorerCategory[]).map(
              (category) =>
                renderCategoryChildren(
                  connectionId,
                  schema,
                  category,
                  depth + 1
                )
            )}
          </div>
        )}
      </div>
    );
  };

  const renderConnection = (connection: SavedConnection) => {
    const isActive = connection.id === activeConnectionId;
    const isConnected = connection.id === connectedConnectionId;
    const nodeId = connectionNodeId(connection.id);
    const isExpanded = expandedSet.has(nodeId) && isActive;
    const displayName =
      connection.name || connection.config?.database || "Connection";

    return (
      <div
        key={connection.id}
        className={`explorer-connection ${isActive ? "active" : ""}`}
      >
        <div className="explorer-node-row connection">
          {isActive ? (
            <button
              type="button"
              className="caret"
              onClick={() =>
                onToggleNode(nodeId, {
                  kind: "connection",
                  connectionId: connection.id,
                })
              }
              aria-label={
                isExpanded ? `Collapse ${displayName}` : `Expand ${displayName}`
              }
            >
              {isExpanded ? "▾" : "▸"}
            </button>
          ) : (
            <span className="caret spacer" aria-hidden>
              ▸
            </span>
          )}
          <span className="connection-name">{displayName}</span>
          {isConnected && <span className="connection-dot" aria-hidden />}
        </div>
        {isActive && isConnected && isExpanded && (
          <div className="explorer-children connection-children">
            {schemas.length === 0 ? (
              <div className="explorer-placeholder nested">No schemas yet.</div>
            ) : (
              schemas.map((schema) => renderSchema(connection.id, schema, 1))
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside className="explorer-sidebar">
      <div className="explorer-header">Connections</div>
      <div className="explorer-tree">
        {connections.length === 0 ? (
          <div className="explorer-placeholder">No saved connections.</div>
        ) : (
          connections.map(renderConnection)
        )}
      </div>
    </aside>
  );
}

export default ExplorerSidebar;
