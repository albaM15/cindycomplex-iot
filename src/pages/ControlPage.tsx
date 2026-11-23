import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  IconBellOff,
  IconBulb,
  IconDoor,
  IconGarage,
  IconRefresh,
} from '../components/Icons';
import { useApp } from '../context/AppContext';
import { ApiError } from '../services/api';
import { demoBackend } from '../services/demoBackend';
import type { GarageAction, GarageState } from '../types';
import {
  formatEventLabel,
  formatFriendlyTime,
  formatTemperature,
} from '../utils/format';

function formatGarageState(state: GarageState): { label: string; badge: string } {
  switch (state) {
    case 'open':
      return { label: 'Abierta', badge: 'badge-ok' };
    case 'closed':
      return { label: 'Cerrada', badge: '' };
    case 'opening':
      return { label: 'Abriendo…', badge: 'badge-warn' };
    case 'closing':
      return { label: 'Cerrando…', badge: 'badge-warn' };
    case 'stopped':
      return { label: 'Detenida', badge: 'badge-warn' };
    default:
      return { label: 'Sin datos', badge: '' };
  }
}

export function ControlPage() {
  const {
    session,
    api,
    buildingState,
    stateLoading,
    setOptimisticLight,
    refreshBuildingState,
    liveEvents,
  } = useApp();

  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    kind: 'ok' | 'warn' | 'danger';
    message: string;
  } | null>(null);

  if (!api || !session) return null;

  const isInitialLoad = stateLoading && !buildingState;
  const lightOn = buildingState?.lightOn ?? false;
  const garageState = buildingState?.garageState ?? 'unknown';
  const doorOpen = buildingState?.doorOpen ?? false;
  const alarmActive = buildingState?.alarmActive ?? false;
  const garageInfo = formatGarageState(garageState);

  const runAction = async (
    key: string,
    fn: () => Promise<void>,
    okMessage: string
  ) => {
    setBusyKey(key);
    setFeedback(null);
    try {
      await fn();
      setFeedback({ kind: 'ok', message: okMessage });
      await refreshBuildingState();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setFeedback({
          kind: 'warn',
          message: 'La cochera está en movimiento. Detenla primero para cambiar de dirección.',
        });
      } else {
        setFeedback({
          kind: 'danger',
          message: err instanceof Error ? err.message : 'No pudimos completar la acción.',
        });
      }
    } finally {
      setBusyKey(null);
    }
  };

  const handleToggleLight = async () => {
    const previous = lightOn;
    const next = !lightOn;
    setOptimisticLight(next);
    setBusyKey('lights');
    setFeedback(null);
    try {
      await api.setLights(next);
      setFeedback({
        kind: 'ok',
        message: next ? 'Luz encendida.' : 'Luz apagada.',
      });
      await refreshBuildingState();
    } catch (err) {
      setOptimisticLight(previous);
      setFeedback({
        kind: 'danger',
        message: err instanceof Error ? err.message : 'No pudimos cambiar la luz.',
      });
    } finally {
      setBusyKey(null);
    }
  };

  const handleGarage = (action: GarageAction) => {
    const labels: Record<GarageAction, string> = {
      open: 'Abriendo la cochera…',
      close: 'Cerrando la cochera…',
      stop: 'Cochera detenida.',
    };
    void runAction(`garage-${action}`, () => api.sendGarageCommand(action), labels[action]);
  };

  const handleOpenDoor = () => {
    void runAction('door', () => api.openMainDoor(), 'Puerta principal abierta.');
  };

  const handleSilenceAlarm = () => {
    void runAction('alarm', () => api.silenceAlarm(), 'Alarma silenciada.');
  };

  return (
    <div className="stack-6">
      <div className="page-header">
        <div>
          <div className="page-eyebrow tabular">Departamento&nbsp;{session.department}</div>
          <h1 className="page-title">Tu departamento</h1>
          <p className="page-subtitle">
            Controla la iluminación, los accesos y el estado del edificio en tiempo real.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => void refreshBuildingState()}
          disabled={stateLoading}
        >
          {stateLoading ? (
            <span className="spinner" aria-hidden="true" />
          ) : (
            <IconRefresh width={15} height={15} />
          )}
          Actualizar
        </button>
      </div>

      <div aria-live="polite" aria-atomic="true">
        {feedback && (
          <div
            className={`alert ${
              feedback.kind === 'ok'
                ? 'alert-ok'
                : feedback.kind === 'warn'
                ? 'alert-warn'
                : 'alert-danger'
            }`}
            role="status"
          >
            <span>{feedback.message}</span>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ minHeight: 30, padding: '0 8px' }}
              onClick={() => setFeedback(null)}
            >
              Cerrar
            </button>
          </div>
        )}
      </div>

      {alarmActive && (
        <div className="alert alert-danger" role="alert">
          <div>
            <strong>Alerta de seguridad activa</strong>
            <div style={{ marginTop: 2, fontSize: 13 }}>
              La alarma del edificio está sonando en este momento.
            </div>
          </div>
          <button
            type="button"
            className="btn btn-danger btn-sm"
            onClick={handleSilenceAlarm}
            disabled={busyKey === 'alarm'}
          >
            {busyKey === 'alarm' ? (
              <span className="spinner" aria-hidden="true" />
            ) : (
              <IconBellOff width={15} height={15} />
            )}
            Silenciar ahora
          </button>
        </div>
      )}

      {isInitialLoad ? (
        <div className="grid-asymmetric" aria-label="Cargando controles…">
          <div className="stack-4">
            <div className="grid-controls">
              <div className="card skeleton" style={{ height: 158 }} />
              <div className="card skeleton" style={{ height: 158 }} />
            </div>
            <div className="card skeleton" style={{ height: 152 }} />
          </div>
          <div className="card skeleton" style={{ height: 280 }} />
        </div>
      ) : (
        <div className="grid-asymmetric">
          {/* Left: Core Resident Controls */}
          <div className="stack-4">
            <div className="grid-controls">
              {/* Lights */}
              <article className="card card-interactive">
                <div className="card-header">
                  <div className="row" style={{ gap: 12 }}>
                    <div className={`icon-chip ${lightOn ? 'warm' : ''}`}>
                      <IconBulb width={20} height={20} />
                    </div>
                    <div>
                      <h2 className="card-title">Iluminación</h2>
                      <p className="card-desc">Dpto.&nbsp;{session.department}</p>
                    </div>
                  </div>
                  <span className={`badge ${lightOn ? 'badge-warm' : ''}`}>
                    {lightOn ? 'Encendida' : 'Apagada'}
                  </span>
                </div>

                <label className="switch-row" htmlFor="light-toggle">
                  <span style={{ fontWeight: 550, fontSize: 14 }}>Luz principal</span>
                  <button
                    id="light-toggle"
                    type="button"
                    role="switch"
                    aria-checked={lightOn}
                    aria-label="Luz principal del departamento"
                    className="switch-btn"
                    disabled={busyKey === 'lights'}
                    onClick={() => void handleToggleLight()}
                  >
                    <span className="switch-thumb" />
                  </button>
                </label>
              </article>

              {/* Main Door */}
              <article className="card card-interactive">
                <div className="card-header">
                  <div className="row" style={{ gap: 12 }}>
                    <div className={`icon-chip ${doorOpen ? 'accent' : ''}`}>
                      <IconDoor width={20} height={20} />
                    </div>
                    <div>
                      <h2 className="card-title">Puerta principal</h2>
                      <p className="card-desc">Acceso de entrada</p>
                    </div>
                  </div>
                  <span className={`badge ${doorOpen ? 'badge-ok' : ''}`}>
                    {doorOpen ? 'Abierta' : 'Cerrada'}
                  </span>
                </div>

                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ width: '100%' }}
                  disabled={busyKey === 'door'}
                  onClick={handleOpenDoor}
                >
                  {busyKey === 'door' ? (
                    <span className="spinner" aria-hidden="true" />
                  ) : (
                    <IconDoor width={16} height={16} />
                  )}
                  Abrir puerta
                </button>
              </article>
            </div>

            {/* Garage */}
            <article className="card card-interactive">
              <div className="card-header">
                <div className="row" style={{ gap: 12 }}>
                  <div className="icon-chip">
                    <IconGarage width={20} height={20} />
                  </div>
                  <div>
                    <h2 className="card-title">Cochera</h2>
                    <p className="card-desc">Control del portón vehicular</p>
                  </div>
                </div>
                <span className={`badge ${garageInfo.badge}`}>{garageInfo.label}</span>
              </div>

              <div className="segmented">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busyKey !== null}
                  onClick={() => handleGarage('open')}
                >
                  {busyKey === 'garage-open' && <span className="spinner" aria-hidden="true" />}
                  Abrir
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={busyKey !== null}
                  onClick={() => handleGarage('stop')}
                >
                  {busyKey === 'garage-stop' && <span className="spinner" aria-hidden="true" />}
                  Detener
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={busyKey !== null}
                  onClick={() => handleGarage('close')}
                >
                  {busyKey === 'garage-close' && <span className="spinner" aria-hidden="true" />}
                  Cerrar
                </button>
              </div>
            </article>

            {/* Security / Alarm */}
            <article className="card">
              <div className="row-between">
                <div className="row" style={{ gap: 12 }}>
                  <div className={`icon-chip ${alarmActive ? 'danger' : 'accent'}`}>
                    <IconBellOff width={19} height={19} />
                  </div>
                  <div>
                    <h2 className="card-title">Alarma del edificio</h2>
                    <p className="card-desc">
                      {alarmActive
                        ? 'Requiere atención inmediata'
                        : 'Todo funciona con normalidad'}
                    </p>
                  </div>
                </div>

                <div className="row" style={{ gap: 8 }}>
                  <span className={`badge ${alarmActive ? 'badge-danger' : 'badge-ok'}`}>
                    {alarmActive ? 'Activa' : 'Normal'}
                  </span>
                  <button
                    type="button"
                    className={`btn btn-sm ${alarmActive ? 'btn-danger' : ''}`}
                    disabled={busyKey === 'alarm'}
                    onClick={handleSilenceAlarm}
                  >
                    {busyKey === 'alarm' && <span className="spinner" aria-hidden="true" />}
                    Silenciar
                  </button>
                  {session.isDemo && !alarmActive && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => demoBackend.triggerDemoAlarm()}
                    >
                      Probar alerta
                    </button>
                  )}
                </div>
              </div>
            </article>
          </div>

          {/* Right: Environment + Recent Activity */}
          <div className="stack-4">
            {(buildingState?.temperature !== undefined ||
              buildingState?.humidity !== undefined) && (
              <section className="card">
                <h2 className="card-title" style={{ marginBottom: 12 }}>
                  Ambiente
                </h2>
                <div className="env-strip">
                  {buildingState.temperature !== undefined && (
                    <div className="env-item">
                      <span className="env-label">Temperatura</span>
                      <span className="env-value">
                        {formatTemperature(buildingState.temperature)}
                      </span>
                    </div>
                  )}
                  {buildingState.humidity !== undefined && (
                    <div className="env-item">
                      <span className="env-label">Humedad</span>
                      <span className="env-value">{buildingState.humidity}%</span>
                    </div>
                  )}
                </div>
              </section>
            )}

            <section className="card">
              <div className="card-header">
                <div>
                  <h2 className="card-title">Últimos movimientos</h2>
                  <p className="card-desc">Actualización automática</p>
                </div>
                <Link to="/events" className="btn btn-ghost btn-sm">
                  Ver todo
                </Link>
              </div>

              {liveEvents.length === 0 ? (
                <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                  Aún no hay actividad reciente.
                </p>
              ) : (
                <div className="data-list">
                  {liveEvents.slice(0, 4).map((evt) => (
                    <div key={evt.id} className="data-row" style={{ alignItems: 'flex-start' }}>
                      <div className="min-w-0">
                        <div style={{ fontSize: 14, fontWeight: 520, lineHeight: 1.35 }}>
                          {evt.message}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>
                          {formatEventLabel(evt.type)} · {formatFriendlyTime(evt.timestamp)}
                        </div>
                      </div>
                      {evt.severity !== 'info' && (
                        <span
                          className={`badge ${
                            evt.severity === 'critical' ? 'badge-danger' : 'badge-warn'
                          }`}
                        >
                          {evt.severity === 'critical' ? 'Alerta' : 'Aviso'}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
