import React, { useState, useEffect, useRef } from "react";
import { useVSCode } from "../hooks/useVSCode";
import type { AppState, SortColumn, PendingEdit } from "../types";
import DataTable from "./DataTable";
import Pagination from "./Pagination";

interface TableViewProps {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
}

function TableView({ state, setState }: TableViewProps) {
  const { postMessage } = useVSCode();
  const [searchValue, setSearchValue] = useState("");
  const [searchError, setSearchError] = useState(false);
  const [editingCell, setEditingCell] = useState<{
    rowIndex: number;
    columnName: string;
    value: any;
  } | null>(null);
  const editingCellRef = useRef<{
    rowIndex: number;
    columnName: string;
    value: any;
  } | null>(null);
   const [pendingEdits, setPendingEdits] = useState<Record<string, PendingEdit>>(
     {}
   );
   const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});

  const requestTableData = (
    page?: number,
    sorting?: SortColumn[],
    searchFilter?: string
  ) => {
    if (!state.activeSchema || !state.activeTable) return;

    postMessage({
      type: "fetchTableData",
      payload: {
        schema: state.activeSchema,
        table: state.activeTable,
        page: page ?? state.pageIndex,
        pageSize: state.pageSize,
        sorting: sorting ?? state.sorting,
        searchFilter: searchFilter ?? state.searchFilter,
      },
    });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = searchValue.trim();
    setState((prev) => ({
      ...prev,
      searchFilter: trimmed,
      pageIndex: 0,
      isRefreshing: true,
    }));
    setSearchError(false);
    requestTableData(0, state.sorting, trimmed);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchValue(e.target.value);
    if (searchError) {
      setSearchError(false);
    }
  };

  const handleRefresh = () => {
    setState((prev) => ({ ...prev, isRefreshing: true }));
    requestTableData();
  };

  const handlePageChange = (newPage: number) => {
    setState((prev) => ({
      ...prev,
      pageIndex: newPage,
      isRefreshing: true,
    }));
    requestTableData(newPage);
  };

  const handleSort = (column: string, direction: "ASC" | "DESC") => {
    const newSorting: SortColumn[] = [{ column, direction }];
    setState((prev) => ({
      ...prev,
      sorting: newSorting,
      pageIndex: 0,
      isRefreshing: true,
    }));
    requestTableData(0, newSorting);
  };

  const handleClearSort = (column: string) => {
    const newSorting = state.sorting.filter((s) => s.column !== column);
    setState((prev) => ({
      ...prev,
      sorting: newSorting,
      pageIndex: 0,
      isRefreshing: true,
    }));
    requestTableData(0, newSorting);
  };

  const handleStartEdit = (
    rowIndex: number,
    columnName: string,
    currentValue: any
  ) => {
    if (editingCellRef.current) {
      commitCurrentEdit();
    }
    const nextCell = { rowIndex, columnName, value: currentValue };
    editingCellRef.current = nextCell;
    setEditingCell(nextCell);
  };

  const handleEditChange = (newValue: any) => {
    if (editingCellRef.current) {
      editingCellRef.current = {
        ...editingCellRef.current,
        value: newValue,
      };
    }
    setEditingCell((prev) =>
      prev ? { ...prev, value: newValue } : prev
    );
  };

  const getCellKey = (rowIndex: number, columnName: string) =>
    `${rowIndex}-${columnName}`;

  const commitCurrentEdit = (): Record<string, PendingEdit> => {
    const activeEdit = editingCellRef.current;

    if (!activeEdit) {
      return pendingEdits;
    }

    const { rowIndex, columnName, value } = activeEdit;
    const key = getCellKey(rowIndex, columnName);
    const currentRow = state.tableData[rowIndex];

    if (!currentRow) {
      editingCellRef.current = null;
      setEditingCell(null);
      return pendingEdits;
    }

    const existingEdit = pendingEdits[key];
    const originalValue =
      existingEdit?.oldValue ?? currentRow[columnName];
    const normalizedOriginal =
      originalValue === null || originalValue === undefined
        ? ""
        : String(originalValue);
    const normalizedNew = value === null || value === undefined ? "" : String(value);

    let nextPending = pendingEdits;

    if (normalizedNew === normalizedOriginal) {
      if (existingEdit) {
        const { [key]: _, ...rest } = pendingEdits;
        nextPending = rest;
        setPendingEdits(rest);
        setState((prev) => ({
          ...prev,
          tableData: prev.tableData.map((row, idx) =>
            idx === rowIndex ? { ...row, [columnName]: existingEdit.oldValue } : row
          ),
        }));
      }
    } else {
      const primaryKey = existingEdit?.primaryKey ?? {
        column: "id",
        value: currentRow.id,
      };

      const updatedEntry: PendingEdit = {
        rowIndex,
        columnName,
        newValue: value,
        oldValue: existingEdit?.oldValue ?? originalValue,
        primaryKey,
      };

      nextPending = {
        ...pendingEdits,
        [key]: updatedEntry,
      };

      setPendingEdits(nextPending);
      setState((prev) => ({
        ...prev,
        tableData: prev.tableData.map((row, idx) =>
          idx === rowIndex ? { ...row, [columnName]: value } : row
        ),
      }));
    }

    editingCellRef.current = null;
    setEditingCell(null);
    return nextPending;
  };

  const handleCommitEdit = () => {
    commitCurrentEdit();
  };

  const handleCancelCurrentEdit = () => {
    editingCellRef.current = null;
    setEditingCell(null);
  };

  const handleSaveEdits = () => {
    const editsMap =
      editingCellRef.current ? commitCurrentEdit() : pendingEdits;
    const edits = Object.values(editsMap);

    if (
      edits.length === 0 ||
      !state.activeSchema ||
      !state.activeTable
    ) {
      return;
    }

    edits.forEach((edit) => {
      postMessage({
        type: "updateCell",
        schema: state.activeSchema,
        table: state.activeTable,
        rowIndex: edit.rowIndex,
        columnName: edit.columnName,
        oldValue: edit.oldValue,
        newValue: edit.newValue,
        primaryKey: edit.primaryKey,
      });
    });

    setPendingEdits({});
    editingCellRef.current = null;
    setEditingCell(null);
  };

   const handleCancelAllEdits = () => {
     const editsMap = editingCellRef.current
       ? commitCurrentEdit()
       : pendingEdits;
     const edits = Object.values(editsMap);

     if (edits.length === 0) {
       editingCellRef.current = null;
       setEditingCell(null);
       setPendingEdits({});
       return;
     }

     setState((prev) => {
       const updatedRows = prev.tableData.map((row, idx) => {
         const rowEdits = edits.filter((edit) => edit.rowIndex === idx);
         if (rowEdits.length === 0) {
           return row;
         }
         return rowEdits.reduce((acc, edit) => {
           return { ...acc, [edit.columnName]: edit.oldValue };
         }, { ...row });
       });

       return {
         ...prev,
         tableData: updatedRows,
       };
     });

     setPendingEdits({});
     editingCellRef.current = null;
     setEditingCell(null);
   };

   const handleColumnWidthChange = (columnName: string, width: number) => {
     setColumnWidths((prev) => ({
       ...prev,
       [columnName]: width,
     }));
   };

  // Listen for data errors to show search input error
  useEffect(() => {
    // This would be handled by the message listener in App.tsx
    // For now, we'll just reset on successful data load
    if (state.tableData.length > 0) {
      setSearchError(false);
    }
  }, [state.tableData]);

  const totalPages = Math.ceil(state.totalRows / state.pageSize);
  const hasPendingChanges =
    editingCellRef.current !== null ||
    Object.keys(pendingEdits).length > 0;

  return (
    <section className="main-panel">
      <div className="controls">
        <div>
          {state.activeSchema && state.activeTable && (
            <span className="badge" id="active-database">
              {state.activeSchema}.{state.activeTable}
            </span>
          )}
        </div>
        <div style={{ flex: 1, display: "flex", gap: "8px", alignItems: "center" }}>
          <form onSubmit={handleSearchSubmit} style={{ flex: 1, display: "flex", gap: "8px" }}>
            <input
              type="text"
              id="search-input"
              className={searchError ? "error" : ""}
              placeholder="Enter a SQL expression to filter results (use Ctrl+Space)"
              value={searchValue}
              onChange={handleSearchChange}
              style={{ flex: 1 }}
            />
          </form>
          <button id="refresh-data" onClick={handleRefresh} disabled={state.isRefreshing}>
            <span id="refresh-text">
              {state.isRefreshing ? "Refreshing..." : "Refresh Data"}
            </span>
          </button>
        </div>
      </div>

      <div id="table-container" className={state.tableData.length === 0 ? "placeholder" : ""}>
        {state.tableData.length === 0 ? (
          <div>Select a schema and table to view its rows.</div>
        ) : (
          <>
            <div className="table-header-info">
              {state.activeSchema && state.activeTable && (
                <h3>
                  {state.activeSchema}.{state.activeTable}
                </h3>
              )}
              <p>{state.totalRows} rows total</p>
            </div>
             <div className="table-wrapper">
               <DataTable
                 columns={state.columns}
                 data={state.tableData}
                 sorting={state.sorting}
                 onSort={handleSort}
                 onClearSort={handleClearSort}
                 editingCell={editingCell}
                 onStartEdit={handleStartEdit}
                 onEditChange={handleEditChange}
                 onCommitEdit={handleCommitEdit}
                 onCancelEdit={handleCancelCurrentEdit}
                 pendingEdits={pendingEdits}
                 columnWidths={columnWidths}
                 onColumnWidthChange={handleColumnWidthChange}
               />
             </div>
            <div className="pagination-wrapper">
              <div className="edit-controls">
                <button onClick={handleSaveEdits} disabled={!hasPendingChanges}>
                  Save
                </button>
                <button onClick={handleCancelAllEdits} disabled={!hasPendingChanges}>
                  Cancel
                </button>
              </div>
              <Pagination
                currentPage={state.pageIndex}
                totalPages={totalPages}
                onPageChange={handlePageChange}
              />
            </div>
          </>
        )}
      </div>
    </section>
  );
}

export default TableView;
