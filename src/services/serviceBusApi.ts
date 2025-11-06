import { generateResourceSASToken, generateSASToken } from '../utils/sasToken';
import type { Queue, Topic, Subscription, MessageProperty, PropertyType, DeadLetterMessage } from '../types';

export class ServiceBusAPI {
  private endpoint: string;
  private keyName: string;
  private keyValue: string;
  private proxyUrl: string = 'http://localhost:3001';
  private queuesCache: { data: Queue[] | null; timestamp: number } = { data: null, timestamp: 0 };
  private topicsCache: { data: Topic[] | null; timestamp: number } = { data: null, timestamp: 0 };
  private cacheDuration: number = 5 * 60 * 1000; // 5 minutes

  constructor(endpoint: string, keyName: string, keyValue: string) {
    this.endpoint = endpoint.replace('sb://', 'https://').replace(/\/$/, '');
    this.keyName = keyName;
    this.keyValue = keyValue;
  }

  private formatPropertyValue(value: string, type: PropertyType): string {
    switch (type) {
      case 'int':
      case 'long':
      case 'float':
      case 'double':
        return value;
      case 'boolean':
        return value.toLowerCase() === 'true' ? 'true' : 'false';
      case 'guid':
      case 'string':
      case 'datetime':
      default:
        return value;
    }
  }

  private getPropertyTypeHeader(type: PropertyType): string {
    switch (type) {
      case 'int':
        return 'Edm.Int32';
      case 'long':
        return 'Edm.Int64';
      case 'float':
        return 'Edm.Single';
      case 'double':
        return 'Edm.Double';
      case 'boolean':
        return 'Edm.Boolean';
      case 'guid':
        return 'Edm.Guid';
      case 'datetime':
        return 'Edm.DateTime';
      case 'string':
      default:
        return 'Edm.String';
    }
  }

  private sanitizeHeaderName(name: string): string {
    // Remove or replace invalid characters for HTTP header names
    // Valid characters: alphanumeric, -, and _
    return name.replace(/[^a-zA-Z0-9\-_]/g, '-');
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

  async getQueues(forceRefresh = false): Promise<Queue[]> {
    // Check cache if not forcing refresh
    if (!forceRefresh && this.queuesCache.data && (Date.now() - this.queuesCache.timestamp) < this.cacheDuration) {
      return this.queuesCache.data;
    }

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
      const queues = this.parseQueuesFromXml(text);

      // Update cache
      this.queuesCache = { data: queues, timestamp: Date.now() };

      return queues;
    } catch (error) {
      console.error('Error fetching queues:', error);
      throw error;
    }
  }

