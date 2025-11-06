import { useState, useEffect, useCallback, useMemo } from 'react';
import type { ConnectionString, ConnectionStatus } from '../types';
import { StorageManager } from '../utils/storage';
import { parseConnectionString } from '../utils/sasToken';
import { ServiceBusAPI } from '../services/serviceBusApi';

export function useConnections() {
  const [connections, setConnections] = useState<ConnectionString[]>([]);
  const [selectedConnection, setSelectedConnection] = useState<ConnectionString | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    isConnected: false,
    lastChecked: 0,
  });
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load connections from storage on mount
  useEffect(() => {
    (async () => {
      const stored = await StorageManager.getConnections();
      setConnections(stored);

      const selectedId = await StorageManager.getSelectedConnectionId();
      if (selectedId) {
        const selected = stored.find(c => c.id === selectedId);
        if (selected) {
          setSelectedConnection(selected);
        }
      }

      setIsLoaded(true);
    })();
  }, []);

  // Test connection when selected connection changes
  useEffect(() => {
    if (selectedConnection) {
      testConnection(selectedConnection);
    }
  }, [selectedConnection]);

  const testConnection = useCallback(async (connection: ConnectionString) => {
    setIsTestingConnection(true);
    try {
      const api = new ServiceBusAPI(
        connection.endpoint,
        connection.keyName,
        connection.keyValue
      );

      const isConnected = await api.testConnection();

      setConnectionStatus({
        isConnected,
        lastChecked: Date.now(),
      });
    } catch (error) {
      console.error('Connection test failed:', error);
      setConnectionStatus({
        isConnected: false,
        lastChecked: Date.now(),
      });
    } finally {
      setIsTestingConnection(false);
    }
  }, []);

  const addConnection = useCallback(async (connectionString: string, name: string) => {
    const parsed = parseConnectionString(connectionString);

    if (!parsed) {
      throw new Error('Invalid connection string format');
    }

    const newConnection: ConnectionString = {
      id: Date.now().toString(),
      name,
      ...parsed,
    };

    await StorageManager.saveConnection(newConnection);
    setConnections(prev => [...prev, newConnection]);

    return newConnection;
  }, []);

  const updateConnection = useCallback(async (id: string, connectionString: string, name: string) => {
    const parsed = parseConnectionString(connectionString);

    if (!parsed) {
      throw new Error('Invalid connection string format');
    }

    const updatedConnection: ConnectionString = {
      id,
      name,
      ...parsed,
    };

    await StorageManager.saveConnection(updatedConnection);
    setConnections(prev => prev.map(c => c.id === id ? updatedConnection : c));

    if (selectedConnection?.id === id) {
      setSelectedConnection(updatedConnection);
    }
  }, [selectedConnection]);

  const deleteConnection = useCallback(async (id: string) => {
    await StorageManager.deleteConnection(id);
    setConnections(prev => prev.filter(c => c.id !== id));

    if (selectedConnection?.id === id) {
      setSelectedConnection(null);
      setConnectionStatus({ isConnected: false, lastChecked: 0 });
    }
  }, [selectedConnection]);

  const selectConnection = useCallback(async (id: string) => {
    const connection = connections.find(c => c.id === id);
    if (connection) {
      setSelectedConnection(connection);
      await StorageManager.setSelectedConnectionId(id);
    }
  }, [connections]);

  const api = useMemo((): ServiceBusAPI | null => {
    if (!selectedConnection) return null;

    return new ServiceBusAPI(
      selectedConnection.endpoint,
      selectedConnection.keyName,
      selectedConnection.keyValue
    );
  }, [selectedConnection]);

  return {
    connections,
    selectedConnection,
    connectionStatus,
    isTestingConnection,
    isLoaded,
    addConnection,
    updateConnection,
    deleteConnection,
    selectConnection,
    testConnection,
    api,
  };
}
