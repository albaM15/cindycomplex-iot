export type AppEnv = 'dev' | 'qa' | 'prod';

const rawEnv = (import.meta.env.VITE_ENV || 'dev').toLowerCase();
const env: AppEnv = rawEnv === 'qa' || rawEnv === 'prod' ? rawEnv : 'dev';

export const config = {
  env,
  region: (import.meta.env.VITE_AWS_REGION || 'us-east-1').trim(),
  userPoolId: (import.meta.env.VITE_USER_POOL_ID || '').trim(),
  userPoolClientId: (import.meta.env.VITE_USER_POOL_CLIENT_ID || '').trim(),
  identityPoolId: (import.meta.env.VITE_IDENTITY_POOL_ID || '').trim(),
  apiUrl: (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, ''),
  iotEndpoint: (import.meta.env.VITE_IOT_ENDPOINT || '')
    .trim()
    .replace(/^wss?:\/\//, '')
    .replace(/\/.*$/, ''),
  forceDemoMode: import.meta.env.VITE_DEMO_MODE === 'true',
} as const;

export const mqttTopics = {
  events: `building/${config.env}/events`,
  telemetry: `building/${config.env}/telemetry`,
  cameraStatus: `building/${config.env}/camera/status`,
  wildcard: `building/${config.env}/#`,
} as const;

export function isAwsConfigured(): boolean {
  return Boolean(config.userPoolId && config.userPoolClientId && config.apiUrl);
}

export function isMqttConfigured(): boolean {
  return Boolean(config.identityPoolId && config.iotEndpoint && isAwsConfigured());
}

export function getMissingAwsFields(): string[] {
  const missing: string[] = [];
  if (!config.userPoolId) missing.push('VITE_USER_POOL_ID');
  if (!config.userPoolClientId) missing.push('VITE_USER_POOL_CLIENT_ID');
  if (!config.identityPoolId) missing.push('VITE_IDENTITY_POOL_ID');
  if (!config.apiUrl) missing.push('VITE_API_URL');
  if (!config.iotEndpoint) missing.push('VITE_IOT_ENDPOINT');
  return missing;
}
