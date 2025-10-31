import React, { useState, useRef, useEffect } from "react";
import { format } from "sql-formatter";
import { useVSCode } from "../hooks/useVSCode";
import type { AppState, QueryTab } from "../types";
import QueryHistorySidebar from "./QueryHistorySidebar";

interface QueryPageProps {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
}

function QueryPage({ state, setState }: QueryPageProps) {
  const { postMessage } = useVSCode();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize] = useState(20);

  const activeTab = state.queryTabs.find((t) => t.id === state.activeTabId);

  // Paginate results
  const paginatedResults = state.queryResults
    ? {
        ...state.queryResults,
        rows: state.queryResults.rows.slice(
          currentPage * pageSize,
          (currentPage + 1) * pageSize
        ),
      }
    : null;

  const totalPages = state.queryResults
    ? Math.ceil(state.queryResults.rows.length / pageSize)
    : 0;

  useEffect(() => {
    if (state.queryTabs.length === 0) {
      handleNewTab();
    }
  }, []);

  const generateQueryName = () => {
    const now = new Date();
    return now.toLocaleString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit'
    }).replace(',', '');
  };

  const handleNewTab = () => {
    const newTab: QueryTab = {
      id: Date.now().toString(),
      sql: "-- Write your SQL query here\nSELECT ",
      isDirty: false,
    };

    setState((prev) => ({
      ...prev,
      queryTabs: [...prev.queryTabs, newTab],
      activeTabId: newTab.id,
      queryResults: null,
      queryError: null,
    }));
  };

  const handleCloseTab = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    setState((prev) => {
      const tabs = prev.queryTabs.filter((t) => t.id !== tabId);
      const wasActive = prev.activeTabId === tabId;
      const newActiveId = wasActive && tabs.length > 0 ? tabs[tabs.length - 1].id : prev.activeTabId;

      return {
        ...prev,
        queryTabs: tabs,
        activeTabId: tabs.length > 0 ? newActiveId : null,
      };
    });
  };

  const handleTabClick = (tabId: string) => {
    setState((prev) => ({
      ...prev,
      activeTabId: tabId,
      queryResults: null,
      queryError: null,
    }));
  };

  const handleEditorChange = (value: string | undefined) => {
    if (!activeTab) return;

    setState((prev) => ({
      ...prev,
      queryTabs: prev.queryTabs.map((t) =>
        t.id === activeTab.id ? { ...t, sql: value || "", isDirty: true } : t
      ),
    }));

    // Clear previous timeout to avoid duplicate saves
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    // Only auto-save if content is meaningful
    const trimmed = (value || "").trim();
    if (!trimmed || trimmed === "-- Write your SQL query here" || trimmed.startsWith("SELECT\n")) {
      return;
    }

    autoSaveTimeoutRef.current = setTimeout(() => {
      handleAutoSave(value || "");
    }, 3000); // Increased to 3 seconds
  };

  const handleAutoSave = (sql: string) => {
    if (!sql.trim() || sql === "-- Write your SQL query here\nSELECT ") return;

    const query = {
      id: Date.now().toString(),
      name: generateQueryName(),
      sql,
      createdAt: new Date().toISOString(),
    };

    postMessage({ type: "saveQuery", payload: { query } });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleExecute();
    }

    // Tab support
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = e.currentTarget.selectionStart;
      const end = e.currentTarget.selectionEnd;
      const value = e.currentTarget.value;
      const newValue = value.substring(0, start) + '  ' + value.substring(end);
      
      if (activeTab) {
        setState((prev) => ({
          ...prev,
          queryTabs: prev.queryTabs.map((t) =>
            t.id === activeTab.id ? { ...t, sql: newValue } : t
          ),
        }));
        
        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.selectionStart = start + 2;
            textareaRef.current.selectionEnd = start + 2;
          }
        }, 0);
      }
    }
  };

  const handleExecute = () => {
    if (!state.isConnected) {
      alert("Please connect to a database first");
      return;
    }

    if (!activeTab) return;

    const textarea = textareaRef.current;
    const selectedText = textarea?.value.substring(
      textarea.selectionStart,
      textarea.selectionEnd
    );
    const queryToExecute = selectedText?.trim() || activeTab.sql.trim();

    if (!queryToExecute) return;

    setCurrentPage(0); // Reset to first page

    setState((prev) => ({
      ...prev,
      isExecutingQuery: true,
      queryError: null,
      queryResults: null,
    }));

    postMessage({
      type: "executeQuery",
      payload: { sql: queryToExecute },
    });
  };

  const handlePreviousPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages - 1) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handleFirstPage = () => {
    setCurrentPage(0);
  };

  const handleLastPage = () => {
    setCurrentPage(totalPages - 1);
  };

  const handleFormat = () => {
    if (!activeTab) return;

    try {
      const formatted = format(activeTab.sql, {
        language: "postgresql",
        tabWidth: 2,
        keywordCase: "upper",
      });

      setState((prev) => ({
        ...prev,
        queryTabs: prev.queryTabs.map((t) =>
          t.id === activeTab.id ? { ...t, sql: formatted } : t
        ),
      }));
    } catch (error) {
      console.error("Format error:", error);
    }
  };

  const handleSelectQuery = (sql: string) => {
    if (!activeTab) {
      handleNewTab();
    }

    setState((prev) => ({
      ...prev,
      queryTabs: prev.queryTabs.map((t) =>
        t.id === prev.activeTabId ? { ...t, sql, isDirty: false } : t
      ),
      queryResults: null,
      queryError: null,
    }));
  };

  const handleDeleteQuery = (id: string) => {
    console.log("[QP] Deleting query:", id);
    
    // If the deleted query matches any open tab's SQL, close that tab
    setState((prev) => {
      const deletedQuery = prev.savedQueries.find((q) => q.id === id);
      if (!deletedQuery) return prev;

      const tabsToClose = prev.queryTabs.filter((t) => t.sql === deletedQuery.sql);
      
      if (tabsToClose.length > 0) {
        const remainingTabs = prev.queryTabs.filter((t) => t.sql !== deletedQuery.sql);
        const wasActive = tabsToClose.some((t) => t.id === prev.activeTabId);
        
        return {
          ...prev,
          queryTabs: remainingTabs.length > 0 ? remainingTabs : prev.queryTabs,
          activeTabId: wasActive && remainingTabs.length > 0 
            ? remainingTabs[remainingTabs.length - 1].id 
            : prev.activeTabId,
        };
      }
      
      return prev;
    });

    postMessage({ type: "deleteQuery", payload: { id } });
  };

  return (
    <div className={`query-page-multi ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      {!sidebarCollapsed && (
        <QueryHistorySidebar
          queries={state.savedQueries}
          onSelectQuery={handleSelectQuery}
          onDeleteQuery={handleDeleteQuery}
        />
      )}

      <div className="query-main-multi">
        <div className="query-tabs-bar">
          <button
            className="sidebar-toggle-btn"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            title={sidebarCollapsed ? "Show History" : "Hide History"}
          >
            {sidebarCollapsed ? "▶" : "◀"}
          </button>
          {state.queryTabs.map((tab, index) => (
            <div
              key={tab.id}
              className={`query-tab ${tab.id === state.activeTabId ? "active" : ""}`}
              onClick={() => handleTabClick(tab.id)}
            >
              <span className="query-tab-name">Query {index + 1}</span>
              {state.queryTabs.length > 1 && (
                <button
                  className="query-tab-close"
                  onClick={(e) => handleCloseTab(tab.id, e)}
                >
                  ×
                </button>
              )}
            </div>
          ))}
          <button className="query-tab-new" onClick={handleNewTab} title="New Query Tab">
            +
          </button>
        </div>

        <div className="query-editor-container">
          <div className="query-editor-wrapper">
            <textarea
              ref={textareaRef}
              className="query-textarea"
              value={activeTab?.sql || ""}
              onChange={(e) => handleEditorChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="-- Write your SQL query here
SELECT * FROM your_table
WHERE condition = 'value'
LIMIT 100;"
              spellCheck={false}
            />
          </div>

          <div className="query-actions-compact">
            <button
              className="btn-execute-compact"
              onClick={handleExecute}
              disabled={state.isExecutingQuery || !state.isConnected}
            >
              ▶
            </button>
            <button className="btn-format-compact" onClick={handleFormat}>
              Format
            </button>
            {state.queryResults && (
              <span className="query-stats-compact">
                {state.queryResults.rowCount} rows ({state.queryResults.executionTime}ms)
              </span>
            )}
          </div>
        </div>

        <div className="query-results-section">
          {state.queryError && (
            <div className="query-error">
              <strong>Error:</strong> {state.queryError}
            </div>
          )}

          {paginatedResults && paginatedResults.rows.length > 0 && (
            <>
              <div className="query-results">
                <div className="results-table-wrapper">
                  <table className="results-table">
                    <thead>
                      <tr>
                        {Object.keys(state.queryResults!.rows[0]).map((col) => (
                          <th key={col}>{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedResults.rows.map((row, idx) => (
                        <tr key={idx}>
                          {Object.values(row).map((val: any, colIdx) => (
                            <td key={colIdx}>
                              {val === null
                                ? "NULL"
                                : typeof val === "object"
                                ? JSON.stringify(val)
                                : String(val)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              
              {state.queryResults && state.queryResults.rows.length > 0 && (
                <div className="results-pagination">
                  <button
                    className="pagination-btn"
                    onClick={handleFirstPage}
                    disabled={currentPage === 0}
                    title="First page"
                  >
                    «
                  </button>
                  <button
                    className="pagination-btn"
                    onClick={handlePreviousPage}
                    disabled={currentPage === 0}
                    title="Previous page"
                  >
                    ‹
                  </button>
                  <span className="pagination-info">
                    Page {currentPage + 1} of {totalPages} 
                    <span className="pagination-total"> • {state.queryResults.rowCount} rows</span>
                  </span>
                  <button
                    className="pagination-btn"
                    onClick={handleNextPage}
                    disabled={currentPage >= totalPages - 1}
                    title="Next page"
                  >
                    ›
                  </button>
                  <button
                    className="pagination-btn"
                    onClick={handleLastPage}
                    disabled={currentPage >= totalPages - 1}
                    title="Last page"
                  >
                    »
                  </button>
                </div>
              )}
            </>
          )}

          {state.queryResults && state.queryResults.rows.length === 0 && (
            <div className="query-empty-result">
              Query executed successfully. No rows returned.
            </div>
          )}

          {!state.queryResults && !state.queryError && !state.isExecutingQuery && (
            <div className="query-placeholder">
              Write a SQL query and press Ctrl+Enter to execute
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default QueryPage;
