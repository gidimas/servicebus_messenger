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
}

export interface Topic {
  name: string;
  subscriptions?: Subscription[];
}

export interface Subscription {
  name: string;
  correlationFilter?: string;
}

export type PropertyType = 'string' | 'int' | 'long' | 'float' | 'double' | 'boolean' | 'guid' | 'datetime';

export interface MessageProperty {
  key: string;
  value: string;
  type: PropertyType;
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

export interface DeadLetterMessage {
  sequenceNumber: string;
  messageId?: string;
  subject?: string;
  contentType?: string;
  correlationId?: string;
  body: string;
  properties: MessageProperty[];
  enqueuedTime?: string;
  deadLetterReason?: string;
  deadLetterErrorDescription?: string;
}
