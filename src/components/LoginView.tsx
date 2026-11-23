import { useEffect, useRef, useState, type FormEvent } from 'react';
import { isAwsConfigured } from '../config';
import { useApp } from '../context/AppContext';
import { signInWithCognito, type SignInResult } from '../services/cognito';
import { IconBuilding, IconBulb, IconCamera, IconCard, IconDoor } from './Icons';

export function LoginView() {
  const { loginWithSession, enterDemoMode } = useApp();
  const awsReady = isAwsConfigured();

  const usernameRef = useRef<HTMLInputElement | null>(null);
  const passwordRef = useRef<HTMLInputElement | null>(null);
  const newPasswordRef = useRef<HTMLInputElement | null>(null);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pendingChallenge, setPendingChallenge] = useState<SignInResult | null>(null);
  const [demoDept, setDemoDept] = useState('201');
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    username?: string;
    password?: string;
    newPassword?: string;
  }>({});
  const [formError, setFormError] = useState('');

  useEffect(() => {
    document.title = 'Iniciar sesión · Smart Hotel';
    if (awsReady && window.matchMedia('(pointer: fine)').matches) {
      usernameRef.current?.focus();
    }
  }, [awsReady]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (pendingChallenge?.status === 'new_password_required' && pendingChallenge.completeNewPassword) {
      if (newPassword.length < 8) {
        setFieldErrors({ newPassword: 'Usa al menos 8 caracteres para tu nueva contraseña.' });
        newPasswordRef.current?.focus();
        return;
      }
      setFieldErrors({});
      setLoading(true);
      try {
        const session = await pendingChallenge.completeNewPassword(newPassword);
        loginWithSession(session);
      } catch (err) {
        setFormError(err instanceof Error ? err.message : 'No pudimos guardar tu contraseña.');
      } finally {
        setLoading(false);
      }
      return;
    }

    const errors: { username?: string; password?: string } = {};
    if (!username.trim()) errors.username = 'Ingresa tu correo o usuario.';
    if (!password) errors.password = 'Ingresa tu contraseña.';

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      if (errors.username) usernameRef.current?.focus();
      else if (errors.password) passwordRef.current?.focus();
      return;
    }

    setFieldErrors({});
    setLoading(true);

    try {
      const result = await signInWithCognito(username.trim(), password);
      if (result.status === 'authenticated' && result.session) {
        loginWithSession(result.session);
      } else if (result.status === 'new_password_required') {
        setPendingChallenge(result);
        window.setTimeout(() => newPasswordRef.current?.focus(), 0);
      }
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'No pudimos verificar tus credenciales.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-shell">
      <section className="login-editorial">
        <div className="brand" style={{ padding: 0 }}>
          <div className="brand-mark">
            <IconBuilding width={18} height={18} />
          </div>
          <div>
            <div className="brand-title" translate="no">
              Smart&nbsp;Hotel
            </div>
            <div className="brand-sub">Portal de residentes</div>
          </div>
        </div>

        <div style={{ margin: '40px 0' }}>
          <h1 className="login-headline">Tu departamento, siempre a mano.</h1>
          <p className="login-copy">
            Enciende tus luces, abre accesos, revisa la cámara de entrada y administra tus tarjetas en un solo lugar.
          </p>
        </div>

        <div className="login-highlights" aria-label="Funciones disponibles">
          <span className="login-pill">
            <IconBulb width={15} height={15} />
            Luces y accesos
          </span>
          <span className="login-pill">
            <IconCamera width={15} height={15} />
            Cámara en vivo
          </span>
          <span className="login-pill">
            <IconCard width={15} height={15} />
            Tarjetas de acceso
          </span>
          <span className="login-pill">
            <IconDoor width={15} height={15} />
            Actividad al instante
          </span>
        </div>
      </section>

      <section className="login-panel">
        <div style={{ maxWidth: 360, width: '100%', margin: '0 auto' }}>
          <h2 style={{ fontSize: 24, letterSpacing: '-0.03em', fontWeight: 650 }}>
            {pendingChallenge ? 'Elige una nueva contraseña' : 'Bienvenido'}
          </h2>
          <p className="page-subtitle" style={{ marginTop: 6, marginBottom: 24 }}>
            {pendingChallenge
              ? 'Por seguridad, define tu contraseña personal para continuar.'
              : 'Inicia sesión con tu cuenta de residente.'}
          </p>

          {formError && (
            <div className="alert alert-danger" role="alert" style={{ marginBottom: 16 }}>
              {formError}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="stack-4">
            {!pendingChallenge ? (
              <>
                <div className="field">
                  <label htmlFor="username">Correo o usuario</label>
                  <input
                    ref={usernameRef}
                    id="username"
                    name="username"
                    className="input"
                    type="email"
                    inputMode="email"
                    autoComplete="username"
                    spellCheck={false}
                    placeholder="nombre@correo.com…"
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value);
                      if (fieldErrors.username) {
                        setFieldErrors((prev) => ({ ...prev, username: undefined }));
                      }
                    }}
                    aria-invalid={Boolean(fieldErrors.username)}
                    disabled={!awsReady || loading}
                  />
                  {fieldErrors.username && (
                    <span className="field-error" role="alert">
                      {fieldErrors.username}
                    </span>
                  )}
                </div>

                <div className="field">
                  <label htmlFor="password">Contraseña</label>
                  <input
                    ref={passwordRef}
                    id="password"
                    name="password"
                    className="input"
                    type="password"
                    autoComplete="current-password"
                    placeholder="Tu contraseña…"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (fieldErrors.password) {
                        setFieldErrors((prev) => ({ ...prev, password: undefined }));
                      }
                    }}
                    aria-invalid={Boolean(fieldErrors.password)}
                    disabled={!awsReady || loading}
                  />
                  {fieldErrors.password && (
                    <span className="field-error" role="alert">
                      {fieldErrors.password}
                    </span>
                  )}
                </div>
              </>
            ) : (
              <div className="field">
                <label htmlFor="newPassword">Nueva contraseña</label>
                <input
                  ref={newPasswordRef}
                  id="newPassword"
                  name="new-password"
                  className="input"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Mínimo 8 caracteres…"
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    if (fieldErrors.newPassword) {
                      setFieldErrors((prev) => ({ ...prev, newPassword: undefined }));
                    }
                  }}
                  aria-invalid={Boolean(fieldErrors.newPassword)}
                  disabled={loading}
                />
                {fieldErrors.newPassword && (
                  <span className="field-error" role="alert">
                    {fieldErrors.newPassword}
                  </span>
                )}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              disabled={(!awsReady && !pendingChallenge) || loading}
              style={{ width: '100%' }}
            >
              {loading && <span className="spinner" aria-hidden="true" />}
              {pendingChallenge ? 'Guardar y entrar' : 'Iniciar sesión'}
            </button>

            {!awsReady && (
              <p className="field-hint">
                Configura tu archivo <span className="mono" translate="no">.env</span> para iniciar con tu cuenta real, o explora la aplicación ahora en modo demo.
              </p>
            )}
          </form>

          <div className="divider">o explora en local</div>

          <div className="card" style={{ padding: 16, background: 'var(--bg-canvas)', boxShadow: 'none' }}>
            <div className="row-between" style={{ marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>Probar en modo demo</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  Elige un departamento de prueba
                </div>
              </div>
              <select
                aria-label="Departamento de prueba"
                className="select tabular"
                style={{ width: 112, minHeight: 38 }}
                value={demoDept}
                onChange={(e) => setDemoDept(e.target.value)}
              >
                <option value="201">Dpto. 201</option>
                <option value="301">Dpto. 301</option>
                <option value="401">Dpto. 401</option>
              </select>
            </div>
            <button
              type="button"
              className="btn"
              style={{ width: '100%' }}
              onClick={() => enterDemoMode(demoDept)}
            >
              Entrar al Dpto.&nbsp;{demoDept}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
