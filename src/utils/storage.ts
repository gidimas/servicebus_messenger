import type { ConnectionString, Message } from '../types';

const CONNECTIONS_KEY = 'servicebus_connections';
const MESSAGE_HISTORY_KEY = 'servicebus_message_history';
const SELECTED_CONNECTION_KEY = 'servicebus_selected_connection';

export const StorageManager = {
  // Connection String Management
  getConnections(): ConnectionString[] {
    try {
      const stored = localStorage.getItem(CONNECTIONS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error reading connections from storage:', error);
      return [];
    }
  },

  saveConnection(connection: ConnectionString): void {
    try {
      const connections = this.getConnections();
      const existingIndex = connections.findIndex(c => c.id === connection.id);

      if (existingIndex >= 0) {
        connections[existingIndex] = connection;
      } else {
        connections.push(connection);
      }

      localStorage.setItem(CONNECTIONS_KEY, JSON.stringify(connections));
    } catch (error) {
      console.error('Error saving connection to storage:', error);
    }
  },

  deleteConnection(id: string): void {
    try {
      const connections = this.getConnections();
      const filtered = connections.filter(c => c.id !== id);
      localStorage.setItem(CONNECTIONS_KEY, JSON.stringify(filtered));
    } catch (error) {
      console.error('Error deleting connection from storage:', error);
    }
  },

  getSelectedConnectionId(): string | null {
    return localStorage.getItem(SELECTED_CONNECTION_KEY);
  },

  setSelectedConnectionId(id: string): void {
    localStorage.setItem(SELECTED_CONNECTION_KEY, id);
  },

  // Message History Management
  getMessageHistory(): Message[] {
    try {
      const stored = localStorage.getItem(MESSAGE_HISTORY_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error reading message history from storage:', error);
      return [];
    }
  },

  saveMessage(message: Message): void {
    try {
      const history = this.getMessageHistory();
      history.unshift(message); // Add to beginning

      // Keep only last 1000 messages
      const trimmed = history.slice(0, 1000);

      localStorage.setItem(MESSAGE_HISTORY_KEY, JSON.stringify(trimmed));
    } catch (error) {
      console.error('Error saving message to history:', error);
    }
  },

  clearMessageHistory(): void {
    localStorage.removeItem(MESSAGE_HISTORY_KEY);
  },

  // Export/Import
  exportData(): string {
    return JSON.stringify({
      connections: this.getConnections(),
      messageHistory: this.getMessageHistory(),
    }, null, 2);
  },

  importData(jsonData: string): boolean {
    try {
      const data = JSON.parse(jsonData);

      if (data.connections) {
        localStorage.setItem(CONNECTIONS_KEY, JSON.stringify(data.connections));
      }

      if (data.messageHistory) {
        localStorage.setItem(MESSAGE_HISTORY_KEY, JSON.stringify(data.messageHistory));
      }

      return true;
    } catch (error) {
      console.error('Error importing data:', error);
      return false;
    }
  },
};
