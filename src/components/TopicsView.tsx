import { useState, useEffect } from 'react';
import type { Topic, Message, DeadLetterMessage } from '../types';
import { ServiceBusAPI } from '../services/serviceBusApi';
import { MessageModal } from './MessageModal';
import { DeadLetterModal } from './DeadLetterModal';
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
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubscription, setSelectedSubscription] = useState<{ topicName: string; subscription: any; correlationFilter?: string } | null>(null);
  const [loadingCorrelationFilter, setLoadingCorrelationFilter] = useState(false);
  const [previousMessage, setPreviousMessage] = useState<Message | undefined>(undefined);
  const [deadLetterView, setDeadLetterView] = useState<{ topicName: string; subscriptionName: string } | null>(null);
  const [deadLetterMessages, setDeadLetterMessages] = useState<DeadLetterMessage[]>([]);
  const [loadingDeadLetters, setLoadingDeadLetters] = useState(false);

  useEffect(() => {
    if (api) {
      loadTopics();
    }
  }, [api]);

  useEffect(() => {
    const topicName = selectedTopic?.name || selectedSubscription?.topicName;
    if (topicName) {
      StorageManager.getLastMessageForDestination(topicName, 'topic')
        .then(msg => setPreviousMessage(msg));
    }
  }, [selectedTopic, selectedSubscription]);

  const loadTopics = async (forceRefresh = false) => {
    if (!api) return;

    setIsLoading(true);
    setError(null);

    try {
      const fetchedTopics = await api.getTopics(forceRefresh);
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
    if (!api) return;

    const topicName = selectedTopic?.name || selectedSubscription?.topicName;
    if (!topicName) return;

    await api.sendMessageToTopic(
      topicName,
      body,
      properties,
      messageProps
    );

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
      destination: topicName,
      destinationType: 'topic',
      subscriptionName: selectedSubscription?.subscription.name,
    });
  };

  const handleCloseModal = () => {
    setSelectedTopic(null);
    setSelectedSubscription(null);
  };

  const handleSubscriptionSendClick = async (topicName: string, subscription: any) => {
    if (!api) return;

    setLoadingCorrelationFilter(true);
    try {
      const correlationFilter = await api.getSubscriptionCorrelationFilter(topicName, subscription.name);
      console.log(`Correlation filter for ${subscription.name}:`, correlationFilter);
      setSelectedSubscription({ topicName, subscription, correlationFilter });
    } catch (error) {
      // If we can't get correlation filter, just open modal without it
      console.error('Failed to get correlation filter:', error);
      setSelectedSubscription({ topicName, subscription });
    } finally {
      setLoadingCorrelationFilter(false);
    }
  };

  const handleDeadLetterClick = async (topicName: string, subscriptionName: string) => {
    if (!api) return;

    setDeadLetterView({ topicName, subscriptionName });
    await loadDeadLetters(topicName, subscriptionName);
  };

  const loadDeadLetters = async (topicName: string, subscriptionName: string) => {
    if (!api) return;

    setLoadingDeadLetters(true);
    try {
      const messages = await api.getDeadLetterMessages(topicName, subscriptionName);
      setDeadLetterMessages(messages);
    } catch (error) {
      console.error('Error loading dead letters:', error);
      setDeadLetterMessages([]);
    } finally {
      setLoadingDeadLetters(false);
    }
  };

  const handleResendDeadLetters = async (messages: DeadLetterMessage[]) => {
    if (!api || !deadLetterView) return;

    const { topicName } = deadLetterView;

    for (const message of messages) {
      try {
        await api.sendMessageToTopic(
          topicName,
          message.body,
          message.properties,
          {
            subject: message.subject,
            contentType: message.contentType,
            correlationId: message.correlationId,
            messageId: message.messageId,
          }
        );
      } catch (error) {
        console.error('Error resending dead letter:', error);
        throw error;
      }
    }

    // Refresh dead letter list after resending
    await loadDeadLetters(deadLetterView.topicName, deadLetterView.subscriptionName);
  };

  const handleRefreshDeadLetters = async () => {
    if (deadLetterView) {
      await loadDeadLetters(deadLetterView.topicName, deadLetterView.subscriptionName);
    }
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
          <button className="button-primary" onClick={() => loadTopics(true)}>
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
          <button className="button-secondary" onClick={() => loadTopics(true)}>
            Refresh
          </button>
        </div>
      </div>
    );
  }

  const filteredTopics = topics.filter(topic =>
    topic.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="list-view">
      <div className="list-header">
        <h2>Topics ({filteredTopics.length})</h2>
        <button className="button-secondary" onClick={() => loadTopics(true)}>
          Refresh
        </button>
      </div>

      <div className="search-container">
        <input
          type="text"
          placeholder="Search topics..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
      </div>

      <div className="list-grid">
        {filteredTopics.map((topic) => (
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
                      <div className="subscription-content">
                        <span className="subscription-name">{sub.name}</span>
                      </div>
                      <div className="subscription-buttons">
                        <button
                          className="subscription-action-btn"
                          onClick={() => handleDeadLetterClick(topic.name, sub.name)}
                          title="View dead letter queue"
                        >
                          ☠️
                        </button>
                        <button
                          className="subscription-action-btn"
                          onClick={() => handleSubscriptionSendClick(topic.name, sub)}
                          disabled={loadingCorrelationFilter}
                          title="Send message to topic"
                        >
                          ✉️
                        </button>
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

      {(selectedTopic || selectedSubscription) && (
        <MessageModal
          isOpen={!!(selectedTopic || selectedSubscription)}
          onClose={handleCloseModal}
          onSend={handleSendMessage}
          destinationType="topic"
          destinationName={selectedTopic?.name || selectedSubscription?.topicName || ''}
          correlationFilter={selectedSubscription?.correlationFilter}
          previousMessage={previousMessage}
        />
      )}

      {deadLetterView && (
        <DeadLetterModal
          isOpen={!!deadLetterView}
          onClose={() => setDeadLetterView(null)}
          messages={deadLetterMessages}
          onResend={handleResendDeadLetters}
          onRefresh={handleRefreshDeadLetters}
          isLoading={loadingDeadLetters}
          topicName={deadLetterView.topicName}
          subscriptionName={deadLetterView.subscriptionName}
        />
      )}
    </div>
  );
};
