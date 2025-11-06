import { useState, useEffect } from 'react';
import type { ConnectionString } from './types';
import { NavigationBar } from './components/NavigationBar';
import { ConnectionModal } from './components/ConnectionModal';
import { EditConnectionModal } from './components/EditConnectionModal';
import { ImportConnectionModal } from './components/ImportConnectionModal';
import { QueuesView } from './components/QueuesView';
import { TopicsView } from './components/TopicsView';
import { MessageHistoryView } from './components/MessageHistoryView';
import { useConnections } from './hooks/useConnections';
import './App.css';

type View = 'queues' | 'topics' | 'history';

function App() {
  const [currentView, setCurrentView] = useState<View>('queues');
  const [isConnectionModalOpen, setIsConnectionModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [editingConnection, setEditingConnection] = useState<ConnectionString | null>(null);

  const {
    connections,
    selectedConnection,
    connectionStatus,
    isLoaded,
    addConnection,
    updateConnection,
    deleteConnection,
    selectConnection,
    api,
  } = useConnections();

  // Show connection modal on first load if no connections exist
  useEffect(() => {
    if (isLoaded && connections.length === 0) {
      setIsConnectionModalOpen(true);
    }
  }, [isLoaded, connections.length]);

  const handleAddConnection = async (connectionString: string, name: string) => {
    const newConnection = await addConnection(connectionString, name);
    await selectConnection(newConnection.id);
  };

  const handleEditConnection = (connection: ConnectionString) => {
    setEditingConnection(connection);
    setIsEditModalOpen(true);
  };

  const handleSaveConnection = async (id: string, connectionString: string, name: string) => {
    await updateConnection(id, connectionString, name);
  };

  const handleImportConnection = async (connectionString: string, name: string) => {
    const newConnection = await addConnection(connectionString, name);
    await selectConnection(newConnection.id);
  };

  return (
    <div className="app">
      <NavigationBar
        connections={connections}
        selectedConnection={selectedConnection}
        connectionStatus={connectionStatus}
        onSelectConnection={selectConnection}
        onAddConnection={() => setIsConnectionModalOpen(true)}
        onImportConnection={() => setIsImportModalOpen(true)}
        onEditConnection={handleEditConnection}
        onDeleteConnection={deleteConnection}
        onNavigate={setCurrentView}
        currentView={currentView}
      />

      <main className="main-content">
        {currentView === 'queues' && <QueuesView api={api} />}
        {currentView === 'topics' && <TopicsView api={api} />}
        {currentView === 'history' && <MessageHistoryView api={api} />}
      </main>

      <ConnectionModal
        isOpen={isConnectionModalOpen}
        onClose={() => setIsConnectionModalOpen(false)}
        onAdd={handleAddConnection}
      />

      <EditConnectionModal
        isOpen={isEditModalOpen}
        connection={editingConnection}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingConnection(null);
        }}
        onSave={handleSaveConnection}
      />

      <ImportConnectionModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImport={handleImportConnection}
      />
    </div>
  );
}

export default App;
