import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { IconRefresh } from '../components/Icons';
import { useApp } from '../context/AppContext';
import type { BuildingEvent } from '../types';
import { formatEventLabel, formatFriendlyTime } from '../utils/format';

type EventFilter = 'todo' | 'alertas' | 'en-vivo';

export function EventsPage() {
  const { api, liveEvents, mqttState } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();

  const [httpEvents, setHttpEvents] = useState<BuildingEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const rawFilter = searchParams.get('filtro');
  const filter: EventFilter =
    rawFilter === 'alertas' || rawFilter === 'en-vivo' ? rawFilter : 'todo';

  const setFilter = (next: EventFilter) => {
    const params = new URLSearchParams(searchParams);
    if (next === 'todo') params.delete('filtro');
    else params.set('filtro', next);
    setSearchParams(params, { replace: true });
  };

  const loadEvents = useCallback(async () => {
    if (!api) return;
    setLoading(true);
    setError('');
    try {
      const list = await api.getEvents();
      setHttpEvents(list.slice(0, 30));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No pudimos actualizar la actividad.'
      );
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  const mergedEvents = useMemo(() => {
    const map = new Map<string, BuildingEvent>();
    for (const evt of liveEvents) map.set(evt.id, evt);
    for (const evt of httpEvents) {
      if (!map.has(evt.id)) map.set(evt.id, evt);
    }
    return Array.from(map.values())
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 40);
  }, [liveEvents, httpEvents]);

  const visibleEvents = useMemo(() => {
    if (filter === 'alertas') {
      return mergedEvents.filter((e) => e.severity === 'critical' || e.severity === 'warning');
    }
    if (filter === 'en-vivo') {
      return mergedEvents.filter((e) => e.source === 'mqtt');
    }
    return mergedEvents;
  }, [mergedEvents, filter]);

  return (
    <div className="stack-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Actividad</h1>
          <p className="page-subtitle">
            Accesos, cambios recientes y avisos del edificio actualizados al instante.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => void loadEvents()}
          disabled={loading}
        >
          {loading ? (
            <span className="spinner" aria-hidden="true" />
          ) : (
            <IconRefresh width={15} height={15} />
          )}
          Actualizar
        </button>
      </div>

      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      <section className="card stack-4">
        <div className="row-between">
          <div className="row" role="tablist" aria-label="Filtrar actividad">
            <button
              type="button"
              role="tab"
              aria-selected={filter === 'todo'}
              className={`btn btn-sm ${filter === 'todo' ? 'btn-primary' : ''}`}
              onClick={() => setFilter('todo')}
            >
              Todo ({mergedEvents.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={filter === 'alertas'}
              className={`btn btn-sm ${filter === 'alertas' ? 'btn-primary' : ''}`}
              onClick={() => setFilter('alertas')}
            >
              Alertas
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={filter === 'en-vivo'}
              className={`btn btn-sm ${filter === 'en-vivo' ? 'btn-primary' : ''}`}
              onClick={() => setFilter('en-vivo')}
            >
              Recientes en vivo
            </button>
          </div>

          <span className="badge">
            <span
              className={`status-dot ${
                mqttState === 'connected'
                  ? 'ok'
                  : mqttState === 'demo'
                  ? 'accent'
                  : 'warn'
              }`}
              aria-hidden="true"
            />
            {mqttState === 'connected'
              ? 'Escuchando en vivo'
              : mqttState === 'demo'
              ? 'En vivo (demo)'
              : 'Reconectando…'}
          </span>
        </div>

        {loading && mergedEvents.length === 0 ? (
          <div className="stack-3">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="skeleton" style={{ height: 58 }} />
            ))}
          </div>
        ) : visibleEvents.length === 0 ? (
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', padding: '12px 0' }}>
            No hay movimientos para este filtro por ahora.
          </p>
        ) : (
          <div className="data-list">
            {visibleEvents.map((evt) => (
              <div key={evt.id} className="data-row" style={{ alignItems: 'flex-start' }}>
                <div className="min-w-0">
                  <div className="row" style={{ gap: 8, marginBottom: 4 }}>
                    <span
                      className={`badge ${
                        evt.severity === 'critical'
                          ? 'badge-danger'
                          : evt.severity === 'warning'
                          ? 'badge-warn'
                          : ''
                      }`}
                    >
                      {formatEventLabel(evt.type)}
                    </span>
                    {evt.departmentId && (
                      <span className="badge tabular">Dpto.&nbsp;{evt.departmentId}</span>
                    )}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 520, lineHeight: 1.4 }}>
                    {evt.message}
                  </div>
                </div>
                <div
                  className="tabular"
                  style={{
                    fontSize: 12,
                    color: 'var(--text-secondary)',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  {formatFriendlyTime(evt.timestamp)}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
