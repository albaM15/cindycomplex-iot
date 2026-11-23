import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

const baseProps: IconProps = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
};

export function IconBuilding(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M9 8h2M13 8h2M9 12h2M13 12h2M10 21v-4h4v4" />
    </svg>
  );
}

export function IconSliders(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <line x1="4" y1="7" x2="20" y2="7" />
      <circle cx="9" cy="7" r="2.2" fill="var(--bg-surface)" />
      <line x1="4" y1="17" x2="20" y2="17" />
      <circle cx="15" cy="17" r="2.2" fill="var(--bg-surface)" />
    </svg>
  );
}

export function IconCamera(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <rect x="3" y="6" width="14" height="12" rx="2" />
      <path d="M17 10l4-2.5v9L17 14" />
    </svg>
  );
}

export function IconCard(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="7" y1="15" x2="11" y2="15" />
    </svg>
  );
}

export function IconActivity(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <polyline points="3 12 7 12 10 5 14 19 17 12 21 12" />
    </svg>
  );
}

export function IconUser(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <circle cx="12" cy="8" r="4" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </svg>
  );
}

export function IconBulb(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.7.5 1 1.2 1 2.1h5c0-.9.3-1.6 1-2.1A6 6 0 0 0 12 3Z" />
    </svg>
  );
}

export function IconGarage(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M3 10L12 4l9 6v10H3V10Z" />
      <path d="M7 20v-7h10v7M7 16h10" />
    </svg>
  );
}

export function IconDoor(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M5 21V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v17" />
      <line x1="3" y1="21" x2="21" y2="21" />
      <circle cx="15" cy="12" r="1" fill="currentColor" />
    </svg>
  );
}

export function IconBellOff(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" />
      <path d="M6.3 6.3A6 6 0 0 0 6 8c0 5-2 7-2 7h11" />
      <path d="M18 11V8a6 6 0 0 0-9.3-5" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  );
}

export function IconRefresh(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M21 12a9 9 0 1 1-2.6-6.4L21 8" />
      <polyline points="21 3 21 8 16 8" />
    </svg>
  );
}

export function IconTrash(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6" />
    </svg>
  );
}

export function IconLogout(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}
