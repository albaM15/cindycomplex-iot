import { useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import type { MqttConnectionState } from '../types';
import {
  IconActivity,
  IconBuilding,
  IconCamera,
  IconCard,
  IconLogout,
  IconSliders,
  IconUser,
} from './Icons';

const navItems = [
  { to: '/', label: 'Inicio', title: 'Inicio', icon: IconSliders, end: true },
  { to: '/camera', label: 'Cámara', title: 'Cámara', icon: IconCamera },
  { to: '/rfid', label: 'Tarjetas', title: 'Tarjetas de acceso', icon: IconCard },
  { to: '/events', label: 'Actividad', title: 'Actividad', icon: IconActivity },
  { to: '/profile', label: 'Perfil', title: 'Mi perfil', icon: IconUser },
];

function liveStatus(state: MqttConnectionState): { text: string; dot: string } {
  switch (state) {
    case 'connected':
      return { text: 'Conectado en vivo', dot: 'ok' };
    case 'demo':
      return { text: 'Modo demo activo', dot: 'accent' };
    case 'connecting':
    case 'reconnecting':
      return { text: 'Conectando…', dot: 'warn' };
    case 'error':
      return { text: 'Sin conexión en vivo', dot: 'danger' };
    default:
      return { text: 'Desconectado', dot: '' };
  }
}

export function Layout() {
  const { session, mqttState, logout } = useApp();
  const { pathname } = useLocation();
  const status = liveStatus(mqttState);

  useEffect(() => {
    const current = navItems.find((item) =>
      item.end ? pathname === item.to : pathname.startsWith(item.to)
    );
    document.title = current ? `${current.title} · Smart Hotel` : 'Smart Hotel';
  }, [pathname]);

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        Saltar al contenido
      </a>

      <aside className="sidebar" aria-label="Navegación principal">
        <div className="brand">
          <div className="brand-mark">
            <IconBuilding width={18} height={18} />
          </div>
          <div className="min-w-0">
            <div className="brand-title" translate="no">
              Smart&nbsp;Hotel
            </div>
            <div className="brand-sub tabular">Dpto.&nbsp;{session?.department ?? '—'}</div>
          </div>
        </div>

        <nav className="nav-list">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
              >
                <Icon />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="live-pill" role="status">
            <span className={`status-dot ${status.dot}`} aria-hidden="true" />
            <span>{status.text}</span>
          </div>

          <button type="button" className="btn btn-ghost btn-sm" onClick={logout}>
            <IconLogout width={16} height={16} />
            Cerrar sesión
          </button>
        </div>
      </aside>

      <header className="mobile-bar">
        <div className="row-between">
          <div className="brand" style={{ padding: 0 }}>
            <div className="brand-mark" style={{ width: 32, height: 32 }}>
              <IconBuilding width={16} height={16} />
            </div>
            <div>
              <div className="brand-title" style={{ fontSize: 14 }} translate="no">
                Smart&nbsp;Hotel
              </div>
              <div className="brand-sub tabular">Dpto.&nbsp;{session?.department ?? '—'}</div>
            </div>
          </div>

          <div className="row" style={{ gap: 8 }}>
            <span className="badge">
              <span className={`status-dot ${status.dot}`} aria-hidden="true" />
              {mqttState === 'connected' ? 'En vivo' : mqttState === 'demo' ? 'Demo' : status.text}
            </span>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={logout}
              aria-label="Cerrar sesión"
            >
              <IconLogout width={16} height={16} />
            </button>
          </div>
        </div>

        <nav className="mobile-nav" aria-label="Navegación móvil">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main id="main-content" className="main-area" tabIndex={-1}>
        {session?.isDemo && (
          <div className="demo-bar" role="status">
            <span>
              Estás viendo una <strong>vista de demostración</strong> en local para el departamento {session.department}.
            </span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={logout}>
              Cambiar cuenta
            </button>
          </div>
        )}
        <Outlet />
      </main>
    </div>
  );
}
