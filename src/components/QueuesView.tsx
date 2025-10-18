import { useState, useEffect } from 'react';
import type { Queue } from '../types';
import { ServiceBusAPI } from '../services/serviceBusApi';
import { MessageModal } from './MessageModal';
import { StorageManager } from '../utils/storage';
import './ListView.css';

interface QueuesViewProps {
  api: ServiceBusAPI | null;
}

export const QueuesView: React.FC<QueuesViewProps> = ({ api }) => {
  const [queues, setQueues] = useState<Queue[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedQueue, setSelectedQueue] = useState<Queue | null>(null);

  useEffect(() => {
    if (api) {
      loadQueues();
    }
  }, [api]);

  const loadQueues = async () => {
    if (!api) return;

    setIsLoading(true);
    setError(null);

    try {
      const fetchedQueues = await api.getQueues();
      setQueues(fetchedQueues);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load queues');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (
    body: string,
    properties: any[],
    messageProps: any
  ) => {
    if (!api || !selectedQueue) return;

    await api.sendMessageToQueue(
      selectedQueue.name,
      body,
      properties,
      messageProps
    );

    // Save to history
    StorageManager.saveMessage({
      id: Date.now().toString(),
      body,
      properties,
      subject: messageProps.subject,
      contentType: messageProps.contentType,
      correlationId: messageProps.correlationId,
      messageId: messageProps.messageId,
      sentAt: Date.now(),
      destination: selectedQueue.name,
      destinationType: 'queue',
    });
  };

  if (!api) {
    return (
      <div className="list-view">
        <div className="empty-state">
          <p>Please select a connection to view queues</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="list-view">
        <div className="loading-state">
          <div className="spinner" />
          <p>Loading queues...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="list-view">
        <div className="error-state">
          <p>{error}</p>
          <button className="button-primary" onClick={loadQueues}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (queues.length === 0) {
    return (
      <div className="list-view">
        <div className="empty-state">
          <p>No queues found</p>
          <button className="button-secondary" onClick={loadQueues}>
            Refresh
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="list-view">
      <div className="list-header">
        <h2>Queues ({queues.length})</h2>
        <button className="button-secondary" onClick={loadQueues}>
          Refresh
        </button>
      </div>

      <div className="list-grid">
        {queues.map((queue) => (
          <div key={queue.name} className="list-card">
            <div className="card-header">
              <h3>{queue.name}</h3>
            </div>
            <div className="card-body">
              <div className="card-stats">
                <div className="stat">
                  <span className="stat-label">Messages</span>
                  <span className="stat-value">{queue.messageCount ?? '—'}</span>
                </div>
                <div className="stat">
                  <span className="stat-label">Dead Letters</span>
                  <span className="stat-value dead-letter">
                    {queue.deadLetterMessageCount ?? '—'}
                  </span>
                </div>
              </div>
            </div>
            <div className="card-actions">
              <button
                className="button-primary"
                onClick={() => setSelectedQueue(queue)}
              >
                Send Message
              </button>
            </div>
          </div>
        ))}
      </div>

      {selectedQueue && (
        <MessageModal
          isOpen={!!selectedQueue}
          onClose={() => setSelectedQueue(null)}
          onSend={handleSendMessage}
          destinationType="queue"
          destinationName={selectedQueue.name}
        />
      )}
    </div>
  );
};
