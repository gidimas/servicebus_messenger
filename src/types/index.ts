export interface ConnectionString {
  id: string;
  name: string;
  connectionString: string;
  endpoint: string;
  keyName: string;
  keyValue: string;
}

export interface SASToken {
  token: string;
  expiresAt: number;
}

export interface Queue {
  name: string;
  messageCount?: number;
  deadLetterMessageCount?: number;
}

export interface Topic {
  name: string;
  subscriptions?: Subscription[];
}

export interface Subscription {
  name: string;
  messageCount?: number;
  deadLetterMessageCount?: number;
  correlationFilter?: string;
}

export interface MessageProperty {
  key: string;
  value: string;
}

export interface Message {
  id: string;
  body: string;
  properties: MessageProperty[];
  subject?: string;
  contentType?: string;
  correlationId?: string;
  messageId?: string;
  sentAt: number;
  destination: string;
  destinationType: 'queue' | 'topic';
  subscriptionName?: string;
}

export interface ConnectionStatus {
  isConnected: boolean;
  lastChecked: number;
}
