import { generateResourceSASToken, generateSASToken } from '../utils/sasToken';
import type { Queue, Topic, Subscription, MessageProperty } from '../types';

export class ServiceBusAPI {
  private endpoint: string;
  private keyName: string;
  private keyValue: string;
  private proxyUrl: string = 'http://localhost:3001';

  constructor(endpoint: string, keyName: string, keyValue: string) {
    this.endpoint = endpoint.replace('sb://', 'https://').replace(/\/$/, '');
    this.keyName = keyName;
    this.keyValue = keyValue;
  }

  private buildProxyUrl(targetUrl: string): string {
    return `${this.proxyUrl}?url=${encodeURIComponent(targetUrl)}`;
  }

  private getAuthHeader(resourcePath?: string): string {
    if (resourcePath) {
      const { token } = generateResourceSASToken(
        this.endpoint,
        resourcePath,
        this.keyName,
        this.keyValue
      );
      return token;
    }

    const { token } = generateSASToken(
      this.endpoint,
      this.keyName,
      this.keyValue
    );
    return token;
  }

  async testConnection(): Promise<boolean> {
    try {
      const targetUrl = `${this.endpoint}/$Resources/Queues?api-version=2021-05`;
      const response = await fetch(this.buildProxyUrl(targetUrl), {
        method: 'GET',
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/atom+xml;type=feed;charset=utf-8',
        },
      });

      return response.ok;
    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
    }
  }

  async getQueues(): Promise<Queue[]> {
    try {
      const targetUrl = `${this.endpoint}/$Resources/Queues?api-version=2021-05`;
      const response = await fetch(this.buildProxyUrl(targetUrl), {
        method: 'GET',
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/atom+xml;type=feed;charset=utf-8',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch queues: ${response.status} ${response.statusText}`);
      }

      const text = await response.text();
      return this.parseQueuesFromXml(text);
    } catch (error) {
      console.error('Error fetching queues:', error);
      throw error;
    }
  }

  async getTopics(): Promise<Topic[]> {
    try {
      const targetUrl = `${this.endpoint}/$Resources/Topics?api-version=2021-05`;
      const response = await fetch(this.buildProxyUrl(targetUrl), {
        method: 'GET',
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/atom+xml;type=feed;charset=utf-8',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch topics: ${response.status} ${response.statusText}`);
      }

      const text = await response.text();
      return this.parseTopicsFromXml(text);
    } catch (error) {
      console.error('Error fetching topics:', error);
      throw error;
    }
  }

  async getSubscriptions(topicName: string): Promise<Subscription[]> {
    try {
      const targetUrl = `${this.endpoint}/${topicName}/Subscriptions?api-version=2021-05`;
      const response = await fetch(
        this.buildProxyUrl(targetUrl),
        {
          method: 'GET',
          headers: {
            'Authorization': this.getAuthHeader(`${topicName}/Subscriptions`),
            'Content-Type': 'application/atom+xml;type=feed;charset=utf-8',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch subscriptions: ${response.status} ${response.statusText}`);
      }

      const text = await response.text();
      return this.parseSubscriptionsFromXml(text);
    } catch (error) {
      console.error('Error fetching subscriptions:', error);
      throw error;
    }
  }

  async sendMessageToQueue(
    queueName: string,
    body: string,
    properties?: MessageProperty[],
    messageProperties?: {
      subject?: string;
      contentType?: string;
      correlationId?: string;
      messageId?: string;
    }
  ): Promise<void> {
    try {
      const headers: Record<string, string> = {
        'Authorization': this.getAuthHeader(`${queueName}/messages`),
        'Content-Type': messageProperties?.contentType || 'application/json',
      };

      if (messageProperties?.subject) {
        headers['Label'] = messageProperties.subject;
      }

      if (messageProperties?.correlationId) {
        headers['CorrelationId'] = messageProperties.correlationId;
      }

      if (messageProperties?.messageId) {
        headers['MessageId'] = messageProperties.messageId;
      }

      // Add custom properties
      if (properties) {
        properties.forEach(prop => {
          headers[prop.key] = prop.value;
        });
      }

      const targetUrl = `${this.endpoint}/${queueName}/messages?api-version=2021-05`;
      const response = await fetch(
        this.buildProxyUrl(targetUrl),
        {
          method: 'POST',
          headers,
          body,
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to send message: ${response.status} ${response.statusText}\n${errorText}`);
      }
    } catch (error) {
      console.error('Error sending message to queue:', error);
      throw error;
    }
  }

  async sendMessageToTopic(
    topicName: string,
    body: string,
    properties?: MessageProperty[],
    messageProperties?: {
      subject?: string;
      contentType?: string;
      correlationId?: string;
      messageId?: string;
    }
  ): Promise<void> {
    try {
      const headers: Record<string, string> = {
        'Authorization': this.getAuthHeader(`${topicName}/messages`),
        'Content-Type': messageProperties?.contentType || 'application/json',
      };

      if (messageProperties?.subject) {
        headers['Label'] = messageProperties.subject;
      }

      if (messageProperties?.correlationId) {
        headers['CorrelationId'] = messageProperties.correlationId;
      }

      if (messageProperties?.messageId) {
        headers['MessageId'] = messageProperties.messageId;
      }

      // Add custom properties
      if (properties) {
        properties.forEach(prop => {
          headers[prop.key] = prop.value;
        });
      }

      const targetUrl = `${this.endpoint}/${topicName}/messages?api-version=2021-05`;
      const response = await fetch(
        this.buildProxyUrl(targetUrl),
        {
          method: 'POST',
          headers,
          body,
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to send message: ${response.status} ${response.statusText}\n${errorText}`);
      }
    } catch (error) {
      console.error('Error sending message to topic:', error);
      throw error;
    }
  }

  async getDeadLetterMessages(queueOrTopicName: string, subscriptionName?: string): Promise<any[]> {
    try {
      const path = subscriptionName
        ? `${queueOrTopicName}/Subscriptions/${subscriptionName}/$DeadLetterQueue/messages/head`
        : `${queueOrTopicName}/$DeadLetterQueue/messages/head`;

      const resourcePath = subscriptionName
        ? `${queueOrTopicName}/Subscriptions/${subscriptionName}/$DeadLetterQueue`
        : `${queueOrTopicName}/$DeadLetterQueue`;

      const targetUrl = `${this.endpoint}/${path}?api-version=2021-05`;
      const response = await fetch(
        this.buildProxyUrl(targetUrl),
        {
          method: 'POST',
          headers: {
            'Authorization': this.getAuthHeader(resourcePath),
          },
        }
      );

      if (response.status === 204) {
        // No messages
        return [];
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch dead letter messages: ${response.status}`);
      }

      // Parse message from headers and body
      const body = await response.text();
      const message = {
        body,
        properties: {} as Record<string, string>,
      };

      // Extract properties from headers
      response.headers.forEach((value, key) => {
        message.properties[key] = value;
      });

      return [message];
    } catch (error) {
      console.error('Error fetching dead letter messages:', error);
      throw error;
    }
  }

  private parseQueuesFromXml(xml: string): Queue[] {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xml, 'text/xml');
    const entries = xmlDoc.getElementsByTagName('entry');

    const queues: Queue[] = [];

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const title = entry.getElementsByTagName('title')[0]?.textContent;

      if (title) {
        const content = entry.getElementsByTagName('content')[0];
        const queueDescription = content?.getElementsByTagName('QueueDescription')[0];

        let messageCount: number | undefined;
        let deadLetterCount: number | undefined;

        if (queueDescription) {
          const messageCountNode = queueDescription.getElementsByTagName('MessageCount')[0];
          const countDetails = queueDescription.getElementsByTagName('CountDetails')[0];

          if (messageCountNode) {
            messageCount = parseInt(messageCountNode.textContent || '0');
          }

          if (countDetails) {
            const deadLetterNode = countDetails.getElementsByTagName('DeadLetterMessageCount')[0];
            if (deadLetterNode) {
              deadLetterCount = parseInt(deadLetterNode.textContent || '0');
            }
          }
        }

        queues.push({
          name: title,
          messageCount,
          deadLetterMessageCount: deadLetterCount,
        });
      }
    }

    return queues;
  }

  private parseTopicsFromXml(xml: string): Topic[] {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xml, 'text/xml');
    const entries = xmlDoc.getElementsByTagName('entry');

    const topics: Topic[] = [];

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const title = entry.getElementsByTagName('title')[0]?.textContent;

      if (title) {
        topics.push({
          name: title,
        });
      }
    }

    return topics;
  }

  private parseSubscriptionsFromXml(xml: string): Subscription[] {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xml, 'text/xml');
    const entries = xmlDoc.getElementsByTagName('entry');

    const subscriptions: Subscription[] = [];

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const title = entry.getElementsByTagName('title')[0]?.textContent;

      if (title) {
        const content = entry.getElementsByTagName('content')[0];
        const subscriptionDescription = content?.getElementsByTagName('SubscriptionDescription')[0];

        let messageCount: number | undefined;
        let deadLetterCount: number | undefined;
        let correlationFilter: string | undefined;

        if (subscriptionDescription) {
          const messageCountNode = subscriptionDescription.getElementsByTagName('MessageCount')[0];
          const countDetails = subscriptionDescription.getElementsByTagName('CountDetails')[0];

          if (messageCountNode) {
            messageCount = parseInt(messageCountNode.textContent || '0');
          }

          if (countDetails) {
            const deadLetterNode = countDetails.getElementsByTagName('DeadLetterMessageCount')[0];
            if (deadLetterNode) {
              deadLetterCount = parseInt(deadLetterNode.textContent || '0');
            }
          }

          // Try to extract correlation filter from CorrelationFilter element
          const correlationFilterNode = subscriptionDescription.getElementsByTagName('CorrelationFilter')[0];
          if (correlationFilterNode) {
            // Try different possible tag names for the label/subject
            const labelNode = correlationFilterNode.getElementsByTagName('Label')[0] ||
                             correlationFilterNode.getElementsByTagName('d2p1:Label')[0];
            if (labelNode && labelNode.textContent) {
              correlationFilter = labelNode.textContent;
            }
          }
        }

        subscriptions.push({
          name: title,
          messageCount,
          deadLetterMessageCount: deadLetterCount,
          correlationFilter,
        });
      }
    }

    return subscriptions;
  }
}
