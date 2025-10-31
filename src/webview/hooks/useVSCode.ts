import { useEffect, useRef } from "react";
import type { VSCodeAPI, Message, SavedConnection } from "../types";
import { browserStorage } from "../utils/browserStorage";

let vscode: VSCodeAPI | null = null;

// Mock VSCode API for browser development with localStorage persistence
const createMockVSCodeAPI = (): VSCodeAPI => {
  // Simulated message handler for browser mode
  const handleMessage = (message: Message) => {
    switch (message.type) {
      case "ready":
        // Send back saved connections from localStorage
        setTimeout(() => {
          const connections = browserStorage.getConnections();
          const lastUsedId = browserStorage.getLastUsedConnectionId();

          window.dispatchEvent(
            new MessageEvent("message", {
              data: {
                type: "connectionsLoaded",
                payload: { connections },
              },
            })
          );

          if (lastUsedId) {
            window.dispatchEvent(
              new MessageEvent("message", {
                data: {
                  type: "initialState",
                  payload: { activeConnectionId: lastUsedId },
                },
              })
            );
          }
        }, 100);
        break;

      case "saveConnection":
        const newConnection = message.payload as SavedConnection;
        browserStorage.saveConnection(newConnection);
        browserStorage.setLastUsedConnectionId(newConnection.id);

        window.dispatchEvent(
          new MessageEvent("message", {
            data: {
              type: "connectionSaved",
              payload: { connection: newConnection },
            },
          })
        );
        break;

      case "updateConnection":
        const { id, ...updates } = message.payload as any;
        browserStorage.updateConnection(id, updates);

        const updatedConnections = browserStorage.getConnections();
        const updatedConnection = updatedConnections.find((c) => c.id === id);

        if (updatedConnection) {
          window.dispatchEvent(
            new MessageEvent("message", {
              data: {
                type: "connectionUpdated",
                payload: { connection: updatedConnection },
              },
            })
          );
        }
        break;

      case "deleteConnection":
        const deleteId = message.payload.id;
        browserStorage.deleteConnection(deleteId);

        window.dispatchEvent(
          new MessageEvent("message", {
            data: {
              type: "connectionDeleted",
              payload: { id: deleteId },
            },
          })
        );
        break;

      default:
        // For other messages, just log them
        break;
    }
  };

  return {
    postMessage: handleMessage,
    getState: () => {
      return null;
    },
    setState: (state: any) => {},
  };
};

export function getVSCode(): VSCodeAPI {
  if (!vscode) {
    // Check if we're running in VS Code
    if (typeof window !== "undefined" && (window as any).vscode) {
      vscode = (window as any).vscode;
    } else if (
      typeof window !== "undefined" &&
      (window as any).acquireVsCodeApi
    ) {
      vscode = (window as any).acquireVsCodeApi();
    } else {
      // Use mock API for browser development
      vscode = createMockVSCodeAPI();
    }
  }
  // TypeScript assertion: vscode is guaranteed to be set at this point
  return vscode as VSCodeAPI;
}

export function useVSCode() {
  const postMessage = (message: Message) => {
    getVSCode().postMessage(message);
  };

  const useState = <T>(initialState: T) => {
    const api = getVSCode();
    const savedState = api.getState();
    return savedState !== undefined ? savedState : initialState;
  };

  const setState = (state: any) => {
    getVSCode().setState(state);
  };

  return { postMessage, useState, setState };
}

export function useMessageListener(
  callback: (event: MessageEvent) => void
): void {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      callbackRef.current(event);
    };

    window.addEventListener("message", handler);

    return () => {
      window.removeEventListener("message", handler);
    };
  }, []);
}
