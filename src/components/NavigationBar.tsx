import { useState } from 'react';
import type { ConnectionString, ConnectionStatus } from '../types';
import './NavigationBar.css';

interface NavigationBarProps {
  connections: ConnectionString[];
  selectedConnection: ConnectionString | null;
  connectionStatus: ConnectionStatus;
  onSelectConnection: (id: string) => void;
  onAddConnection: () => void;
  onNavigate: (view: 'queues' | 'topics' | 'history') => void;
  currentView: 'queues' | 'topics' | 'history';
}

export const NavigationBar: React.FC<NavigationBarProps> = ({
  connections,
  selectedConnection,
  connectionStatus,
  onSelectConnection,
  onAddConnection,
  onNavigate,
  currentView,
}) => {
  const [showDropdown, setShowDropdown] = useState(false);

  return (
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
                    <button
                      key={conn.id}
                      className={`dropdown-item ${selectedConnection?.id === conn.id ? 'selected' : ''}`}
                      onClick={() => {
                        onSelectConnection(conn.id);
                        setShowDropdown(false);
                      }}
                    >
                      {conn.name}
                    </button>
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
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};
