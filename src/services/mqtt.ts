import mqtt, { type MqttClient } from 'mqtt';
import { config, isMqttConfigured, mqttTopics } from '../config';
import type { MqttConnectionState, MqttMessageEnvelope } from '../types';
import { getFreshIdToken, getTemporaryAwsCredentials } from './cognito';
import { createIoTSigV4Url } from './sigv4';

export interface MqttSubscriptionCallbacks {
  onStateChange: (state: MqttConnectionState, detail?: string) => void;
  onMessage: (envelope: MqttMessageEnvelope) => void;
}

export interface MqttConnectionHandle {
  disconnect: () => void;
}

/**
 * Connects to AWS IoT Core MQTT over WSS (port 443) using SigV4 temporary credentials.
 * Strictly read-only: subscribes to events, telemetry, and camera/status; never publishes.
 */
export function connectAwsIoTMqtt(
  initialIdToken: string,
  callbacks: MqttSubscriptionCallbacks
): MqttConnectionHandle {
  if (!isMqttConfigured()) {
    callbacks.onStateChange(
      'disconnected',
      'Falta VITE_IDENTITY_POOL_ID o VITE_IOT_ENDPOINT para MQTT.'
    );
    return { disconnect: () => undefined };
  }

  let disposed = false;
  let client: MqttClient | null = null;
  let reconnectTimer: number | null = null;

  const clearTimer = () => {
    if (reconnectTimer !== null) {
      window.clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  const start = async (isReconnect: boolean) => {
    if (disposed) return;
    callbacks.onStateChange(isReconnect ? 'reconnecting' : 'connecting');

    try {
      const token = isReconnect ? await getFreshIdToken().catch(() => initialIdToken) : initialIdToken;
      const credentials = await getTemporaryAwsCredentials(token);
      if (disposed) return;

      const signedUrl = await createIoTSigV4Url({
        endpoint: config.iotEndpoint,
        region: config.region,
        credentials,
      });
      if (disposed) return;

      const clientId = `web-${config.env}-${Math.random().toString(36).slice(2, 10)}`;

      client = mqtt.connect(signedUrl, {
        clientId,
        protocolVersion: 4,
        clean: true,
        reconnectPeriod: 0, // Controlled manually so every reconnect uses a fresh SigV4 URL
        keepalive: 45,
        connectTimeout: 15000,
      });

      client.on('connect', () => {
        if (disposed) return;
        callbacks.onStateChange('connected', config.iotEndpoint);

        const topics = [
          mqttTopics.events,
          mqttTopics.telemetry,
          mqttTopics.cameraStatus,
        ];

        client?.subscribe(topics, { qos: 0 }, (err) => {
          if (err && !disposed) {
            callbacks.onStateChange('error', `Error suscribiendo tópicos: ${err.message}`);
          }
        });
      });

      client.on('message', (topic: string, message: Uint8Array) => {
        if (disposed) return;
        const text = new TextDecoder().decode(message);
        let payload: Record<string, unknown>;
        try {
          const parsed = JSON.parse(text);
          payload =
            parsed && typeof parsed === 'object' && !Array.isArray(parsed)
              ? (parsed as Record<string, unknown>)
              : { value: parsed };
        } catch {
          payload = { rawText: text };
        }

        callbacks.onMessage({
          topic,
          payload,
          receivedAt: new Date().toISOString(),
        });
      });

      client.on('error', (err) => {
        if (disposed) return;
        callbacks.onStateChange('error', err.message || 'Error en conexión MQTT WSS');
      });

      client.on('close', () => {
        if (disposed) return;
        client?.end(true);
        client = null;
        callbacks.onStateChange('reconnecting', 'Reconectando con nueva firma SigV4…');
        clearTimer();
        reconnectTimer = window.setTimeout(() => {
          void start(true);
        }, 4000);
      });
    } catch (err) {
      if (disposed) return;
      const message = err instanceof Error ? err.message : 'Error conectando MQTT';
      callbacks.onStateChange('error', message);
      clearTimer();
      reconnectTimer = window.setTimeout(() => {
        void start(true);
      }, 8000);
    }
  };

  void start(false);

  return {
    disconnect: () => {
      disposed = true;
      clearTimer();
      if (client) {
        client.removeAllListeners();
        client.end(true);
        client = null;
      }
      callbacks.onStateChange('disconnected');
    },
  };
}
