import { useState } from 'react';
import type { ConnectionString, ConnectionStatus } from '../types';
import { ConfirmModal } from './ConfirmModal';
import './NavigationBar.css';

interface NavigationBarProps {
  connections: ConnectionString[];
  selectedConnection: ConnectionString | null;
  connectionStatus: ConnectionStatus;
  onSelectConnection: (id: string) => void;
  onAddConnection: () => void;
  onImportConnection: () => void;
  onEditConnection: (connection: ConnectionString) => void;
  onDeleteConnection: (id: string) => void;
  onNavigate: (view: 'queues' | 'topics' | 'history') => void;
  currentView: 'queues' | 'topics' | 'history';
}

export const NavigationBar: React.FC<NavigationBarProps> = ({
  connections,
  selectedConnection,
  connectionStatus,
  onSelectConnection,
  onAddConnection,
  onImportConnection,
  onEditConnection,
  onDeleteConnection,
  onNavigate,
  currentView,
}) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<ConnectionString | null>(null);

  const handleDeleteClick = (connection: ConnectionString) => {
    setConfirmDelete(connection);
  };

  const handleConfirmDelete = () => {
    if (confirmDelete) {
      onDeleteConnection(confirmDelete.id);
      setConfirmDelete(null);
    }
  };

  return (
    <>
    <nav className="navigation-bar">
      <div className="nav-left">
        <h1 className="nav-title">Azure Service Bus Messenger</h1>
      </div>

      <div className="nav-center">
        <button
          className={`nav-button ${currentView === 'queues' ? 'active' : ''}`}
          onClick={() => onNavigate('queues')}
          disabled={!selectedConnection}
        >
          Queues
        </button>
        <button
          className={`nav-button ${currentView === 'topics' ? 'active' : ''}`}
          onClick={() => onNavigate('topics')}
          disabled={!selectedConnection}
        >
          Topics
        </button>
        <button
          className={`nav-button ${currentView === 'history' ? 'active' : ''}`}
          onClick={() => onNavigate('history')}
        >
          Message History
        </button>
      </div>

      <div className="nav-right">
        <div className="connection-selector">
          <div
            className={`status-indicator ${connectionStatus.isConnected ? 'connected' : 'disconnected'}`}
            title={connectionStatus.isConnected ? 'Connected' : 'Disconnected'}
          />
          <div className="dropdown-container">
            <button
              className="dropdown-button"
              onClick={() => setShowDropdown(!showDropdown)}
            >
              {selectedConnection ? selectedConnection.name : 'Select Connection'}
              <span className="dropdown-arrow">▼</span>
            </button>
            {showDropdown && (
              <div className="dropdown-menu">
                {connections.length === 0 ? (
                  <div className="dropdown-item disabled">No connections saved</div>
                ) : (
                  connections.map(conn => (
                    <div
                      key={conn.id}
                      className={`dropdown-item-wrapper ${selectedConnection?.id === conn.id ? 'selected' : ''}`}
                    >
                      <button
                        className="dropdown-item-main"
                        onClick={() => {
                          onSelectConnection(conn.id);
                          setShowDropdown(false);
                        }}
                      >
                        {conn.name}
                      </button>
                      <div className="dropdown-item-actions">
                        <button
                          className="icon-button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditConnection(conn);
                            setShowDropdown(false);
                          }}
                          title="Edit connection"
                        >
                          ✏️
                        </button>
                        <button
                          className="icon-button delete"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteClick(conn);
                          }}
                          title="Delete connection"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))
                )}
                <div className="dropdown-divider" />
                <button
                  className="dropdown-item add-button"
                  onClick={() => {
                    onAddConnection();
                    setShowDropdown(false);
                  }}
                >
                  + Add Connection
                </button>
                <button
                  className="dropdown-item add-button"
                  onClick={() => {
                    onImportConnection();
                    setShowDropdown(false);
                  }}
                >
                  📥 Import Connection
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>

    <ConfirmModal
      isOpen={!!confirmDelete}
      title="Delete Connection"
      message={`Are you sure you want to delete the connection "${confirmDelete?.name}"? This action cannot be undone.`}
      confirmText="Delete"
      cancelText="Cancel"
      onConfirm={handleConfirmDelete}
      onCancel={() => setConfirmDelete(null)}
    />
    </>
  );
};
