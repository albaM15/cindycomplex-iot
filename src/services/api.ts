import { config } from '../config';
import type {
  AuthSession,
  BuildingEvent,
  CameraSnapshot,
  CameraStreamResponse,
  GarageAction,
  GarageState,
  NormalizedBuildingState,
  RfidCard,
  UserProfile,
} from '../types';
import { getFreshIdToken } from './cognito';
import { demoBackend } from './demoBackend';

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

async function request<T>(
  session: AuthSession,
  path: string,
  init: RequestInit = {}
): Promise<T> {
  if (!config.apiUrl) {
    throw new ApiError('VITE_API_URL no está configurado.', 500);
  }

  let token = session.idToken;
  // Refresh ID token automatically if expiring within 60 seconds
  if (!session.isDemo && session.exp * 1000 - Date.now() < 60_000) {
    token = await getFreshIdToken();
  }

  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${config.apiUrl}${path}`, {
    ...init,
    headers,
  });

  const text = await response.text();
  let data: unknown = undefined;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    const serverMsg =
      typeof data === 'object' && data !== null
        ? (data as Record<string, unknown>).message ??
          (data as Record<string, unknown>).error ??
          response.statusText
        : typeof data === 'string' && data
        ? data
        : response.statusText;

    throw new ApiError(String(serverMsg || `HTTP ${response.status}`), response.status, data);
  }

  return data as T;
}

export function normalizeShadowState(
  raw: Record<string, unknown>,
  department: string
): NormalizedBuildingState {
  const shadowObj =
    typeof raw.state === 'object' && raw.state !== null
      ? (raw.state as Record<string, unknown>)
      : raw;

  const reported =
    typeof shadowObj.reported === 'object' && shadowObj.reported !== null
      ? (shadowObj.reported as Record<string, unknown>)
      : shadowObj;

  const desired =
    typeof shadowObj.desired === 'object' && shadowObj.desired !== null
      ? (shadowObj.desired as Record<string, unknown>)
      : {};

  // Extract department light across common shadow schemas:
  // lights: { "201": true } | lights: { dept201: true } | light_201: true | light: true
  let lightOn = false;
  const lightsMap = reported.lights;
  if (typeof lightsMap === 'object' && lightsMap !== null) {
    const map = lightsMap as Record<string, unknown>;
    const val = map[department] ?? map[`dept_${department}`] ?? map[`dpto_${department}`];
    if (typeof val === 'boolean') lightOn = val;
    else if (typeof val === 'string') lightOn = val.toLowerCase() === 'on' || val === 'true';
    else if (typeof val === 'number') lightOn = val === 1;
  } else if (typeof reported[`light_${department}`] === 'boolean') {
    lightOn = Boolean(reported[`light_${department}`]);
  } else if (typeof reported.light === 'boolean') {
    lightOn = reported.light;
  }

  // Extract garage state
  const rawGarage = String(
    reported.garage ?? reported.garageState ?? reported.garage_state ?? 'unknown'
  ).toLowerCase();
  const garageState: GarageState =
    rawGarage === 'open' ||
    rawGarage === 'closed' ||
    rawGarage === 'opening' ||
    rawGarage === 'closing' ||
    rawGarage === 'stopped'
      ? rawGarage
      : 'unknown';

  const garageMoving =
    garageState === 'opening' ||
    garageState === 'closing' ||
    Boolean(reported.garageMoving ?? reported.garage_moving);

  // Extract door state
  const rawDoor = reported.door ?? reported.mainDoor ?? reported.doorState;
  const doorOpen =
    rawDoor === true || String(rawDoor ?? '').toLowerCase() === 'open';

  // Extract alarm state
  const rawAlarm = reported.alarm ?? reported.alarmActive ?? reported.alarm_state;
  const alarmActive =
    rawAlarm === true ||
    String(rawAlarm ?? '').toLowerCase() === 'active' ||
    String(rawAlarm ?? '').toLowerCase() === 'triggered' ||
    String(rawAlarm ?? '').toLowerCase() === 'on';

  const temperature =
    typeof reported.temperature === 'number'
      ? reported.temperature
      : typeof reported.temp === 'number'
      ? reported.temp
      : undefined;

  const humidity =
    typeof reported.humidity === 'number' ? reported.humidity : undefined;

  const updatedAt =
    typeof reported.updatedAt === 'string'
      ? reported.updatedAt
      : typeof raw.timestamp === 'number'
      ? new Date(raw.timestamp * 1000).toISOString()
      : undefined;

  return {
    lightOn,
    garageState,
    garageMoving,
    doorOpen,
    alarmActive,
    temperature,
    humidity,
    updatedAt,
    desired,
    reported,
    raw,
  };
}

function normalizeSnapshots(raw: unknown): CameraSnapshot[] {
  const list = Array.isArray(raw)
    ? raw
    : typeof raw === 'object' && raw !== null
    ? ((raw as Record<string, unknown>).snapshots ??
        (raw as Record<string, unknown>).items ??
        [])
    : [];

  if (!Array.isArray(list)) return [];

  return list
    .map((item, idx): CameraSnapshot | null => {
      if (typeof item === 'string') {
        return { id: `snap-${idx}`, url: item };
      }
      if (typeof item !== 'object' || item === null) return null;
      const obj = item as Record<string, unknown>;
      const url = String(obj.url ?? obj.presignedUrl ?? obj.signedUrl ?? '');
      if (!url) return null;
      return {
        id: String(obj.id ?? obj.key ?? `snap-${idx}`),
        url,
        key: typeof obj.key === 'string' ? obj.key : undefined,
        timestamp:
          typeof obj.timestamp === 'string'
            ? obj.timestamp
            : typeof obj.lastModified === 'string'
            ? obj.lastModified
            : undefined,
        label: typeof obj.label === 'string' ? obj.label : undefined,
      };
    })
    .filter((x): x is CameraSnapshot => x !== null);
}

function normalizeRfidCards(raw: unknown): RfidCard[] {
  const list = Array.isArray(raw)
    ? raw
    : typeof raw === 'object' && raw !== null
    ? ((raw as Record<string, unknown>).cards ??
        (raw as Record<string, unknown>).items ??
        [])
    : [];

  if (!Array.isArray(list)) return [];

  return list
    .map((item): RfidCard | null => {
      if (typeof item !== 'object' || item === null) return null;
      const obj = item as Record<string, unknown>;
      const cardUid = String(obj.cardUid ?? obj.uid ?? obj.id ?? '');
      if (!cardUid) return null;
      return {
        cardUid,
        label: String(obj.label ?? obj.name ?? 'Sin etiqueta'),
        departmentId:
          typeof obj.departmentId === 'string'
            ? obj.departmentId
            : typeof obj.department === 'string'
            ? obj.department
            : undefined,
        createdAt: typeof obj.createdAt === 'string' ? obj.createdAt : undefined,
      };
    })
    .filter((x): x is RfidCard => x !== null);
}

export function normalizeEventItem(
  item: Record<string, unknown>,
  source: 'http' | 'mqtt',
  fallbackIndex = 0
): BuildingEvent {
  const type = String(item.type ?? item.eventType ?? item.event ?? 'EVENT');
  const upperType = type.toUpperCase();
  let severity: 'info' | 'warning' | 'critical' = 'info';
  if (
    item.severity === 'critical' ||
    upperType.includes('ALARM') ||
    upperType.includes('FORCED') ||
    upperType.includes('ALERT') ||
    upperType.includes('DENIED')
  ) {
    severity = 'critical';
  } else if (
    item.severity === 'warning' ||
    upperType.includes('WARN') ||
    upperType.includes('STOP') ||
    upperType.includes('DELETE')
  ) {
    severity = 'warning';
  }

  const message = String(
    item.message ??
      item.description ??
      item.detail ??
      `${type}${item.cardUid ? ` · UID ${String(item.cardUid)}` : ''}`
  );

  const rawTs = item.timestamp ?? item.createdAt ?? item.ts;
  let timestamp: string;
  if (typeof rawTs === 'number') {
    timestamp = new Date(rawTs > 1e12 ? rawTs : rawTs * 1000).toISOString();
  } else if (typeof rawTs === 'string' && rawTs) {
    timestamp = rawTs;
  } else {
    timestamp = new Date().toISOString();
  }

  return {
    id: String(item.id ?? item.eventId ?? `${source}-${timestamp}-${fallbackIndex}`),
    type,
    message,
    timestamp,
    departmentId:
      typeof item.departmentId === 'string'
        ? item.departmentId
        : typeof item.department === 'string'
        ? item.department
        : undefined,
    severity,
    source,
    raw: item,
  };
}

function normalizeEvents(raw: unknown): BuildingEvent[] {
  const list = Array.isArray(raw)
    ? raw
    : typeof raw === 'object' && raw !== null
    ? ((raw as Record<string, unknown>).events ??
        (raw as Record<string, unknown>).items ??
        [])
    : [];

  if (!Array.isArray(list)) return [];

  return list
    .filter((x): x is Record<string, unknown> => typeof x === 'object' && x !== null)
    .map((item, idx) => normalizeEventItem(item, 'http', idx));
}

export function createApiClient(session: AuthSession) {
  return {
    async getState(): Promise<NormalizedBuildingState> {
      const raw = session.isDemo
        ? await demoBackend.getState()
        : await request<Record<string, unknown>>(session, '/state');
      return normalizeShadowState(raw, session.department);
    },

    async setLights(state: boolean): Promise<void> {
      if (session.isDemo) {
        await demoBackend.setLights(state);
        return;
      }
      await request(session, '/commands/lights', {
        method: 'POST',
        body: JSON.stringify({ state }),
      });
    },

    async sendGarageCommand(action: GarageAction): Promise<void> {
      if (session.isDemo) {
        try {
          await demoBackend.sendGarageCommand(action);
        } catch (err) {
          const status = (err as { status?: number }).status ?? 500;
          throw new ApiError(
            err instanceof Error ? err.message : 'Conflicto en cochera',
            status
          );
        }
        return;
      }
      await request(session, '/commands/garage', {
        method: 'POST',
        body: JSON.stringify({ action }),
      });
    },

    async openMainDoor(): Promise<void> {
      if (session.isDemo) {
        await demoBackend.openMainDoor();
        return;
      }
      await request(session, '/commands/door', {
        method: 'POST',
        body: JSON.stringify({ action: 'open' }),
      });
    },

    async silenceAlarm(): Promise<void> {
      if (session.isDemo) {
        await demoBackend.silenceAlarm();
        return;
      }
      await request(session, '/commands/alarm', {
        method: 'POST',
        body: JSON.stringify({ action: 'silence' }),
      });
    },

    async getCameraStream(): Promise<CameraStreamResponse> {
      if (session.isDemo) {
        return demoBackend.getCameraStream();
      }
      const data = await request<{ hlsUrl: string; expiresIn?: number }>(
        session,
        '/camera/stream'
      );
      return {
        hlsUrl: data.hlsUrl,
        expiresIn: data.expiresIn ?? 300,
        fetchedAt: Date.now(),
      };
    },

    async getCameraSnapshots(): Promise<CameraSnapshot[]> {
      if (session.isDemo) {
        return demoBackend.getCameraSnapshots();
      }
      const data = await request<unknown>(session, '/camera/snapshots');
      return normalizeSnapshots(data);
    },

    async getMe(): Promise<UserProfile> {
      if (session.isDemo) {
        return demoBackend.getMe();
      }
      const data = await request<Record<string, unknown>>(session, '/me');
      return {
        name: String(data.name ?? ''),
        email: typeof data.email === 'string' ? data.email : session.email,
        departmentId: String(data.departmentId ?? data.department ?? session.department),
        userId: typeof data.userId === 'string' ? data.userId : session.sub,
        updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : undefined,
      };
    },

    async updateMe(name: string): Promise<UserProfile> {
      if (session.isDemo) {
        return demoBackend.updateMe(name);
      }
      // Strictly send ONLY { name } — never departmentId (API returns 403 otherwise)
      const data = await request<Record<string, unknown>>(session, '/me', {
        method: 'PUT',
        body: JSON.stringify({ name: name.trim() }),
      });
      return {
        name: String(data.name ?? name.trim()),
        email: typeof data.email === 'string' ? data.email : session.email,
        departmentId: String(data.departmentId ?? data.department ?? session.department),
        userId: typeof data.userId === 'string' ? data.userId : session.sub,
        updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : new Date().toISOString(),
      };
    },

    async getRfidCards(): Promise<RfidCard[]> {
      if (session.isDemo) {
        return demoBackend.getRfidCards();
      }
      const data = await request<unknown>(session, '/rfid-cards');
      return normalizeRfidCards(data);
    },

    async createRfidCard(cardUid: string, label: string): Promise<RfidCard> {
      if (session.isDemo) {
        try {
          return await demoBackend.createRfidCard(cardUid, label);
        } catch (err) {
          const status = (err as { status?: number }).status ?? 500;
          throw new ApiError(
            err instanceof Error ? err.message : 'Error registrando tarjeta',
            status
          );
        }
      }
      const data = await request<Record<string, unknown>>(session, '/rfid-cards', {
        method: 'POST',
        body: JSON.stringify({
          cardUid: cardUid.trim().toUpperCase(),
          label: label.trim(),
        }),
      });
      return {
        cardUid: String(data.cardUid ?? cardUid.trim().toUpperCase()),
        label: String(data.label ?? label.trim()),
        departmentId: String(data.departmentId ?? session.department),
        createdAt: typeof data.createdAt === 'string' ? data.createdAt : new Date().toISOString(),
      };
    },

    async deleteRfidCard(cardUid: string): Promise<void> {
      if (session.isDemo) {
        await demoBackend.deleteRfidCard(cardUid);
        return;
      }
      await request(session, `/rfid-cards/${encodeURIComponent(cardUid)}`, {
        method: 'DELETE',
      });
    },

    async getEvents(): Promise<BuildingEvent[]> {
      if (session.isDemo) {
        return demoBackend.getEvents();
      }
      const data = await request<unknown>(session, '/events');
      return normalizeEvents(data);
    },
  };
}
