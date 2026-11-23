export interface AuthSession {
  idToken: string;
  accessToken: string;
  refreshToken?: string;
  email: string;
  name?: string;
  department: string;
  sub: string;
  exp: number;
  isDemo: boolean;
}

export interface AwsTempCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  expiration?: Date;
}

export type GarageAction = 'open' | 'close' | 'stop';
export type GarageState = 'open' | 'closed' | 'opening' | 'closing' | 'stopped' | 'unknown';

export interface NormalizedBuildingState {
  lightOn: boolean;
  garageState: GarageState;
  garageMoving: boolean;
  doorOpen: boolean;
  alarmActive: boolean;
  temperature?: number;
  humidity?: number;
  updatedAt?: string;
  desired: Record<string, unknown>;
  reported: Record<string, unknown>;
  raw: Record<string, unknown>;
}

export interface CameraStreamResponse {
  hlsUrl: string;
  expiresIn: number;
  fetchedAt: number;
  isDemo?: boolean;
}

export interface CameraSnapshot {
  id: string;
  url: string;
  key?: string;
  timestamp?: string;
  label?: string;
}

export interface CameraStatus {
  online: boolean;
  streaming: boolean;
  fps?: number;
  resolution?: string;
  lastSeen?: string;
  raw?: Record<string, unknown>;
}

export interface UserProfile {
  name: string;
  email?: string;
  departmentId: string;
  userId?: string;
  updatedAt?: string;
}

export interface RfidCard {
  cardUid: string;
  label: string;
  departmentId?: string;
  createdAt?: string;
}

export interface BuildingEvent {
  id: string;
  type: string;
  message: string;
  timestamp: string;
  departmentId?: string;
  severity: 'info' | 'warning' | 'critical';
  source: 'http' | 'mqtt';
  raw?: Record<string, unknown>;
}

export type MqttConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error'
  | 'demo';

export interface MqttMessageEnvelope {
  topic: string;
  payload: Record<string, unknown>;
  receivedAt: string;
}
