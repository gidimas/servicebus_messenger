import { useState, useRef } from 'react';
import './Modal.css';

interface ImportConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (connectionString: string, name: string) => void;
}

export const ImportConnectionModal: React.FC<ImportConnectionModalProps> = ({
  isOpen,
  onClose,
  onImport,
}) => {
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const data = JSON.parse(content);

        if (!data.name || !data.connectionString) {
          setError('Invalid JSON format. Must contain "name" and "connectionString" fields.');
          return;
        }

        onImport(data.connectionString, data.name);
        handleClose();
      } catch (err) {
        setError('Failed to parse JSON file. Please ensure it\'s a valid connection export.');
      }
    };

    reader.readAsText(file);
  };

  const handleClose = () => {
    setError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Import Connection</h2>
          <button className="close-button" onClick={handleClose}>
            ×
          </button>
        </div>

        <div style={{ padding: '1rem 0' }}>
          <p style={{ marginBottom: '1.5rem', color: '#6b7280' }}>
            Select a JSON file containing connection details exported from this application.
          </p>

          <div className="file-upload-area">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
              id="file-input"
            />
            <label htmlFor="file-input" className="file-upload-label">
              📁 Choose JSON File
            </label>
          </div>

          {error && <div className="error-message" style={{ marginTop: '1rem' }}>{error}</div>}
        </div>

        <div className="modal-actions">
          <button type="button" className="button-secondary" onClick={handleClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
