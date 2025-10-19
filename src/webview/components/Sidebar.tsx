import React from "react";

interface SidebarProps {
  schemas: string[];
  tables: string[];
  activeSchema: string | null;
  activeTable: string | null;
  schemasCollapsed: boolean;
  tablesCollapsed: boolean;
  onSchemaSelect: (schema: string) => void;
  onTableSelect: (table: string) => void;
  onToggleSchemas: () => void;
  onToggleTables: () => void;
}

function Sidebar({
  schemas,
  tables,
  activeSchema,
  activeTable,
  schemasCollapsed,
  tablesCollapsed,
  onSchemaSelect,
  onTableSelect,
  onToggleSchemas,
  onToggleTables,
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <section id="schemas-section" className={schemasCollapsed ? "collapsed" : ""}>
        <div className="sidebar-header" onClick={onToggleSchemas}>
          <h3>Schemas</h3>
          <span className={`collapse-icon ${schemasCollapsed ? "collapsed" : ""}`}>
            ▼
          </span>
        </div>
        <div id="schemas" className={`schema-list ${schemasCollapsed ? "collapsed" : ""}`}>
          {schemas.map((schema) => (
            <div
              key={schema}
              className={`schema-item ${schema === activeSchema ? "active" : ""}`}
              data-schema={encodeURIComponent(schema)}
              onClick={() => onSchemaSelect(schema)}
            >
              {schema}
            </div>
          ))}
        </div>
      </section>

      <section id="tables-section" className={tablesCollapsed ? "collapsed" : ""}>
        <div className="sidebar-header" onClick={onToggleTables}>
          <h3>Tables</h3>
          <span className={`collapse-icon ${tablesCollapsed ? "collapsed" : ""}`}>
            ▼
          </span>
        </div>
        <div id="tables" className={`table-list ${tablesCollapsed ? "collapsed" : ""}`}>
          {tables.map((table) => (
            <div
              key={table}
              className={`table-item ${table === activeTable ? "active" : ""}`}
              data-table={encodeURIComponent(table)}
              onClick={() => onTableSelect(table)}
            >
              {table}
            </div>
          ))}
        </div>
      </section>
    </aside>
  );
}

export default Sidebar;

