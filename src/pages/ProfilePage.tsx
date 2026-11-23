import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { config, mqttTopics } from '../config';
import { useApp } from '../context/AppContext';
import { ApiError } from '../services/api';
import type { UserProfile } from '../types';

export function ProfilePage() {
  const { session, api, mqttState } = useApp();

  const nameInputRef = useRef<HTMLInputElement | null>(null);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const isDirty = profile !== null && name.trim() !== profile.name.trim();

  // Warn before leaving page if user has unsaved edits
  useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty]);

  const loadProfile = useCallback(async () => {
    if (!api) return;
    setLoading(true);
    setError('');
    try {
      const me = await api.getMe();
      setProfile(me);
      setName(me.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos cargar tu perfil.');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  if (!api || !session) return null;

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const trimmed = name.trim();
    if (!trimmed) {
      setNameError('Escribe tu nombre antes de guardar.');
      nameInputRef.current?.focus();
      return;
    }

    setNameError('');
    setSaving(true);
    try {
      // Sends only { name } per API rules
      const updated = await api.updateMe(trimmed);
      setProfile(updated);
      setName(updated.name);
      setSuccess('Tu nombre se guardó correctamente.');
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setError('No tienes permiso para modificar ese campo.');
      } else {
        setError(err instanceof Error ? err.message : 'No pudimos guardar los cambios.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="stack-6" style={{ maxWidth: 640 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Mi perfil</h1>
          <p className="page-subtitle">
            Revisa tus datos de residente y actualiza cómo aparece tu nombre.
          </p>
        </div>
        {isDirty && <span className="badge badge-warn">Cambios sin guardar</span>}
      </div>

      <div aria-live="polite" aria-atomic="true">
        {error && (
          <div className="alert alert-danger" role="alert">
            {error}
          </div>
        )}
        {success && (
          <div className="alert alert-ok" role="status">
            {success}
          </div>
        )}
      </div>

      <section className="card">
        <form onSubmit={handleSave} noValidate className="stack-4">
          <div className="field">
            <label htmlFor="profileName">Nombre</label>
            <input
              ref={nameInputRef}
              id="profileName"
              name="name"
              className="input"
              type="text"
              autoComplete="name"
              placeholder="Tu nombre…"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (nameError) setNameError('');
                if (success) setSuccess('');
              }}
              aria-invalid={Boolean(nameError)}
              disabled={loading || saving}
            />
            {nameError && (
              <span className="field-error" role="alert">
                {nameError}
              </span>
            )}
          </div>

          <div className="grid-controls">
            <div className="field">
              <label htmlFor="profileDept">Departamento</label>
              <input
                id="profileDept"
                className="input tabular"
                type="text"
                value={profile?.departmentId ?? session.department}
                disabled
              />
              <span className="field-hint">Asignado por administración.</span>
            </div>

            <div className="field">
              <label htmlFor="profileEmail">Correo</label>
              <input
                id="profileEmail"
                className="input"
                type="email"
                value={profile?.email ?? session.email}
                disabled
              />
            </div>
          </div>

          <div className="row" style={{ paddingTop: 4 }}>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || saving}
            >
              {saving && <span className="spinner" aria-hidden="true" />}
              Guardar cambios
            </button>
            {isDirty && (
              <button
                type="button"
                className="btn btn-ghost"
                disabled={saving}
                onClick={() => {
                  setName(profile?.name ?? '');
                  setNameError('');
                }}
              >
                Descartar
              </button>
            )}
          </div>
        </form>
      </section>

      {/* Optional subtle technical details, collapsed by default */}
      <details className="tech-details">
        <summary>
          <span>Detalles de conexión</span>
          <span className="badge">{session.isDemo ? 'Demo local' : config.env}</span>
        </summary>
        <div className="data-list">
          <div className="data-row">
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Entorno</span>
            <span className="mono" style={{ fontSize: 12 }} translate="no">
              {session.isDemo ? 'demo' : `${config.env} · ${config.region}`}
            </span>
          </div>
          <div className="data-row">
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Tiempo real</span>
            <span className="mono" style={{ fontSize: 12 }}>
              {mqttState}
            </span>
          </div>
          <div className="data-row">
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Canal</span>
            <span className="mono" style={{ fontSize: 12 }} translate="no">
              {mqttTopics.wildcard}
            </span>
          </div>
        </div>
      </details>
    </div>
  );
}
