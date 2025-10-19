import React, { useEffect, useRef } from "react";

interface SortMenuProps {
  column: string;
  position: { x: number; y: number };
  onSort: (column: string, direction: "ASC" | "DESC") => void;
  onClearSort: (column: string) => void;
  onClose: () => void;
}

function SortMenu({ column, position, onSort, onClearSort, onClose }: SortMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  const handleSort = (direction: "ASC" | "DESC") => {
    onSort(column, direction);
    onClose();
  };

  const handleClear = () => {
    onClearSort(column);
    onClose();
  };

  return (
    <div
      ref={menuRef}
      className="sort-menu"
      style={{
        position: "fixed",
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
    >
      <div className="sort-menu-item" onClick={() => handleSort("ASC")}>
        Sort Ascending
      </div>
      <div className="sort-menu-item" onClick={() => handleSort("DESC")}>
        Sort Descending
      </div>
      <div className="sort-menu-item" onClick={handleClear}>
        Clear Sort
      </div>
    </div>
  );
}

export default SortMenu;

