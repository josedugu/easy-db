import React from "react";
import type { SavedQuery } from "../types";

interface QueryHistorySidebarProps {
  queries: SavedQuery[];
  onSelectQuery: (sql: string) => void;
  onDeleteQuery: (id: string) => void;
}

function QueryHistorySidebar({
  queries,
  onSelectQuery,
  onDeleteQuery,
}: QueryHistorySidebarProps) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const sortedQueries = [...queries].sort((a, b) => {
    const dateA = new Date(a.lastExecuted || a.createdAt).getTime();
    const dateB = new Date(b.lastExecuted || b.createdAt).getTime();
    return dateB - dateA;
  });

  return (
    <aside className="query-history-sidebar-simple">
      <div className="query-history-header-simple">
        <h3>History</h3>
      </div>

      <div className="query-history-list">
        {sortedQueries.length === 0 ? (
          <div className="query-empty-simple">No query history yet.</div>
        ) : (
          sortedQueries.map((query) => (
            <div key={query.id} className="query-history-item">
              <div
                className="query-history-content"
                onClick={() => onSelectQuery(query.sql)}
              >
                <div className="query-history-name">{query.name}</div>
                <div className="query-history-preview">
                  {query.sql.slice(0, 60)}...
                </div>
                <div className="query-history-date">
                  {formatDate(query.lastExecuted || query.createdAt)}
                </div>
              </div>
              <button
                className="query-history-delete"
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`Delete "${query.name}"?`)) {
                    onDeleteQuery(query.id);
                  }
                }}
                title="Delete"
              >
                🗑️
              </button>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}

export default QueryHistorySidebar;
