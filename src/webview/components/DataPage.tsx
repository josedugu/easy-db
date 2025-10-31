import React from "react";
import { useVSCode } from "../hooks/useVSCode";
import type { AppState, MessageType } from "../types";
import ExplorerSidebar, {
  ExplorerCategory,
  ExplorerNodeContext,
} from "./ExplorerSidebar";
import TableView from "./TableView";

interface DataPageProps {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
}

const CATEGORY_FETCH_MESSAGE: Record<ExplorerCategory, MessageType> = {
  tables: "fetchTables",
  views: "fetchSchemaViews",
  materializedViews: "fetchSchemaMaterializedViews",
  functions: "fetchSchemaFunctions",
  sequences: "fetchSchemaSequences",
};

function DataPage({ state, setState }: DataPageProps) {
  const { postMessage } = useVSCode();

  const handleSchemaSelect = (schema: string, nodeId?: string) => {
    setState((prev) => ({
      ...prev,
      activeSchema: schema,
      activeTable: null,
      tables: [],
      tableData: [],
      columns: [],
      explorerSelectedNodeId: nodeId ?? prev.explorerSelectedNodeId,
    }));
  };

  const handleTableSelect = (schema: string, table: string, nodeId?: string) => {
    setState((prev) => ({
      ...prev,
      activeSchema: schema,
      activeTable: table,
      pageIndex: 0,
      sorting: [],
      searchFilter: "",
      isRefreshing: true,
      explorerSelectedNodeId: nodeId ?? prev.explorerSelectedNodeId,
    }));

    // Request table data
    postMessage({
      type: "fetchTableData",
      payload: {
        schema,
        table,
        page: 0,
        pageSize: state.pageSize,
        sorting: [],
        searchFilter: "",
      },
    });
  };

  const handleToggleNode = (nodeId: string, context: ExplorerNodeContext) => {
    console.log(`[DP] toggleNode: ${nodeId}, kind: ${context.kind}`);

    setState((prev) => {
      const expandedSet = new Set(prev.explorerExpandedNodes);
      const loadingSet = new Set(prev.explorerLoadingNodes);
      const wasExpanded = expandedSet.has(nodeId);

      console.log(`[DP] wasExpanded: ${wasExpanded}`);

      if (wasExpanded) {
        expandedSet.delete(nodeId);
        loadingSet.delete(nodeId);
      } else {
        expandedSet.add(nodeId);

        if (
          context.kind === "category" &&
          context.connectionId === state.connectedConnectionId
        ) {
          console.log(`[DP] category check passed`);
          const resourcesForSchema = prev.schemaResources[context.schema];
          const alreadyLoaded = !!resourcesForSchema?.[context.category];
          const isLoading =
            prev.schemaLoading[context.schema]?.[context.category] === true;

          console.log(`[DP] alreadyLoaded: ${alreadyLoaded}, isLoading: ${isLoading}`);

          if (!alreadyLoaded && !isLoading) {
            console.log(`[DP] sending ${CATEGORY_FETCH_MESSAGE[context.category]} for ${context.schema}.${context.category}`);
            
            const nextSchemaLoading = {
              ...prev.schemaLoading,
              [context.schema]: {
                ...(prev.schemaLoading[context.schema] || {}),
                [context.category]: true,
              },
            };

            loadingSet.add(nodeId);

            // Send message immediately from here
            postMessage({
              type: CATEGORY_FETCH_MESSAGE[context.category],
              payload: { schema: context.schema, connectionId: context.connectionId },
            });

            return {
              ...prev,
              explorerExpandedNodes: Array.from(expandedSet),
              explorerLoadingNodes: Array.from(loadingSet),
              schemaLoading: nextSchemaLoading,
            };
          }
        } else {
          console.log(`[DP] category check FAILED: kind=${context.kind}, ctx.connId=${context.kind === 'category' ? (context as any).connectionId : 'N/A'}, state.connId=${state.connectedConnectionId}`);
        }
      }

      return {
        ...prev,
        explorerExpandedNodes: Array.from(expandedSet),
        explorerLoadingNodes: Array.from(loadingSet),
      };
    });
  };

  const handleSelectNode = (nodeId: string, context: ExplorerNodeContext) => {
    switch (context.kind) {
      case "schema":
        if (context.connectionId === state.connectedConnectionId) {
          handleSchemaSelect(context.schema, nodeId);
        }
        break;
      case "item":
        if (context.connectionId === state.connectedConnectionId) {
          if (context.category === "tables") {
            handleTableSelect(context.schema, context.name, nodeId);
          } else {
            setState((prev) => ({
              ...prev,
              explorerSelectedNodeId: nodeId,
            }));
          }
        }
        break;
      default:
        break;
    }
  };

  return (
    <div id="data-page" className="data-page">
      <ExplorerSidebar
        connections={state.savedConnections}
        activeConnectionId={state.activeConnectionId}
        connectedConnectionId={state.connectedConnectionId}
        schemas={state.schemas}
        schemaResources={state.schemaResources}
        expandedNodes={state.explorerExpandedNodes}
        loadingNodes={state.explorerLoadingNodes}
        selectedNodeId={state.explorerSelectedNodeId}
        onToggleNode={handleToggleNode}
        onSelectNode={handleSelectNode}
        activeSchema={state.activeSchema}
        activeTable={state.activeTable}
      />
      <TableView state={state} setState={setState} />
    </div>
  );
}

export default DataPage;
