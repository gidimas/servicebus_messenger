import './Modal.css';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content modal-small" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="close-button" onClick={onCancel}>
            ×
          </button>
        </div>

        <div style={{ padding: '1rem 0' }}>
          <p style={{ color: '#374151', fontSize: '0.95rem' }}>{message}</p>
        </div>

        <div className="modal-actions">
          <button type="button" className="button-secondary" onClick={onCancel}>
            {cancelText}
          </button>
          <button type="button" className="button-danger" onClick={onConfirm}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
