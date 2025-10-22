import { useState, useEffect } from 'react';
import type { MessageProperty } from '../types';
import './Modal.css';

interface MessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (
    body: string,
    properties: MessageProperty[],
    messageProps: {
      subject?: string;
      contentType?: string;
      correlationId?: string;
      messageId?: string;
    }
  ) => Promise<void>;
  destinationType: 'queue' | 'topic';
  destinationName: string;
  correlationFilter?: string;
  previousMessage?: {
    body?: string;
    properties: MessageProperty[];
    subject?: string;
    contentType?: string;
    correlationId?: string;
    messageId?: string;
  };
}

export const MessageModal: React.FC<MessageModalProps> = ({
  isOpen,
  onClose,
  onSend,
  destinationType,
  destinationName,
  correlationFilter,
  previousMessage,
}) => {
  const [body, setBody] = useState('');
  const [subject, setSubject] = useState('');
  const [contentType, setContentType] = useState('application/json');
  const [correlationId, setCorrelationId] = useState('');
  const [messageId, setMessageId] = useState('');
  const [properties, setProperties] = useState<MessageProperty[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [sendStatus, setSendStatus] = useState<'success' | 'error' | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (isOpen) {
      // Load previous message data if available
      if (previousMessage) {
        setBody(previousMessage.body || '');
        setProperties(previousMessage.properties || []);
        setSubject(previousMessage.subject || '');
        setContentType(previousMessage.contentType || 'application/json');
        setCorrelationId(previousMessage.correlationId || '');
        setMessageId(previousMessage.messageId || '');
      }
      // Override subject with correlation filter if provided
      if (correlationFilter) {
        setSubject(correlationFilter);
      }
    }
  }, [isOpen, correlationFilter, previousMessage]);

  if (!isOpen) return null;

  const handleAddProperty = () => {
    setProperties([...properties, { key: '', value: '' }]);
  };

  const handleRemoveProperty = (index: number) => {
    setProperties(properties.filter((_, i) => i !== index));
  };

  const handlePropertyChange = (index: number, field: 'key' | 'value', value: string) => {
    const updated = [...properties];
    updated[index][field] = value;
    setProperties(updated);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSending(true);
    setSendStatus(null);
    setErrorMessage('');

    try {
      const validProperties = properties.filter(p => p.key.trim() !== '');

      await onSend(body, validProperties, {
        subject: subject || undefined,
        contentType: contentType || undefined,
        correlationId: correlationId || undefined,
        messageId: messageId || undefined,
      });

      setSendStatus('success');

      // Reset only body after successful send
      // Keep properties, subject, contentType, etc. for convenience
      setBody('');
    } catch (error) {
      setSendStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  const handleClose = () => {
    setBody('');
    setSubject('');
    setContentType('application/json');
    setCorrelationId('');
    setMessageId('');
    setProperties([]);
    setSendStatus(null);
    setErrorMessage('');
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            Send Message to {destinationType === 'queue' ? 'Queue' : 'Topic'}: {destinationName}
          </h2>
          <button className="close-button" onClick={handleClose}>
            ×
          </button>
        </div>

        <form onSubmit={handleSend}>
          <div className="form-group">
            <label htmlFor="body">Message Body</label>
            <textarea
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder='{"message": "Hello, Service Bus!"}'
              rows={8}
              autoFocus
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="subject">Subject/Label</label>
              <input
                id="subject"
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Optional subject"
              />
            </div>

            <div className="form-group">
              <label htmlFor="contentType">Content Type</label>
              <input
                id="contentType"
                type="text"
                value={contentType}
                onChange={(e) => setContentType(e.target.value)}
                placeholder="application/json"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="correlationId">Correlation ID</label>
              <input
                id="correlationId"
                type="text"
                value={correlationId}
                onChange={(e) => setCorrelationId(e.target.value)}
                placeholder="Optional correlation ID"
              />
            </div>

            <div className="form-group">
              <label htmlFor="messageId">Message ID</label>
              <input
                id="messageId"
                type="text"
                value={messageId}
                onChange={(e) => setMessageId(e.target.value)}
                placeholder="Optional message ID"
              />
            </div>
          </div>

          <div className="form-group">
            <div className="property-header">
              <label>Custom Properties</label>
              <button
                type="button"
                className="button-small"
                onClick={handleAddProperty}
              >
                + Add Property
              </button>
            </div>
            <div className="properties-list">
              {properties.map((prop, index) => (
                <div key={index} className="property-row">
                  <input
                    type="text"
                    value={prop.key}
                    onChange={(e) => handlePropertyChange(index, 'key', e.target.value)}
                    placeholder="Property name"
                  />
                  <input
                    type="text"
                    value={prop.value}
                    onChange={(e) => handlePropertyChange(index, 'value', e.target.value)}
                    placeholder="Property value"
                  />
                  <button
                    type="button"
                    className="button-danger-small"
                    onClick={() => handleRemoveProperty(index)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>

          {sendStatus === 'success' && (
            <div className="success-message">
              Message sent successfully!
            </div>
          )}

          {sendStatus === 'error' && (
            <div className="error-message">
              {errorMessage}
            </div>
          )}

          <div className="modal-actions">
            <button type="button" className="button-secondary" onClick={handleClose}>
              Close
            </button>
            <button type="submit" className="button-primary" disabled={isSending}>
              {isSending ? 'Sending...' : 'Send Message'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
