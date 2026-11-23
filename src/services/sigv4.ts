import type { AwsTempCredentials } from '../types';

const EMPTY_PAYLOAD_SHA256 =
  'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

const encoder = new TextEncoder();

function toHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

async function sha256Hex(message: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', encoder.encode(message));
  return toHex(hash);
}

async function hmacSha256(
  key: ArrayBuffer | Uint8Array,
  message: string
): Promise<ArrayBuffer> {
  const keyBytes = key instanceof Uint8Array ? key : new Uint8Array(key);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes.buffer.slice(keyBytes.byteOffset, keyBytes.byteOffset + keyBytes.byteLength) as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message));
}

function formatAmzDate(date: Date): { amzDate: string; dateStamp: string } {
  const iso = date.toISOString().replace(/[:-]|\.\d{3}/g, '');
  return {
    amzDate: iso,
    dateStamp: iso.slice(0, 8),
  };
}

/**
 * Generates an AWS SigV4 presigned WebSocket URL for AWS IoT Core MQTT over WSS.
 * Spec: wss://<iot-ats-endpoint>:443/mqtt
 * Note: Per AWS IoT Core docs, X-Amz-Security-Token is appended AFTER signing.
 */
export async function createIoTSigV4Url(params: {
  endpoint: string;
  region: string;
  credentials: AwsTempCredentials;
  now?: Date;
}): Promise<string> {
  const { endpoint, region, credentials, now = new Date() } = params;
  const service = 'iotdevicegateway';
  const algorithm = 'AWS4-HMAC-SHA256';
  const { amzDate, dateStamp } = formatAmzDate(now);
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;

  const canonicalQuerystring = [
    `X-Amz-Algorithm=${algorithm}`,
    `X-Amz-Credential=${encodeURIComponent(`${credentials.accessKeyId}/${credentialScope}`)}`,
    `X-Amz-Date=${amzDate}`,
    `X-Amz-SignedHeaders=host`,
  ].join('&');

  const canonicalHeaders = `host:${endpoint}\n`;
  const canonicalRequest = [
    'GET',
    '/mqtt',
    canonicalQuerystring,
    canonicalHeaders,
    'host',
    EMPTY_PAYLOAD_SHA256,
  ].join('\n');

  const canonicalRequestHash = await sha256Hex(canonicalRequest);
  const stringToSign = [
    algorithm,
    amzDate,
    credentialScope,
    canonicalRequestHash,
  ].join('\n');

  const kDate = await hmacSha256(encoder.encode(`AWS4${credentials.secretAccessKey}`), dateStamp);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  const kSigning = await hmacSha256(kService, 'aws4_request');
  const signature = toHex(await hmacSha256(kSigning, stringToSign));

  let url = `wss://${endpoint}:443/mqtt?${canonicalQuerystring}&X-Amz-Signature=${signature}`;
  if (credentials.sessionToken) {
    url += `&X-Amz-Security-Token=${encodeURIComponent(credentials.sessionToken)}`;
  }
  return url;
}