  async getTopics(forceRefresh = false): Promise<Topic[]> {
    // Check cache if not forcing refresh
    if (!forceRefresh && this.topicsCache.data && (Date.now() - this.topicsCache.timestamp) < this.cacheDuration) {
      return this.topicsCache.data;
    }

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
      const topics = this.parseTopicsFromXml(text);

      // Update cache
      this.topicsCache = { data: topics, timestamp: Date.now() };

      return topics;
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

  async getSubscriptionCorrelationFilter(topicName: string, subscriptionName: string): Promise<string | undefined> {
    try {
      const targetUrl = `${this.endpoint}/${topicName}/Subscriptions/${subscriptionName}/Rules?api-version=2021-05`;
      const response = await fetch(
        this.buildProxyUrl(targetUrl),
        {
          method: 'GET',
          headers: {
            'Authorization': this.getAuthHeader(`${topicName}/Subscriptions/${subscriptionName}/Rules`),
            'Content-Type': 'application/atom+xml;type=feed;charset=utf-8',
          },
        }
      );

      if (!response.ok) {
        return undefined;
      }

      const text = await response.text();
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(text, 'text/xml');

      // Look for CorrelationFilter with Label property
      const entries = xmlDoc.getElementsByTagName('entry');
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const content = entry.getElementsByTagName('content')[0];
        const ruleDescription = content?.getElementsByTagName('RuleDescription')[0];

        if (ruleDescription) {
          const filter = ruleDescription.getElementsByTagName('Filter')[0];
          if (filter) {
            // Try to find Label in CorrelationFilter
            const labelElements = filter.getElementsByTagName('Label');
            for (let j = 0; j < labelElements.length; j++) {
              const label = labelElements[j].textContent?.trim();
              if (label) {
                return label;
              }
            }
          }
        }
      }

      return undefined;
    } catch (error) {
      return undefined;
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

      // Build BrokerProperties as JSON object
      const brokerProps: Record<string, any> = {};

      if (messageProperties?.subject) {
        brokerProps['Label'] = messageProperties.subject;
      }

      if (messageProperties?.correlationId) {
        brokerProps['CorrelationId'] = messageProperties.correlationId;
      }

      if (messageProperties?.messageId) {
        brokerProps['MessageId'] = messageProperties.messageId;
      }

      // Add BrokerProperties header if we have any broker properties
      if (Object.keys(brokerProps).length > 0) {
        headers['BrokerProperties'] = JSON.stringify(brokerProps);
      }

      // Add custom properties as individual headers
      if (properties) {
        properties.forEach(prop => {
          const formattedValue = this.formatPropertyValue(prop.value, prop.type);
          // Sanitize property key for use in header name
          const sanitizedKey = this.sanitizeHeaderName(prop.key);
          headers[sanitizedKey] = formattedValue;
          // Add type header for non-string types
          if (prop.type !== 'string') {
            headers[`${sanitizedKey}-Type`] = this.getPropertyTypeHeader(prop.type);
          }
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

      // Build BrokerProperties as JSON object
      const brokerProps: Record<string, any> = {};

      if (messageProperties?.subject) {
        brokerProps['Label'] = messageProperties.subject;
      }

      if (messageProperties?.correlationId) {
        brokerProps['CorrelationId'] = messageProperties.correlationId;
      }

      if (messageProperties?.messageId) {
        brokerProps['MessageId'] = messageProperties.messageId;
      }

      // Add BrokerProperties header if we have any broker properties
      if (Object.keys(brokerProps).length > 0) {
        headers['BrokerProperties'] = JSON.stringify(brokerProps);
      }

      // Add custom properties as individual headers
      if (properties) {
        properties.forEach(prop => {
          const formattedValue = this.formatPropertyValue(prop.value, prop.type);
          // Sanitize property key for use in header name
          const sanitizedKey = this.sanitizeHeaderName(prop.key);
          headers[sanitizedKey] = formattedValue;
          // Add type header for non-string types
          if (prop.type !== 'string') {
            headers[`${sanitizedKey}-Type`] = this.getPropertyTypeHeader(prop.type);
          }
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

  async getDeadLetterMessages(topicName: string, subscriptionName: string): Promise<DeadLetterMessage[]> {
    try {
      const path = `${topicName}/Subscriptions/${subscriptionName}/$DeadLetterQueue/messages/head`;
      const targetUrl = `${this.endpoint}/${path}?api-version=2021-05&timeout=5`;

      const response = await fetch(
        this.buildProxyUrl(targetUrl),
        {
          method: 'POST',
          headers: {
            'Authorization': this.getAuthHeader(path),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ maxMessageCount: 100 })
        }
      );

      if (!response.ok) {
        if (response.status === 204) {
          // No messages in dead letter queue
          return [];
        }
        throw new Error(`Failed to fetch dead letters: ${response.status} ${response.statusText}`);
      }

      const messages: DeadLetterMessage[] = [];
      const brokerProperties = response.headers.get('brokerproperties');
      const body = await response.text();

      if (brokerProperties && body) {
        const props = JSON.parse(brokerProperties);
        const message = this.parseDeadLetterMessage(props, body, response.headers);
        if (message) {
          messages.push(message);
        }
      }

      return messages;
    } catch (error) {
      console.error('Error fetching dead letter messages:', error);
      throw error;
    }
  }

  async deleteDeadLetterMessage(
    topicName: string,
    subscriptionName: string,
    sequenceNumber: string,
    lockToken: string
  ): Promise<void> {
    try {
      const path = `${topicName}/Subscriptions/${subscriptionName}/$DeadLetterQueue/messages/${sequenceNumber}/${lockToken}`;
      const targetUrl = `${this.endpoint}/${path}?api-version=2021-05`;

      const response = await fetch(
        this.buildProxyUrl(targetUrl),
        {
          method: 'DELETE',
          headers: {
            'Authorization': this.getAuthHeader(path),
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to delete dead letter: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error deleting dead letter message:', error);
      throw error;
    }
  }

  private parseDeadLetterMessage(
    brokerProps: any,
    body: string,
    headers: Headers
  ): DeadLetterMessage | null {
    try {
      const properties: MessageProperty[] = [];

      // Parse custom properties from headers
      headers.forEach((value, key) => {
        if (!key.startsWith('broker') &&
            !key.startsWith('content') &&
            !key.startsWith('authorization') &&
            key !== 'date' &&
            key !== 'server' &&
            key !== 'transfer-encoding') {
          properties.push({
            key,
            value,
            type: 'string'
          });
        }
      });

      return {
        sequenceNumber: brokerProps.SequenceNumber?.toString() || '',
        messageId: brokerProps.MessageId,
        subject: brokerProps.Label,
        contentType: headers.get('content-type') || undefined,
        correlationId: brokerProps.CorrelationId,
        body,
        properties,
        enqueuedTime: brokerProps.EnqueuedTimeUtc,
        deadLetterReason: brokerProps.DeadLetterReason,
        deadLetterErrorDescription: brokerProps.DeadLetterErrorDescription,
      };
    } catch (error) {
      console.error('Error parsing dead letter message:', error);
      return null;
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
        queues.push({
          name: title,
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
        subscriptions.push({
          name: title,
        });
      }
    }

    return subscriptions;
  }
}
