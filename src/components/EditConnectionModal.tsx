import { useState, useEffect } from 'react';
import type { ConnectionString } from '../types';
import './Modal.css';

interface EditConnectionModalProps {
  isOpen: boolean;
  connection: ConnectionString | null;
  onClose: () => void;
  onSave: (id: string, connectionString: string, name: string) => void;
}

export const EditConnectionModal: React.FC<EditConnectionModalProps> = ({
  isOpen,
  connection,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [connectionString, setConnectionString] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (connection) {
      setName(connection.name);
      setConnectionString(connection.connectionString);
    }
  }, [connection]);

  if (!isOpen || !connection) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Please enter a connection name');
      return;
    }

    if (!connectionString.trim()) {
      setError('Please enter a connection string');
      return;
    }

    try {
      onSave(connection.id, connectionString, name);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid connection string');
    }
  };

  const handleClose = () => {
    setName('');
    setConnectionString('');
    setError('');
    onClose();
  };

  const handleExport = () => {
    const exportData = {
      name: connection.name,
      connectionString: connection.connectionString,
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

    const exportFileDefaultName = `${connection.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_connection.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Edit Connection</h2>
          <button className="close-button" onClick={handleClose}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="edit-name">Connection Name</label>
            <input
              id="edit-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Service Bus"
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="edit-connectionString">Connection String</label>
            <textarea
              id="edit-connectionString"
              value={connectionString}
              onChange={(e) => setConnectionString(e.target.value)}
              placeholder="Endpoint=sb://foo.servicebus.windows.net/;SharedAccessKeyName=someKeyName;SharedAccessKey=someKeyValue"
              rows={4}
            />
            <small className="form-help">
              Format: Endpoint=sb://...;SharedAccessKeyName=...;SharedAccessKey=...
            </small>
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="modal-actions">
            <button type="button" className="button-secondary" onClick={handleExport}>
              📥 Export as JSON
            </button>
            <div style={{ flex: 1 }} />
            <button type="button" className="button-secondary" onClick={handleClose}>
              Cancel
            </button>
            <button type="submit" className="button-primary">
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
