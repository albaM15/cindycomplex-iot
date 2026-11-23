const timeFormatter = new Intl.DateTimeFormat('es-ES', {
  hour: '2-digit',
  minute: '2-digit',
});

const dateTimeFormatter = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

const shortDateFormatter = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const tempFormatter = new Intl.NumberFormat('es-ES', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const relativeFormatter = new Intl.RelativeTimeFormat('es-ES', {
  numeric: 'auto',
});

export function formatTemperature(value: number): string {
  return `${tempFormatter.format(value)}\u00A0°C`;
}

export function formatShortDate(iso?: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return shortDateFormatter.format(date);
}

export function formatFriendlyTime(iso?: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  const diffSec = Math.round((date.getTime() - Date.now()) / 1000);
  const absSec = Math.abs(diffSec);

  if (absSec < 45) return 'Ahora';
  if (absSec < 3600) {
    return relativeFormatter.format(Math.round(diffSec / 60), 'minute');
  }

  const now = new Date();
  const sameDay =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (sameDay) {
    return `Hoy, ${timeFormatter.format(date)}`;
  }

  return dateTimeFormatter.format(date);
}

export function formatEventLabel(type: string): string {
  const key = type.toUpperCase();
  if (key.includes('RFID_ACCESS') || key.includes('RFID_GRANTED')) return 'Acceso con tarjeta';
  if (key.includes('RFID_REGISTERED')) return 'Tarjeta agregada';
  if (key.includes('RFID_DELETED')) return 'Tarjeta eliminada';
  if (key.includes('LIGHT')) return 'Iluminación';
  if (key.includes('GARAGE')) return 'Cochera';
  if (key.includes('DOOR_FORCED')) return 'Puerta abierta';
  if (key.includes('DOOR')) return 'Puerta principal';
  if (key.includes('ALARM_SILENCED')) return 'Alarma silenciada';
  if (key.includes('ALARM')) return 'Alerta de seguridad';
  if (key.includes('CAMERA') || key.includes('SNAPSHOT')) return 'Cámara';
  return 'Actividad';
}
