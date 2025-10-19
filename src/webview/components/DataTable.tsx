import React, { useState, useRef, useEffect } from "react";
import type { TableColumn, SortColumn } from "../types";
import SortMenu from "./SortMenu";

interface PendingEditEntry {
  rowIndex: number;
  columnName: string;
  newValue: any;
  oldValue: any;
}

interface DataTableProps {
  columns: TableColumn[];
  data: any[];
  sorting: SortColumn[];
  onSort: (column: string, direction: "ASC" | "DESC") => void;
  onClearSort: (column: string) => void;
  editingCell: { rowIndex: number; columnName: string; value: any } | null;
  onStartEdit: (rowIndex: number, columnName: string, currentValue: any) => void;
  onEditChange: (newValue: any) => void;
  onCommitEdit: () => void;
  onCancelEdit: () => void;
  pendingEdits: Record<string, PendingEditEntry>;
  columnWidths: Record<string, number>;
  onColumnWidthChange: (columnName: string, width: number) => void;
}

function DataTable({
  columns,
  data,
  sorting,
  onSort,
  onClearSort,
  editingCell,
  onStartEdit,
  onEditChange,
  onCommitEdit,
  onCancelEdit,
  pendingEdits,
  columnWidths,
  onColumnWidthChange,
}: DataTableProps) {
  const [sortMenuColumn, setSortMenuColumn] = useState<string | null>(null);
  const [sortMenuPosition, setSortMenuPosition] = useState<{ x: number; y: number } | null>(
    null
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const hasSelectedRef = useRef(false);
  const tableRef = useRef<HTMLTableElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const resizingColumn = useRef<string | null>(null);
  const resizeStartX = useRef<number>(0);
  const resizeStartWidth = useRef<number>(0);

  // Focus input when editing starts (only once)
  useEffect(() => {
    if (editingCell && inputRef.current && !hasSelectedRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
      hasSelectedRef.current = true;
    } else if (!editingCell) {
      hasSelectedRef.current = false;
    }
  }, [editingCell]);

  const handleCellDoubleClick = (rowIndex: number, columnName: string, currentValue: any) => {
    onStartEdit(rowIndex, columnName, currentValue);
  };

   const handleHeaderClick = (columnName: string, event: React.MouseEvent) => {
     const header = event.currentTarget as HTMLTableHeaderCellElement;
     const rect = header.getBoundingClientRect();
     const distanceFromRight = rect.right - event.clientX;

     if (distanceFromRight < 8) {
       event.preventDefault();
       return;
     }

     setSortMenuColumn(columnName);
     setSortMenuPosition({ x: event.clientX, y: event.clientY });
   };

  const handleCloseSortMenu = () => {
    setSortMenuColumn(null);
    setSortMenuPosition(null);
  };

  const getSortIcon = (columnName: string): string => {
    const sort = sorting.find((s) => s.column === columnName);
    if (!sort) return "";
    return sort.direction === "ASC" ? " ↑" : " ↓";
  };

  const formatValue = (value: any): string => {
    if (value === null) return "[NULL]";
    if (value === undefined) return "";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  };

  const handleHeaderMouseMove = (e: React.MouseEvent<HTMLTableHeaderCellElement>) => {
    const header = e.currentTarget;
    const rect = header.getBoundingClientRect();
    const distanceFromRight = rect.right - e.clientX;
    
    if (distanceFromRight < 8) {
      header.style.cursor = "col-resize";
    } else {
      header.style.cursor = "pointer";
    }
  };



   const handleHeaderMouseDown = (e: React.MouseEvent<HTMLTableHeaderCellElement>) => {
     const header = e.currentTarget;
     const rect = header.getBoundingClientRect();
     const distanceFromRight = rect.right - e.clientX;

     if (distanceFromRight < 8 && e.buttons === 1) {
       e.preventDefault();
       const columnName = header.dataset.column;
       if (!columnName) return;

       resizingColumn.current = columnName;
       resizeStartX.current = e.clientX;
       resizeStartWidth.current = columnWidths[columnName] || 150;
     }
   };

    useEffect(() => {
      const handleMouseMove = (e: MouseEvent) => {
        if (!resizingColumn.current) return;

        const deltaX = e.clientX - resizeStartX.current;
        const newWidth = Math.max(50, resizeStartWidth.current + deltaX);
        
        onColumnWidthChange(resizingColumn.current, newWidth);
      };

      const handleMouseUp = () => {
        resizingColumn.current = null;
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);

      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }, [onColumnWidthChange]);

  return (
    <>
      <table ref={tableRef} style={{ tableLayout: "fixed" }}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.column_name}
                className="sortable-header"
                data-column={col.column_name}
                onClick={(e) => handleHeaderClick(col.column_name, e)}
                onMouseMove={handleHeaderMouseMove}
                onMouseDown={handleHeaderMouseDown}
                style={{
                   width: columnWidths[col.column_name]
                     ? `${columnWidths[col.column_name]}px`
                     : "150px",
                 }}
              >
                {col.column_name}
                {getSortIcon(col.column_name)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {columns.map((col) => {
                const cellKey = `${rowIndex}-${col.column_name}`;
                const pendingEdit = pendingEdits[cellKey];
                const isEditing =
                  editingCell?.rowIndex === rowIndex &&
                  editingCell?.columnName === col.column_name;
                const displayValue =
                  pendingEdit && !isEditing
                    ? pendingEdit.newValue
                    : row[col.column_name];

                return (
                  <td
                    key={col.column_name}
                    className={`editable ${isEditing ? "editing" : ""} ${
                      pendingEdit && !isEditing ? "pending" : ""
                    }`}
                    onDoubleClick={() =>
                      !isEditing &&
                      handleCellDoubleClick(rowIndex, col.column_name, displayValue)
                    }
                  >
                    {isEditing ? (
                      <input
                        ref={inputRef}
                        type="text"
                        value={editingCell?.value !== null && editingCell?.value !== undefined ? String(editingCell.value) : ""}
                        onChange={(e) => onEditChange(e.target.value)}
                        onBlur={onCommitEdit}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            onCommitEdit();
                          }
                          if (event.key === "Escape") {
                            event.preventDefault();
                            onCancelEdit();
                          }
                        }}
                        aria-label={`Edit ${col.column_name}`}
                      />
                    ) : (
                      formatValue(displayValue)
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Sort Menu */}
      {sortMenuColumn && sortMenuPosition && (
        <SortMenu
          column={sortMenuColumn}
          position={sortMenuPosition}
          onSort={onSort}
          onClearSort={onClearSort}
          onClose={handleCloseSortMenu}
        />
      )}
    </>
  );
}

export default DataTable;
