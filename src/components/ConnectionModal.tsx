import { useState } from 'react';
import './Modal.css';

interface ConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (connectionString: string, name: string) => void;
}

export const ConnectionModal: React.FC<ConnectionModalProps> = ({
  isOpen,
  onClose,
  onAdd,
}) => {
  const [name, setName] = useState('');
  const [connectionString, setConnectionString] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

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
      onAdd(connectionString, name);
      setName('');
      setConnectionString('');
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

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add Connection</h2>
          <button className="close-button" onClick={handleClose}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name">Connection Name</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Service Bus"
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="connectionString">Connection String</label>
            <textarea
              id="connectionString"
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
            <button type="button" className="button-secondary" onClick={handleClose}>
              Cancel
            </button>
            <button type="submit" className="button-primary">
              Add Connection
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
