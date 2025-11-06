import { useState, useEffect } from 'react';
import type { Message } from '../types';
import { StorageManager } from '../utils/storage';
import { ServiceBusAPI } from '../services/serviceBusApi';
import { MessageModal } from './MessageModal';
import './ListView.css';

interface MessageHistoryViewProps {
  api: ServiceBusAPI | null;
}

export const MessageHistoryView: React.FC<MessageHistoryViewProps> = ({ api }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());
  const [resendingMessages, setResendingMessages] = useState<Set<string>>(new Set());
  const [resendStatus, setResendStatus] = useState<{ [key: string]: 'success' | 'error' }>({});
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);

  useEffect(() => {
    loadMessages();
  }, []);

  const loadMessages = async () => {
    const history = await StorageManager.getMessageHistory();
    setMessages(history);
  };

  const toggleMessageExpansion = (id: string) => {
    const newExpanded = new Set(expandedMessages);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedMessages(newExpanded);
  };

  const handleResend = async (message: Message) => {
    if (!api) return;

    setResendingMessages(prev => new Set(prev).add(message.id));
    setResendStatus(prev => {
      const next = { ...prev };
      delete next[message.id];
      return next;
    });

    try {
      if (message.destinationType === 'queue') {
        await api.sendMessageToQueue(
          message.destination,
          message.body,
          message.properties,
          {
            subject: message.subject,
            contentType: message.contentType,
            correlationId: message.correlationId,
            messageId: message.messageId,
          }
        );
      } else {
        await api.sendMessageToTopic(
          message.destination,
          message.body,
          message.properties,
          {
            subject: message.subject,
            contentType: message.contentType,
            correlationId: message.correlationId,
            messageId: message.messageId,
          }
        );
      }

      // Save resent message to history
      const resentMessage: Message = {
        ...message,
        id: Date.now().toString(),
        sentAt: Date.now(),
      };
      await StorageManager.saveMessage(resentMessage);
      await loadMessages();

      setResendStatus(prev => ({ ...prev, [message.id]: 'success' }));
    } catch (error) {
      console.error('Error resending message:', error);
      setResendStatus(prev => ({ ...prev, [message.id]: 'error' }));
    } finally {
      setResendingMessages(prev => {
        const next = new Set(prev);
        next.delete(message.id);
        return next;
      });
    }
  };

  const handleClearHistory = async () => {
    if (confirm('Are you sure you want to clear all message history?')) {
      await StorageManager.clearMessageHistory();
      await loadMessages();
    }
  };

  const handleEditMessage = async (
    body: string,
    properties: any[],
    messageProps: any
  ) => {
    if (!api || !editingMessage) return;

    // Send the edited message
    if (editingMessage.destinationType === 'queue') {
      await api.sendMessageToQueue(
        editingMessage.destination,
        body,
        properties,
        messageProps
      );
    } else {
      await api.sendMessageToTopic(
        editingMessage.destination,
        body,
        properties,
        messageProps
      );
    }

    // Save to history
    await StorageManager.saveMessage({
      id: Date.now().toString(),
      body,
      properties,
      subject: messageProps.subject,
      contentType: messageProps.contentType,
      correlationId: messageProps.correlationId,
      messageId: messageProps.messageId,
      sentAt: Date.now(),
      destination: editingMessage.destination,
      destinationType: editingMessage.destinationType,
      subscriptionName: editingMessage.subscriptionName,
    });

    await loadMessages();
    setEditingMessage(null);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  if (messages.length === 0) {
    return (
      <div className="list-view">
        <div className="empty-state">
          <p>No messages sent yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="list-view">
      <div className="list-header">
        <h2>Message History ({messages.length})</h2>
        <button className="button-danger" onClick={handleClearHistory}>
          Clear History
        </button>
      </div>

      <div className="message-history-list">
        {messages.map((message) => (
          <div key={message.id} className="message-history-card">
            <div className="message-header" onClick={() => toggleMessageExpansion(message.id)}>
              <div className="message-info">
                <span className="message-destination">
                  {message.destinationType === 'queue' ? '📮' : '📡'} {message.destination}
                </span>
                <span className="message-date">{formatDate(message.sentAt)}</span>
              </div>
              <div className="message-actions">
                <button
                  className="resend-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingMessage(message);
                  }}
                  disabled={!api}
                  title="Edit and resend message"
                >
                  ✏️
                </button>
                <button
                  className="resend-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleResend(message);
                  }}
                  disabled={!api || resendingMessages.has(message.id)}
                  title="Resend message"
                >
                  {resendingMessages.has(message.id) ? '↻' : '↗'}
                </button>
                <span className="expand-icon">
                  {expandedMessages.has(message.id) ? '▼' : '▶'}
                </span>
              </div>
            </div>

            {resendStatus[message.id] === 'success' && (
              <div className="resend-success">Message resent successfully!</div>
            )}

            {resendStatus[message.id] === 'error' && (
              <div className="resend-error">Failed to resend message</div>
            )}

            {expandedMessages.has(message.id) && (
              <div className="message-details">
                <div className="detail-section">
                  <h4>Message Body</h4>
                  <pre className="message-body">{message.body}</pre>
                </div>

                {message.subject && (
                  <div className="detail-row">
                    <strong>Subject:</strong> {message.subject}
                  </div>
                )}

                {message.contentType && (
                  <div className="detail-row">
                    <strong>Content Type:</strong> {message.contentType}
                  </div>
                )}

                {message.correlationId && (
                  <div className="detail-row">
                    <strong>Correlation ID:</strong> {message.correlationId}
                  </div>
                )}

                {message.messageId && (
                  <div className="detail-row">
                    <strong>Message ID:</strong> {message.messageId}
                  </div>
                )}

                {message.properties.length > 0 && (
                  <div className="detail-section">
                    <h4>Custom Properties</h4>
                    <div className="properties-table">
                      {message.properties.map((prop, index) => (
                        <div key={index} className="property-row-display">
                          <span className="property-key">{prop.key}</span>
                          <span className="property-value">{prop.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {editingMessage && (
        <MessageModal
          isOpen={!!editingMessage}
          onClose={() => setEditingMessage(null)}
          onSend={handleEditMessage}
          destinationType={editingMessage.destinationType}
          destinationName={editingMessage.destination}
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
    </div>
  );
};
