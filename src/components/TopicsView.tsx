import { useState, useEffect } from 'react';
import type { Topic } from '../types';
import { ServiceBusAPI } from '../services/serviceBusApi';
import { MessageModal } from './MessageModal';
import { StorageManager } from '../utils/storage';
import './ListView.css';

interface TopicsViewProps {
  api: ServiceBusAPI | null;
}

export const TopicsView: React.FC<TopicsViewProps> = ({ api }) => {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (api) {
      loadTopics();
    }
  }, [api]);

  const loadTopics = async () => {
    if (!api) return;

    setIsLoading(true);
    setError(null);

    try {
      const fetchedTopics = await api.getTopics();
      setTopics(fetchedTopics);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load topics');
    } finally {
      setIsLoading(false);
    }
  };

  const loadSubscriptions = async (topicName: string) => {
    if (!api) return;

    try {
      const subscriptions = await api.getSubscriptions(topicName);
      setTopics(prev =>
        prev.map(topic =>
          topic.name === topicName ? { ...topic, subscriptions } : topic
        )
      );
    } catch (err) {
      console.error('Failed to load subscriptions:', err);
    }
  };

  const toggleTopicExpansion = (topicName: string) => {
    const newExpanded = new Set(expandedTopics);

    if (newExpanded.has(topicName)) {
      newExpanded.delete(topicName);
    } else {
      newExpanded.add(topicName);
      // Load subscriptions if not already loaded
      const topic = topics.find(t => t.name === topicName);
      if (topic && !topic.subscriptions) {
        loadSubscriptions(topicName);
      }
    }

    setExpandedTopics(newExpanded);
  };

  const handleSendMessage = async (
    body: string,
    properties: any[],
    messageProps: any
  ) => {
    if (!api || !selectedTopic) return;

    await api.sendMessageToTopic(
      selectedTopic.name,
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
      destination: selectedTopic.name,
      destinationType: 'topic',
    });
  };

  if (!api) {
    return (
      <div className="list-view">
        <div className="empty-state">
          <p>Please select a connection to view topics</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="list-view">
        <div className="loading-state">
          <div className="spinner" />
          <p>Loading topics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="list-view">
        <div className="error-state">
          <p>{error}</p>
          <button className="button-primary" onClick={loadTopics}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (topics.length === 0) {
    return (
      <div className="list-view">
        <div className="empty-state">
          <p>No topics found</p>
          <button className="button-secondary" onClick={loadTopics}>
            Refresh
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="list-view">
      <div className="list-header">
        <h2>Topics ({topics.length})</h2>
        <button className="button-secondary" onClick={loadTopics}>
          Refresh
        </button>
      </div>

      <div className="list-grid">
        {topics.map((topic) => (
          <div key={topic.name} className="list-card">
            <div className="card-header">
              <h3>{topic.name}</h3>
              <button
                className="expand-button"
                onClick={() => toggleTopicExpansion(topic.name)}
              >
                {expandedTopics.has(topic.name) ? '▼' : '▶'}
              </button>
            </div>

            {expandedTopics.has(topic.name) && topic.subscriptions && (
              <div className="subscriptions-list">
                <h4>Subscriptions</h4>
                {topic.subscriptions.length === 0 ? (
                  <p className="no-subscriptions">No subscriptions</p>
                ) : (
                  topic.subscriptions.map((sub) => (
                    <div key={sub.name} className="subscription-item">
                      <span className="subscription-name">{sub.name}</span>
                      <div className="subscription-stats">
                        <span className="stat-small">
                          Msgs: {sub.messageCount ?? '—'}
                        </span>
                        <span className="stat-small dead-letter">
                          DLQ: {sub.deadLetterMessageCount ?? '—'}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            <div className="card-actions">
              <button
                className="button-primary"
                onClick={() => setSelectedTopic(topic)}
              >
                Send Message
              </button>
            </div>
          </div>
        ))}
      </div>

      {selectedTopic && (
        <MessageModal
          isOpen={!!selectedTopic}
          onClose={() => setSelectedTopic(null)}
          onSend={handleSendMessage}
          destinationType="topic"
          destinationName={selectedTopic.name}
        />
      )}
    </div>
  );
};
