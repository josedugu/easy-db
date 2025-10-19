/**
 * Browser-only storage service for development
 * Uses localStorage to persist connections during browser dev mode
 */

import type { SavedConnection } from "../types";

const STORAGE_KEY = "easydb-dev-connections";
const LAST_USED_KEY = "easydb-dev-last-used";

export const browserStorage = {
  // Get all saved connections
  getConnections(): SavedConnection[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error("Failed to load connections from localStorage:", error);
      return [];
    }
  },

  // Save a new connection
  saveConnection(connection: SavedConnection): void {
    try {
       const connections = this.getConnections();
       connections.push(connection);
       localStorage.setItem(STORAGE_KEY, JSON.stringify(connections));
    } catch (error) {
      console.error("Failed to save connection:", error);
    }
  },

  // Update an existing connection
  updateConnection(id: string, updates: Partial<SavedConnection>): void {
    try {
      const connections = this.getConnections();
      const index = connections.findIndex((c) => c.id === id);
       if (index !== -1) {
         connections[index] = { ...connections[index], ...updates };
         localStorage.setItem(STORAGE_KEY, JSON.stringify(connections));
       }
    } catch (error) {
      console.error("Failed to update connection:", error);
    }
  },

  // Delete a connection
  deleteConnection(id: string): void {
     try {
       const connections = this.getConnections();
       const filtered = connections.filter((c) => c.id !== id);
       localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    } catch (error) {
      console.error("Failed to delete connection:", error);
    }
  },

  // Get last used connection ID
  getLastUsedConnectionId(): string | null {
    try {
      return localStorage.getItem(LAST_USED_KEY);
    } catch (error) {
      console.error("Failed to get last used connection:", error);
      return null;
    }
  },

  // Set last used connection ID
  setLastUsedConnectionId(id: string | null): void {
    try {
      if (id) {
        localStorage.setItem(LAST_USED_KEY, id);
      } else {
        localStorage.removeItem(LAST_USED_KEY);
      }
    } catch (error) {
      console.error("Failed to set last used connection:", error);
    }
  },

  // Clear all data (useful for testing)
   clear(): void {
     try {
       localStorage.removeItem(STORAGE_KEY);
       localStorage.removeItem(LAST_USED_KEY);
    } catch (error) {
      console.error("Failed to clear storage:", error);
    }
  },
};
