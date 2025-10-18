import { useState, useEffect } from 'react';
import { NavigationBar } from './components/NavigationBar';
import { ConnectionModal } from './components/ConnectionModal';
import { QueuesView } from './components/QueuesView';
import { TopicsView } from './components/TopicsView';
import { MessageHistoryView } from './components/MessageHistoryView';
import { useConnections } from './hooks/useConnections';
import './App.css';

type View = 'queues' | 'topics' | 'history';

function App() {
  const [currentView, setCurrentView] = useState<View>('queues');
  const [isConnectionModalOpen, setIsConnectionModalOpen] = useState(false);

  const {
    connections,
    selectedConnection,
    connectionStatus,
    addConnection,
    selectConnection,
    getAPI,
  } = useConnections();

  // Show connection modal on first load if no connections exist
  useEffect(() => {
    if (connections.length === 0) {
      setIsConnectionModalOpen(true);
    }
  }, [connections.length]);

  const handleAddConnection = (connectionString: string, name: string) => {
    const newConnection = addConnection(connectionString, name);
    selectConnection(newConnection.id);
  };

  const api = getAPI();

  return (
    <div className="app">
      <NavigationBar
        connections={connections}
        selectedConnection={selectedConnection}
        connectionStatus={connectionStatus}
        onSelectConnection={selectConnection}
        onAddConnection={() => setIsConnectionModalOpen(true)}
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
    </div>
  );
}

export default App;
