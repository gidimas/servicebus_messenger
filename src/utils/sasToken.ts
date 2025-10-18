import CryptoJS from 'crypto-js';
import type { ConnectionString, SASToken } from '../types';

export function parseConnectionString(connectionString: string): Omit<ConnectionString, 'id' | 'name'> | null {
  try {
    const parts = connectionString.split(';').reduce((acc, part) => {
      const [key, ...valueParts] = part.split('=');
      const value = valueParts.join('=');
      if (key && value) {
        acc[key.trim()] = value.trim();
      }
      return acc;
    }, {} as Record<string, string>);

    const endpoint = parts['Endpoint'];
    const keyName = parts['SharedAccessKeyName'];
    const keyValue = parts['SharedAccessKey'];

    if (!endpoint || !keyName || !keyValue) {
      return null;
    }

    return {
      connectionString,
      endpoint,
      keyName,
      keyValue,
    };
  } catch (error) {
    console.error('Error parsing connection string:', error);
    return null;
  }
}

export function generateSASToken(
  endpoint: string,
  keyName: string,
  keyValue: string,
  expiryInMinutes: number = 60
): SASToken {
  // Remove protocol from endpoint
  const uri = endpoint.replace('sb://', '').replace(/\/$/, '');

  // Calculate expiry time
  const expiresAt = Math.floor(Date.now() / 1000) + (expiryInMinutes * 60);

  // Create string to sign
  const stringToSign = encodeURIComponent(uri) + '\n' + expiresAt;

  // Create signature using HMAC-SHA256
  const hash = CryptoJS.HmacSHA256(stringToSign, keyValue);
  const signature = encodeURIComponent(CryptoJS.enc.Base64.stringify(hash));

  // Build token
  const token = `SharedAccessSignature sr=${encodeURIComponent(uri)}&sig=${signature}&se=${expiresAt}&skn=${keyName}`;

  return {
    token,
    expiresAt: expiresAt * 1000, // Convert to milliseconds
  };
}

export function generateResourceSASToken(
  endpoint: string,
  resourcePath: string,
  keyName: string,
  keyValue: string,
  expiryInMinutes: number = 60
): SASToken {
  // Remove protocol from endpoint and combine with resource path
  const baseUri = endpoint.replace('sb://', '').replace(/\/$/, '');
  const uri = `${baseUri}/${resourcePath}`;

  // Calculate expiry time
  const expiresAt = Math.floor(Date.now() / 1000) + (expiryInMinutes * 60);

  // Create string to sign
  const stringToSign = encodeURIComponent(uri) + '\n' + expiresAt;

  // Create signature using HMAC-SHA256
  const hash = CryptoJS.HmacSHA256(stringToSign, keyValue);
  const signature = encodeURIComponent(CryptoJS.enc.Base64.stringify(hash));

  // Build token
  const token = `SharedAccessSignature sr=${encodeURIComponent(uri)}&sig=${signature}&se=${expiresAt}&skn=${keyName}`;

  return {
    token,
    expiresAt: expiresAt * 1000, // Convert to milliseconds
  };
}

export function isSASTokenExpired(token: SASToken): boolean {
  return Date.now() >= token.expiresAt;
}
