import type { ConnectionString, Message } from '../types';

const STORAGE_API_URL = 'http://localhost:3001/storage';

// In-memory cache
let storageCache: {
  connections: ConnectionString[];
  messageHistory: Message[];
  selectedConnectionId: string | null;
} | null = null;

// Load storage from file-based API
async function loadStorage() {
  try {
    const response = await fetch(STORAGE_API_URL);
    if (response.ok) {
      storageCache = await response.json();
    } else {
      console.error('Failed to load storage from API');
      storageCache = { connections: [], messageHistory: [], selectedConnectionId: null };
    }
  } catch (error) {
    console.error('Error loading storage from API:', error);
    storageCache = { connections: [], messageHistory: [], selectedConnectionId: null };
  }
}

// Save storage to file-based API
async function saveStorage() {
  if (!storageCache) return;

  try {
    await fetch(STORAGE_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(storageCache)
    });
  } catch (error) {
    console.error('Error saving storage to API:', error);
  }
}

// Ensure storage is loaded
async function ensureLoaded() {
  if (!storageCache) {
    await loadStorage();
    // Try to migrate from localStorage if file storage is empty
    await migrateLegacyStorage();
  }
}

// Migrate from legacy localStorage to file-based storage
async function migrateLegacyStorage() {
  try {
    // Check if we need to migrate
    if (!storageCache ||
        (storageCache.connections.length > 0 || storageCache.messageHistory.length > 0)) {
      // Already has data, skip migration
      return;
    }

    // Try to read from localStorage
    const legacyConnections = localStorage.getItem('servicebus_connections');
    const legacyMessages = localStorage.getItem('servicebus_message_history');
    const legacySelected = localStorage.getItem('servicebus_selected_connection');

    let migrated = false;

    if (legacyConnections) {
      const connections = JSON.parse(legacyConnections);
      if (connections.length > 0) {
        storageCache.connections = connections;
        migrated = true;
        console.log(`Migrated ${connections.length} connections from localStorage`);
      }
    }

    if (legacyMessages) {
      const messages = JSON.parse(legacyMessages);
      if (messages.length > 0) {
        storageCache.messageHistory = messages;
        migrated = true;
        console.log(`Migrated ${messages.length} messages from localStorage`);
      }
    }

    if (legacySelected) {
      storageCache.selectedConnectionId = legacySelected;
      migrated = true;
    }

    if (migrated) {
      await saveStorage();
      console.log('Migration completed successfully');
    }
  } catch (error) {
    console.error('Error during migration from localStorage:', error);
  }
}

export const StorageManager = {
  // Connection String Management
  async getConnections(): Promise<ConnectionString[]> {
    await ensureLoaded();
    return storageCache?.connections || [];
  },

  async saveConnection(connection: ConnectionString): Promise<void> {
    await ensureLoaded();
    if (!storageCache) return;

    const existingIndex = storageCache.connections.findIndex(c => c.id === connection.id);

    if (existingIndex >= 0) {
      storageCache.connections[existingIndex] = connection;
    } else {
      storageCache.connections.push(connection);
    }

    await saveStorage();
  },

  async deleteConnection(id: string): Promise<void> {
    await ensureLoaded();
    if (!storageCache) return;

    storageCache.connections = storageCache.connections.filter(c => c.id !== id);
    await saveStorage();
  },

  async getSelectedConnectionId(): Promise<string | null> {
    await ensureLoaded();
    return storageCache?.selectedConnectionId || null;
  },

  async setSelectedConnectionId(id: string): Promise<void> {
    await ensureLoaded();
    if (!storageCache) return;

    storageCache.selectedConnectionId = id;
    await saveStorage();
  },

  // Message History Management
  async getMessageHistory(): Promise<Message[]> {
    await ensureLoaded();
    return storageCache?.messageHistory || [];
  },

  async getLastMessageForDestination(destination: string, destinationType: 'queue' | 'topic'): Promise<Message | undefined> {
    try {
      const history = await this.getMessageHistory();
      return history.find(
        msg => msg.destination === destination && msg.destinationType === destinationType
      );
    } catch (error) {
      console.error('Error getting last message for destination:', error);
      return undefined;
    }
  },

  async saveMessage(message: Message): Promise<void> {
    await ensureLoaded();
    if (!storageCache) return;

    storageCache.messageHistory.unshift(message); // Add to beginning

    // Keep only last 1000 messages
    storageCache.messageHistory = storageCache.messageHistory.slice(0, 1000);

    await saveStorage();
  },

  async clearMessageHistory(): Promise<void> {
    await ensureLoaded();
    if (!storageCache) return;

    storageCache.messageHistory = [];
    await saveStorage();
  },

  // Export/Import
  async exportData(): Promise<string> {
    await ensureLoaded();
    return JSON.stringify({
      connections: storageCache?.connections || [],
      messageHistory: storageCache?.messageHistory || [],
    }, null, 2);
  },

  async importData(jsonData: string): Promise<boolean> {
    try {
      const data = JSON.parse(jsonData);
      await ensureLoaded();
      if (!storageCache) return false;

      if (data.connections) {
        storageCache.connections = data.connections;
      }

      if (data.messageHistory) {
        storageCache.messageHistory = data.messageHistory;
      }

      await saveStorage();
      return true;
    } catch (error) {
      console.error('Error importing data:', error);
      return false;
    }
  },
};
