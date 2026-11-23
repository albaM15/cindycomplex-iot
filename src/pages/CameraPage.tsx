import Hls from 'hls.js';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { IconCamera, IconRefresh } from '../components/Icons';
import { useApp } from '../context/AppContext';
import type { CameraSnapshot, CameraStreamResponse } from '../types';
import { formatFriendlyTime } from '../utils/format';

function formatCountdown(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function CameraPage() {
  const { api, cameraStatus } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const lastTriggerRef = useRef<HTMLButtonElement | null>(null);

  const [stream, setStream] = useState<CameraStreamResponse | null>(null);
  const [streamLoading, setStreamLoading] = useState(false);
  const [streamError, setStreamError] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(0);

  const [snapshots, setSnapshots] = useState<CameraSnapshot[]>([]);
  const [snapshotsLoading, setSnapshotsLoading] = useState(false);
  const [snapshotsError, setSnapshotsError] = useState('');

  const selectedId = searchParams.get('foto');
  const selectedSnapshot = snapshots.find((s) => s.id === selectedId) ?? null;

  const openSnapshot = (snap: CameraSnapshot, trigger: HTMLButtonElement) => {
    lastTriggerRef.current = trigger;
    const next = new URLSearchParams(searchParams);
    next.set('foto', snap.id);
    setSearchParams(next);
  };

  const closeSnapshot = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete('foto');
    setSearchParams(next);
    window.setTimeout(() => lastTriggerRef.current?.focus(), 0);
  }, [searchParams, setSearchParams]);

  // Modal focus + Escape key
  useEffect(() => {
    if (!selectedSnapshot) return;
    closeBtnRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSnapshot();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedSnapshot, closeSnapshot]);

  const loadStream = useCallback(async () => {
    if (!api) return;
    setStreamLoading(true);
    setStreamError('');
    try {
      const next = await api.getCameraStream();
      setStream(next);
      setSecondsLeft(next.expiresIn || 300);
    } catch (err) {
      setStreamError(
        err instanceof Error ? err.message : 'No pudimos conectar con el video en vivo.'
      );
    } finally {
      setStreamLoading(false);
    }
  }, [api]);

  const loadSnapshots = useCallback(async () => {
    if (!api) return;
    setSnapshotsLoading(true);
    setSnapshotsError('');
    try {
      const list = await api.getCameraSnapshots();
      setSnapshots(list.slice(0, 20));
    } catch (err) {
      setSnapshotsError(
        err instanceof Error ? err.message : 'No pudimos cargar las capturas recientes.'
      );
    } finally {
      setSnapshotsLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void loadStream();
    void loadSnapshots();
  }, [loadStream, loadSnapshots]);

  // Mount hls.js onto <video> when hlsUrl is ready
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream?.hlsUrl) return;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
      });
      hlsRef.current = hls;
      hls.loadSource(stream.hlsUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        void video.play().catch(() => undefined);
      });
      hls.on(Hls.Events.ERROR, (_evt, data) => {
        if (data.fatal) {
          setStreamError('Se interrumpió la transmisión. Pulsa “Reconectar” para reintentar.');
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = stream.hlsUrl;
      void video.play().catch(() => undefined);
    } else {
      setStreamError('Tu navegador no es compatible con la reproducción de video en vivo.');
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [stream?.hlsUrl]);

  // Auto-refresh stream before 300s expiry
  useEffect(() => {
    if (!stream) return;
    const id = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - stream.fetchedAt) / 1000);
      const remaining = Math.max(0, (stream.expiresIn || 300) - elapsed);
      setSecondsLeft(remaining);
      if (remaining === 15 && !stream.isDemo) {
        void loadStream();
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [stream, loadStream]);

  return (
    <div className="stack-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Cámara</h1>
          <p className="page-subtitle">
            Transmisión de la entrada principal y galería de capturas recientes.
          </p>
        </div>

        <span
          className={`badge ${
            cameraStatus?.online ? 'badge-ok' : cameraStatus ? 'badge-danger' : ''
          }`}
        >
          <span
            className={`status-dot ${
              cameraStatus?.online ? 'ok' : cameraStatus ? 'danger' : ''
            }`}
            aria-hidden="true"
          />
          {cameraStatus
            ? cameraStatus.online
              ? 'Cámara en línea'
              : 'Cámara sin señal'
            : 'Comprobando estado…'}
        </span>
      </div>

      {/* Live Video */}
      <section className="card stack-4">
        <div className="row-between">
          <div>
            <h2 className="card-title">Entrada principal</h2>
            <p className="card-desc">
              {stream && !stream.isDemo
                ? `Video en vivo · se renueva automáticamente (${formatCountdown(secondsLeft)})`
                : 'Vista en directo de la entrada del edificio'}
            </p>
          </div>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => void loadStream()}
            disabled={streamLoading}
          >
            {streamLoading ? (
              <span className="spinner" aria-hidden="true" />
            ) : (
              <IconRefresh width={15} height={15} />
            )}
            Reconectar
          </button>
        </div>

        {streamError && (
          <div className="alert alert-danger" role="alert">
            {streamError}
          </div>
        )}

        <div className="video-stage">
          {stream?.hlsUrl ? (
            <video ref={videoRef} controls playsInline muted />
          ) : (
            <div className="video-placeholder">
              <IconCamera width={34} height={34} style={{ opacity: 0.72, marginBottom: 10 }} />
              <div style={{ fontWeight: 600, fontSize: 15, color: '#f5f4f0' }}>
                {stream?.isDemo
                  ? 'Video en vivo disponible al conectar el edificio'
                  : streamLoading
                  ? 'Conectando con la cámara…'
                  : 'Sin transmisión disponible en este momento'}
              </div>
              <p style={{ fontSize: 13, marginTop: 6, color: '#beb9ae' }}>
                {stream?.isDemo
                  ? 'En el modo demostración puedes revisar las capturas recientes abajo.'
                  : 'Intenta reconectar en unos segundos.'}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Recent Snapshots */}
      <section className="card stack-4">
        <div className="row-between">
          <div>
            <h2 className="card-title">Capturas recientes</h2>
            <p className="card-desc">Toca cualquier imagen para verla en detalle.</p>
          </div>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => void loadSnapshots()}
            disabled={snapshotsLoading}
          >
            {snapshotsLoading ? (
              <span className="spinner" aria-hidden="true" />
            ) : (
              <IconRefresh width={15} height={15} />
            )}
            Actualizar
          </button>
        </div>

        {snapshotsError && (
          <div className="alert alert-danger" role="alert">
            {snapshotsError}
          </div>
        )}

        {snapshotsLoading && snapshots.length === 0 ? (
          <div className="snapshot-grid">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="skeleton" style={{ height: 185, borderRadius: 11 }} />
            ))}
          </div>
        ) : snapshots.length === 0 ? (
          <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
            Todavía no hay capturas registradas.
          </p>
        ) : (
          <div className="snapshot-grid">
            {snapshots.map((snap, index) => (
              <button
                key={snap.id}
                type="button"
                className="snapshot-card"
                onClick={(e) => openSnapshot(snap, e.currentTarget)}
              >
                <img
                  src={snap.url}
                  width={400}
                  height={250}
                  alt={snap.label || 'Captura de seguridad'}
                  loading={index < 4 ? 'eager' : 'lazy'}
                />
                <div className="snapshot-meta">
                  <div className="snapshot-title">{snap.label || 'Captura reciente'}</div>
                  <div className="snapshot-time">
                    {formatFriendlyTime(snap.timestamp) || 'Reciente'}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Lightbox Modal */}
      {selectedSnapshot && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label={selectedSnapshot.label || 'Vista ampliada de captura'}
          onClick={closeSnapshot}
        >
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <img
              src={selectedSnapshot.url}
              alt={selectedSnapshot.label || 'Captura ampliada'}
            />
            <div className="modal-footer">
              <div className="min-w-0">
                <div className="truncate" style={{ fontWeight: 600, fontSize: 15 }}>
                  {selectedSnapshot.label || 'Captura reciente'}
                </div>
                {selectedSnapshot.timestamp && (
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    {formatFriendlyTime(selectedSnapshot.timestamp)}
                  </div>
                )}
              </div>
              <button
                ref={closeBtnRef}
                type="button"
                className="btn btn-sm"
                onClick={closeSnapshot}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
