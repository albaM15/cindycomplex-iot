import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { config, mqttTopics } from '../config';
import {
  createApiClient,
  normalizeEventItem,
  normalizeShadowState,
} from '../services/api';
import {
  createDemoSession,
  getExistingCognitoSession,
  signOutCognito,
} from '../services/cognito';
import { setDemoDepartment, subscribeDemoMqtt } from '../services/demoBackend';
import { connectAwsIoTMqtt } from '../services/mqtt';
import type {
  AuthSession,
  BuildingEvent,
  CameraStatus,
  MqttConnectionState,
  NormalizedBuildingState,
} from '../types';

interface AppContextValue {
  session: AuthSession | null;
  authLoading: boolean;
  api: ReturnType<typeof createApiClient> | null;
  buildingState: NormalizedBuildingState | null;
  stateLoading: boolean;
  setOptimisticLight: (on: boolean) => void;
  refreshBuildingState: () => Promise<void>;
  mqttState: MqttConnectionState;
  mqttDetail: string;
  liveEvents: BuildingEvent[];
  cameraStatus: CameraStatus | null;
  loginWithSession: (session: AuthSession) => void;
  enterDemoMode: (department?: string) => void;
  logout: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [buildingState, setBuildingState] = useState<NormalizedBuildingState | null>(null);
  const [stateLoading, setStateLoading] = useState(false);

  const [mqttState, setMqttState] = useState<MqttConnectionState>('disconnected');
  const [mqttDetail, setMqttDetail] = useState('');
  const [liveEvents, setLiveEvents] = useState<BuildingEvent[]>([]);
  const [cameraStatus, setCameraStatus] = useState<CameraStatus | null>(null);

  // Restore existing Cognito session or auto-enter demo mode if configured
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        if (config.forceDemoMode) {
          setDemoDepartment('201');
          if (active) setSession(createDemoSession('201'));
          return;
        }
        const existing = await getExistingCognitoSession();
        if (active && existing) {
          setSession(existing);
        }
      } finally {
        if (active) setAuthLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const api = useMemo(() => (session ? createApiClient(session) : null), [session]);

  const refreshBuildingState = useCallback(async () => {
    if (!api) return;
    setStateLoading(true);
    try {
      const next = await api.getState();
      setBuildingState(next);
    } catch {
      // Errors are surfaced by views when triggering refresh directly
    } finally {
      setStateLoading(false);
    }
  }, [api]);

  const setOptimisticLight = useCallback((on: boolean) => {
    setBuildingState((prev) => (prev ? { ...prev, lightOn: on } : prev));
  }, []);

  // Initial state & events hydration when signed in
  useEffect(() => {
    if (!api || !session) {
      setBuildingState(null);
      setLiveEvents([]);
      setCameraStatus(null);
      return;
    }

    let cancelled = false;
    void (async () => {
      setStateLoading(true);
      try {
        const [st, evts] = await Promise.all([
          api.getState().catch(() => null),
          api.getEvents().catch(() => []),
        ]);
        if (!cancelled) {
          if (st) setBuildingState(st);
          setLiveEvents(evts);
        }
      } finally {
        if (!cancelled) setStateLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [api, session]);

  // Real-time MQTT over WSS subscription (or simulated MQTT in Demo Mode)
  useEffect(() => {
    if (!session) {
      setMqttState('disconnected');
      setMqttDetail('');
      return;
    }

    const handleIncomingMessage = (topic: string, payload: Record<string, unknown>) => {
      if (topic === mqttTopics.telemetry) {
        setBuildingState((prev) => {
          const mergedReported = {
            ...(prev?.reported ?? {}),
            ...payload,
          };
          return normalizeShadowState(
            {
              state: {
                desired: prev?.desired ?? {},
                reported: mergedReported,
              },
            },
            session.department
          );
        });
      } else if (topic === mqttTopics.events) {
        const event = normalizeEventItem(payload, 'mqtt');
        setLiveEvents((prev) => {
          const filtered = prev.filter((item) => item.id !== event.id);
          return [event, ...filtered].slice(0, 50);
        });
      } else if (topic === mqttTopics.cameraStatus) {
        const online =
          typeof payload.online === 'boolean'
            ? payload.online
            : String(payload.status ?? '').toLowerCase() === 'online';
        const streaming =
          typeof payload.streaming === 'boolean'
            ? payload.streaming
            : Boolean(payload.hlsActive ?? online);
        setCameraStatus({
          online,
          streaming,
          fps: typeof payload.fps === 'number' ? payload.fps : undefined,
          resolution: typeof payload.resolution === 'string' ? payload.resolution : undefined,
          lastSeen:
            typeof payload.lastSeen === 'string'
              ? payload.lastSeen
              : typeof payload.timestamp === 'string'
              ? payload.timestamp
              : new Date().toISOString(),
          raw: payload,
        });
      }
    };

    if (session.isDemo) {
      setMqttState('demo');
      setMqttDetail(`Simulando ${mqttTopics.wildcard}`);
      const unsubscribe = subscribeDemoMqtt((env) => {
        handleIncomingMessage(env.topic, env.payload);
      });
      return unsubscribe;
    }

    const conn = connectAwsIoTMqtt(session.idToken, {
      onStateChange: (nextState, detail) => {
        setMqttState(nextState);
        setMqttDetail(detail ?? '');
      },
      onMessage: (env) => {
        handleIncomingMessage(env.topic, env.payload);
      },
    });

    return () => {
      conn.disconnect();
    };
  }, [session]);

  const loginWithSession = useCallback((nextSession: AuthSession) => {
    setSession(nextSession);
  }, []);

  const enterDemoMode = useCallback((department = '201') => {
    setDemoDepartment(department);
    setSession(createDemoSession(department));
  }, []);

  const logout = useCallback(() => {
    if (session && !session.isDemo) {
      signOutCognito();
    }
    setSession(null);
  }, [session]);

  const value = useMemo<AppContextValue>(
    () => ({
      session,
      authLoading,
      api,
      buildingState,
      stateLoading,
      setOptimisticLight,
      refreshBuildingState,
      mqttState,
      mqttDetail,
      liveEvents,
      cameraStatus,
      loginWithSession,
      enterDemoMode,
      logout,
    }),
    [
      session,
      authLoading,
      api,
      buildingState,
      stateLoading,
      setOptimisticLight,
      refreshBuildingState,
      mqttState,
      mqttDetail,
      liveEvents,
      cameraStatus,
      loginWithSession,
      enterDemoMode,
      logout,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp debe usarse dentro de AppProvider');
  return ctx;
}
