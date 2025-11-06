import { useState, useEffect } from 'react';
import type { DeadLetterMessage } from '../types';
import { MessageModal } from './MessageModal';
import './Modal.css';

interface DeadLetterModalProps {
  isOpen: boolean;
  onClose: () => void;
  messages: DeadLetterMessage[];
  onResend: (messages: DeadLetterMessage[]) => Promise<void>;
  onRefresh: () => void;
  isLoading: boolean;
  topicName: string;
  subscriptionName: string;
}

export const DeadLetterModal: React.FC<DeadLetterModalProps> = ({
  isOpen,
  onClose,
  messages,
  onResend,
  onRefresh,
  isLoading,
  topicName,
  subscriptionName,
}) => {
  const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set());
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());
  const [editingMessage, setEditingMessage] = useState<DeadLetterMessage | null>(null);
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setSelectedMessages(new Set());
      setExpandedMessages(new Set());
      setEditingMessage(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSelectAll = () => {
    if (selectedMessages.size === messages.length) {
      setSelectedMessages(new Set());
    } else {
      setSelectedMessages(new Set(messages.map(m => m.sequenceNumber)));
    }
  };

  const handleSelectMessage = (sequenceNumber: string) => {
    const newSelected = new Set(selectedMessages);
    if (newSelected.has(sequenceNumber)) {
      newSelected.delete(sequenceNumber);
    } else {
      newSelected.add(sequenceNumber);
    }
    setSelectedMessages(newSelected);
  };

  const handleToggleExpand = (sequenceNumber: string) => {
    const newExpanded = new Set(expandedMessages);
    if (newExpanded.has(sequenceNumber)) {
      newExpanded.delete(sequenceNumber);
    } else {
      newExpanded.add(sequenceNumber);
    }
    setExpandedMessages(newExpanded);
  };

  const handleResendSelected = async () => {
    const messagesToResend = messages.filter(m => selectedMessages.has(m.sequenceNumber));
    if (messagesToResend.length === 0) return;

    setIsResending(true);
    try {
      await onResend(messagesToResend);
      setSelectedMessages(new Set());
    } finally {
      setIsResending(false);
    }
  };

  const handleEditMessage = (message: DeadLetterMessage) => {
    setEditingMessage(message);
  };

  const handleSendEditedMessage = async (
    body: string,
    properties: any[],
    messageProps: any
  ) => {
    if (!editingMessage) return;

    const editedMessage: DeadLetterMessage = {
      ...editingMessage,
      body,
      properties,
      subject: messageProps.subject,
      contentType: messageProps.contentType,
      correlationId: messageProps.correlationId,
      messageId: messageProps.messageId,
    };

    setIsResending(true);
    try {
      await onResend([editedMessage]);
      setEditingMessage(null);
    } finally {
      setIsResending(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-container large-modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h2>☠️ Dead Letter Queue</h2>
            <button className="modal-close" onClick={onClose}>×</button>
          </div>

          <div className="modal-body">
            <div className="dead-letter-info">
              <p><strong>Topic:</strong> {topicName}</p>
              <p><strong>Subscription:</strong> {subscriptionName}</p>
              <p><strong>Messages:</strong> {messages.length}</p>
            </div>

            <div className="dead-letter-actions">
              <button
                className="button-secondary"
                onClick={onRefresh}
                disabled={isLoading}
              >
                {isLoading ? 'Loading...' : 'Refresh'}
              </button>
              <button
                className="button-secondary"
                onClick={handleSelectAll}
                disabled={messages.length === 0}
              >
                {selectedMessages.size === messages.length ? 'Deselect All' : 'Select All'}
              </button>
              <button
                className="button-primary"
                onClick={handleResendSelected}
                disabled={selectedMessages.size === 0 || isResending}
              >
                {isResending ? 'Resending...' : `Resend Selected (${selectedMessages.size})`}
              </button>
            </div>

            {isLoading ? (
              <div className="loading-state">
                <div className="spinner" />
                <p>Loading dead letter messages...</p>
              </div>
            ) : messages.length === 0 ? (
              <div className="empty-state">
                <p>No dead letter messages found</p>
              </div>
            ) : (
              <div className="dead-letter-list">
                {messages.map((message) => (
                  <div
                    key={message.sequenceNumber}
                    className={`dead-letter-item ${selectedMessages.has(message.sequenceNumber) ? 'selected' : ''}`}
                  >
                    <div className="dead-letter-header">
                      <input
                        type="checkbox"
                        checked={selectedMessages.has(message.sequenceNumber)}
                        onChange={() => handleSelectMessage(message.sequenceNumber)}
                      />
                      <div className="dead-letter-summary">
                        <span className="message-id">
                          {message.messageId || message.sequenceNumber}
                        </span>
                        {message.subject && (
                          <span className="message-subject">Subject: {message.subject}</span>
                        )}
                        {message.deadLetterReason && (
                          <span className="dead-letter-reason">
                            Reason: {message.deadLetterReason}
                          </span>
                        )}
                      </div>
                      <div className="dead-letter-buttons">
                        <button
                          className="button-secondary button-small"
                          onClick={() => handleToggleExpand(message.sequenceNumber)}
                        >
                          {expandedMessages.has(message.sequenceNumber) ? 'Collapse' : 'Expand'}
                        </button>
                        <button
                          className="button-primary button-small"
                          onClick={() => handleEditMessage(message)}
                        >
                          Edit & Send
                        </button>
                      </div>
                    </div>

                    {expandedMessages.has(message.sequenceNumber) && (
                      <div className="dead-letter-details">
                        <div className="detail-section">
                          <strong>Enqueued:</strong> {formatDate(message.enqueuedTime)}
                        </div>
                        {message.correlationId && (
                          <div className="detail-section">
                            <strong>Correlation ID:</strong> {message.correlationId}
                          </div>
                        )}
                        {message.contentType && (
                          <div className="detail-section">
                            <strong>Content Type:</strong> {message.contentType}
                          </div>
                        )}
                        {message.deadLetterErrorDescription && (
                          <div className="detail-section">
                            <strong>Error Description:</strong> {message.deadLetterErrorDescription}
                          </div>
                        )}
                        {message.properties.length > 0 && (
                          <div className="detail-section">
                            <strong>Properties:</strong>
                            <ul>
                              {message.properties.map((prop, idx) => (
                                <li key={idx}>
                                  {prop.key}: {prop.value} ({prop.type})
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        <div className="detail-section">
                          <strong>Body:</strong>
                          <pre className="message-body">{message.body}</pre>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button className="button-secondary" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>

      {editingMessage && (
        <MessageModal
          isOpen={!!editingMessage}
          onClose={() => setEditingMessage(null)}
          onSend={handleSendEditedMessage}
          destinationType="topic"
          destinationName={topicName}
          previousMessage={{
            body: editingMessage.body,
            properties: editingMessage.properties,
            subject: editingMessage.subject,
            contentType: editingMessage.contentType,
            correlationId: editingMessage.correlationId,
            messageId: editingMessage.messageId,
          }}
        />
      )}
    </>
  );
};
