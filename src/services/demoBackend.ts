import { mqttTopics } from '../config';
import type {
  BuildingEvent,
  CameraSnapshot,
  CameraStatus,
  CameraStreamResponse,
  GarageAction,
  GarageState,
  MqttMessageEnvelope,
  RfidCard,
  UserProfile,
} from '../types';

type DemoMqttListener = (msg: MqttMessageEnvelope) => void;

const listeners = new Set<DemoMqttListener>();

function makeSnapshotSvg(title: string, timestamp: string, scene: 'entry' | 'garage' | 'hall'): string {
  const accent = scene === 'entry' ? '#0F5C4D' : scene === 'garage' ? '#B45309' : '#334155';
  const grid =
    scene === 'entry'
      ? '<rect x="110" y="65" width="180" height="140" fill="none" stroke="#DEDBD2" stroke-width="2"/><line x1="200" y1="65" x2="200" y2="205" stroke="#DEDBD2" stroke-width="2"/><circle cx="185" cy="138" r="4" fill="' + accent + '"/>'
      : scene === 'garage'
      ? '<rect x="70" y="80" width="260" height="120" fill="none" stroke="#DEDBD2" stroke-width="2"/><line x1="70" y1="104" x2="330" y2="104" stroke="#DEDBD2"/><line x1="70" y1="128" x2="330" y2="128" stroke="#DEDBD2"/><line x1="70" y1="152" x2="330" y2="152" stroke="#DEDBD2"/><line x1="70" y1="176" x2="330" y2="176" stroke="#DEDBD2"/>'
      : '<path d="M70 205 L155 110 L245 110 L330 205" fill="none" stroke="#DEDBD2" stroke-width="2"/><rect x="155" y="70" width="90" height="40" fill="none" stroke="#DEDBD2" stroke-width="2"/>';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 240">
    <rect width="400" height="240" fill="#1C1B18"/>
    <rect x="16" y="16" width="368" height="208" fill="#252420" stroke="#3A3832" stroke-width="1"/>
    ${grid}
    <circle cx="34" cy="34" r="5" fill="${accent}"/>
    <text x="48" y="38" fill="#F5F4F0" font-family="ui-monospace, monospace" font-size="11" letter-spacing="0.06em">ESP32-CAM · ${title}</text>
    <text x="366" y="210" text-anchor="end" fill="#A6A39A" font-family="ui-monospace, monospace" font-size="10">${timestamp}</text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

interface DemoState {
  department: string;
  lights: Record<string, boolean>;
  garage: GarageState;
  garageTimer: number | null;
  doorOpen: boolean;
  doorTimer: number | null;
  alarmActive: boolean;
  temperature: number;
  humidity: number;
  profile: UserProfile;
  rfidCards: RfidCard[];
  events: BuildingEvent[];
  cameraStatus: CameraStatus;
  snapshots: CameraSnapshot[];
}

const now = Date.now();

const state: DemoState = {
  department: '201',
  lights: { '201': true, '301': false, '401': true },
  garage: 'closed',
  garageTimer: null,
  doorOpen: false,
  doorTimer: null,
  alarmActive: false,
  temperature: 22.4,
  humidity: 48,
  profile: {
    name: 'Residente Demo',
    email: 'huesped@smarthotel.local',
    departmentId: '201',
    userId: 'demo-user-001',
    updatedAt: new Date(now - 3600_000).toISOString(),
  },
  rfidCards: [
    {
      cardUid: 'A1B2C3D4',
      label: 'Tarjeta Principal',
      departmentId: '201',
      createdAt: new Date(now - 86400_000 * 6).toISOString(),
    },
    {
      cardUid: 'F9E8D7C6',
      label: 'Llavero Acceso Rápido',
      departmentId: '201',
      createdAt: new Date(now - 86400_000 * 2).toISOString(),
    },
  ],
  events: [
    {
      id: 'evt-1',
      type: 'RFID_ACCESS_GRANTED',
      message: 'Ingreso en puerta principal con “Tarjeta Principal”',
      timestamp: new Date(now - 1000 * 60 * 4).toISOString(),
      departmentId: '201',
      severity: 'info',
      source: 'http',
    },
    {
      id: 'evt-2',
      type: 'GARAGE_CLOSED',
      message: 'Portón de cochera cerrado',
      timestamp: new Date(now - 1000 * 60 * 18).toISOString(),
      severity: 'info',
      source: 'http',
    },
    {
      id: 'evt-3',
      type: 'DOOR_FORCED_WARNING',
      message: 'La puerta principal quedó abierta más de 30 segundos',
      timestamp: new Date(now - 1000 * 60 * 47).toISOString(),
      severity: 'warning',
      source: 'http',
    },
    {
      id: 'evt-4',
      type: 'CAMERA_SNAPSHOT',
      message: 'Nueva captura registrada en la entrada principal',
      timestamp: new Date(now - 1000 * 60 * 92).toISOString(),
      severity: 'info',
      source: 'http',
    },
  ],
  cameraStatus: {
    online: true,
    streaming: true,
    fps: 24,
    resolution: '1280x720',
    lastSeen: new Date().toISOString(),
  },
  snapshots: [
    {
      id: 'snap-1',
      key: 'snapshots/2026/entrada-01.jpg',
      timestamp: new Date(now - 1000 * 60 * 3).toISOString(),
      label: 'Acceso Principal · Movimiento',
      url: makeSnapshotSvg('ENTRADA PRINCIPAL', new Date(now - 1000 * 60 * 3).toLocaleTimeString('es-ES'), 'entry'),
    },
    {
      id: 'snap-2',
      key: 'snapshots/2026/cochera-02.jpg',
      timestamp: new Date(now - 1000 * 60 * 18).toISOString(),
      label: 'Cochera · Cierre completo',
      url: makeSnapshotSvg('COCHERA SUBSUELO', new Date(now - 1000 * 60 * 18).toLocaleTimeString('es-ES'), 'garage'),
    },
    {
      id: 'snap-3',
      key: 'snapshots/2026/hall-03.jpg',
      timestamp: new Date(now - 1000 * 60 * 47).toISOString(),
      label: 'Hall Planta Baja',
      url: makeSnapshotSvg('HALL PLANTA BAJA', new Date(now - 1000 * 60 * 47).toLocaleTimeString('es-ES'), 'hall'),
    },
    {
      id: 'snap-4',
      key: 'snapshots/2026/entrada-04.jpg',
      timestamp: new Date(now - 1000 * 60 * 110).toISOString(),
      label: 'Acceso Principal · RFID A1B2C3D4',
      url: makeSnapshotSvg('ENTRADA PRINCIPAL', new Date(now - 1000 * 60 * 110).toLocaleTimeString('es-ES'), 'entry'),
    },
  ],
};

function emitMqtt(topic: string, payload: Record<string, unknown>) {
  const envelope: MqttMessageEnvelope = {
    topic,
    payload,
    receivedAt: new Date().toISOString(),
  };
  listeners.forEach((cb) => cb(envelope));
}

function pushEvent(
  type: string,
  message: string,
  severity: 'info' | 'warning' | 'critical' = 'info'
) {
  const evt: BuildingEvent = {
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type,
    message,
    timestamp: new Date().toISOString(),
    departmentId: state.department,
    severity,
    source: 'mqtt',
  };
  state.events = [evt, ...state.events].slice(0, 30);
  emitMqtt(mqttTopics.events, {
    id: evt.id,
    type: evt.type,
    message: evt.message,
    timestamp: evt.timestamp,
    departmentId: evt.departmentId,
    severity: evt.severity,
  });
}

function emitTelemetry() {
  emitMqtt(mqttTopics.telemetry, {
    lights: { ...state.lights },
    garage: state.garage,
    door: state.doorOpen ? 'open' : 'closed',
    alarm: state.alarmActive,
    temperature: state.temperature,
    humidity: state.humidity,
    timestamp: new Date().toISOString(),
  });
}

function delay(ms = 180): Promise<void> {
  return new Promise((r) => window.setTimeout(r, ms));
}

export function setDemoDepartment(dept: string) {
  state.department = dept;
  state.profile.departmentId = dept;
  if (!(dept in state.lights)) {
    state.lights[dept] = false;
  }
}

export function subscribeDemoMqtt(listener: DemoMqttListener): () => void {
  listeners.add(listener);

  // Send immediate snapshot of camera status & telemetry
  window.setTimeout(() => {
    emitTelemetry();
    emitMqtt(mqttTopics.cameraStatus, {
      ...state.cameraStatus,
      lastSeen: new Date().toISOString(),
    });
  }, 250);

  // Subtle periodic telemetry ticks (temperature drift + camera heartbeat)
  const intervalId = window.setInterval(() => {
    const delta = (Math.random() - 0.5) * 0.2;
    state.temperature = Number(Math.max(19.5, Math.min(25.5, state.temperature + delta)).toFixed(1));
    state.cameraStatus.lastSeen = new Date().toISOString();
    emitTelemetry();
    emitMqtt(mqttTopics.cameraStatus, { ...state.cameraStatus });
  }, 12000);

  return () => {
    listeners.delete(listener);
    window.clearInterval(intervalId);
  };
}

export const demoBackend = {
  async getState(): Promise<Record<string, unknown>> {
    await delay();
    const reported = {
      lights: { ...state.lights },
      garage: state.garage,
      door: state.doorOpen ? 'open' : 'closed',
      alarm: state.alarmActive,
      temperature: state.temperature,
      humidity: state.humidity,
      updatedAt: new Date().toISOString(),
    };
    return {
      state: {
        desired: { ...reported },
        reported,
      },
      timestamp: Math.floor(Date.now() / 1000),
    };
  },

  async setLights(on: boolean): Promise<{ ok: boolean; state: boolean }> {
    await delay();
    state.lights[state.department] = on;
    emitTelemetry();
    pushEvent(
      'LIGHT_CHANGED',
      `Luz del dpto. ${state.department} ${on ? 'encendida' : 'apagada'} desde Web`,
      'info'
    );
    return { ok: true, state: on };
  },

  async sendGarageCommand(action: GarageAction): Promise<{ ok: boolean; garage: GarageState }> {
    await delay(160);
    const isMoving = state.garage === 'opening' || state.garage === 'closing';

    if (action !== 'stop' && isMoving) {
      const err = new Error('El motor de la cochera ya está en movimiento. Detén el motor primero.') as Error & {
        status: number;
      };
      err.status = 409;
      throw err;
    }

    if (state.garageTimer) {
      window.clearTimeout(state.garageTimer);
      state.garageTimer = null;
    }

    if (action === 'stop') {
      state.garage = 'stopped';
      emitTelemetry();
      pushEvent('GARAGE_STOPPED', 'Motor de cochera detenido manualmente', 'warning');
      return { ok: true, garage: state.garage };
    }

    state.garage = action === 'open' ? 'opening' : 'closing';
    emitTelemetry();
    pushEvent(
      action === 'open' ? 'GARAGE_OPENING' : 'GARAGE_CLOSING',
      action === 'open' ? 'Abriendo portón de cochera…' : 'Cerrando portón de cochera…',
      'info'
    );

    state.garageTimer = window.setTimeout(() => {
      state.garage = action === 'open' ? 'open' : 'closed';
      state.garageTimer = null;
      emitTelemetry();
      pushEvent(
        action === 'open' ? 'GARAGE_OPEN' : 'GARAGE_CLOSED',
        action === 'open' ? 'Cochera abierta completamente' : 'Cochera cerrada completamente',
        'info'
      );
    }, 4500);

    return { ok: true, garage: state.garage };
  },

  async openMainDoor(): Promise<{ ok: boolean }> {
    await delay();
    state.doorOpen = true;
    emitTelemetry();
    pushEvent('DOOR_OPENED', 'Puerta principal abierta desde la aplicación', 'info');

    if (state.doorTimer) window.clearTimeout(state.doorTimer);
    state.doorTimer = window.setTimeout(() => {
      state.doorOpen = false;
      state.doorTimer = null;
      emitTelemetry();
    }, 5000);

    return { ok: true };
  },

  async silenceAlarm(): Promise<{ ok: boolean }> {
    await delay();
    state.alarmActive = false;
    emitTelemetry();
    pushEvent('ALARM_SILENCED', 'Alarma silenciada y restablecida desde panel Web', 'info');
    return { ok: true };
  },

  triggerDemoAlarm(): void {
    state.alarmActive = true;
    emitTelemetry();
    pushEvent('ALARM_TRIGGERED', 'Alerta de seguridad simulada: puerta forzada', 'critical');
  },

  async getCameraStream(): Promise<CameraStreamResponse> {
    await delay();
    return {
      hlsUrl: '',
      expiresIn: 300,
      fetchedAt: Date.now(),
      isDemo: true,
    };
  },

  async getCameraSnapshots(): Promise<CameraSnapshot[]> {
    await delay();
    return [...state.snapshots];
  },

  async getMe(): Promise<UserProfile> {
    await delay();
    return { ...state.profile };
  },

  async updateMe(name: string): Promise<UserProfile> {
    await delay();
    state.profile = {
      ...state.profile,
      name: name.trim(),
      updatedAt: new Date().toISOString(),
    };
    return { ...state.profile };
  },

  async getRfidCards(): Promise<RfidCard[]> {
    await delay();
    return state.rfidCards.filter((c) => c.departmentId === state.department);
  },

  async createRfidCard(cardUid: string, label: string): Promise<RfidCard> {
    await delay();
    const uid = cardUid.trim().toUpperCase();
    if (state.rfidCards.some((c) => c.cardUid === uid)) {
      const err = new Error(`La tarjeta ${uid} ya está registrada.`) as Error & { status: number };
      err.status = 409;
      throw err;
    }
    const created: RfidCard = {
      cardUid: uid,
      label: label.trim(),
      departmentId: state.department,
      createdAt: new Date().toISOString(),
    };
    state.rfidCards = [created, ...state.rfidCards];
    pushEvent('RFID_REGISTERED', `Tarjeta RFID ${uid} (${created.label}) registrada en dpto. ${state.department}`, 'info');
    return created;
  },

  async deleteRfidCard(cardUid: string): Promise<void> {
    await delay();
    state.rfidCards = state.rfidCards.filter((c) => c.cardUid !== cardUid);
    pushEvent('RFID_DELETED', `Tarjeta RFID ${cardUid} eliminada del dpto. ${state.department}`, 'warning');
  },

  async getEvents(): Promise<BuildingEvent[]> {
    await delay();
    return [...state.events];
  },
};
