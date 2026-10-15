// Inline SVG icon set.
// Product media is supplied by the real catalog photography mapping in views.js.

const ICON_PATHS = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  user: '<circle cx="12" cy="8" r="3.6"/><path d="M4.8 20c.8-3.4 3.4-5.3 7.2-5.3s6.4 1.9 7.2 5.3"/>',
  cart: '<circle cx="9.5" cy="19.5" r="1.4"/><circle cx="17.5" cy="19.5" r="1.4"/><path d="M2.5 3.5h2.6l2.4 11.2a1.5 1.5 0 0 0 1.5 1.2h8.4a1.5 1.5 0 0 0 1.5-1.1L21 7.5H6"/>',
  chevronRight: '<path d="m9 18 6-6-6-6"/>',
  chevronLeft: '<path d="m15 18-6-6 6-6"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  arrowRight: '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
  arrowLeft: '<path d="M19 12H5"/><path d="m11 18-6-6 6-6"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  trash: '<path d="M4 7h16"/><path d="M9.5 7V4.5h5V7"/><path d="m6.5 7 .9 12.1a1.5 1.5 0 0 0 1.5 1.4h6.2a1.5 1.5 0 0 0 1.5-1.4L17.5 7"/><path d="M10 11v5.5M14 11v5.5"/>',
  package: '<path d="m3.5 7.5 8.5-4 8.5 4-8.5 4-8.5-4Z"/><path d="M3.5 7.5v9l8.5 4 8.5-4v-9"/><path d="M12 11.5v9"/>',
  shield: '<path d="M12 3 5 6v5.2c0 4.5 2.9 7.9 7 9.8 4.1-1.9 7-5.3 7-9.8V6l-7-3Z"/><path d="m9 12 2 2 4-4"/>',
  lock: '<rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
  phone: '<path d="M6.6 3.5h2.8l1.4 3.9-2 1.4a12.5 12.5 0 0 0 6.4 6.4l1.4-2 3.9 1.4v2.8c0 1-.9 1.8-1.9 1.7C11 18.5 5.5 13 4.9 5.4c-.1-1 .7-1.9 1.7-1.9Z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/>',
  mapPin: '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z"/><circle cx="12" cy="10" r="2.3"/>',
  menu: '<path d="M4 6.5h16M4 12h16M4 17.5h16"/>',
  filter: '<path d="M4 5h16l-6.2 7.4v5.4l-3.6 1.7v-7.1L4 5Z"/>',
  sliders: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
  truck: '<path d="M2.5 6.5h11v9h-11z"/><path d="M13.5 9.5h4l3 3.2v2.8h-7"/><circle cx="6.5" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>',
  badgeCheck: '<path d="m12 2.8 2.3 1.7 2.9-.1.9 2.7 2.3 1.8-.9 2.7.9 2.7-2.3 1.8-.9 2.7-2.9-.1L12 21.2l-2.3-1.7-2.9.1-.9-2.7-2.3-1.8.9-2.7-.9-2.7 2.3-1.8.9-2.7 2.9.1L12 2.8Z"/><path d="m8.8 12 2.2 2.2 4.2-4.4"/>',
  headset: '<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3.5" y="13.5" width="4" height="6" rx="1.6"/><rect x="16.5" y="13.5" width="4" height="6" rx="1.6"/><path d="M18.5 19.5c0 1.2-1.6 2-4 2h-1.5"/>',
  creditCard: '<rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M2.5 9.5h19M6.5 15h3"/>',
  bot: '<rect x="4" y="8" width="16" height="11.5" rx="3.5"/><path d="M12 4.5V8"/><circle cx="12" cy="3.6" r="1.1"/><circle cx="9" cy="13.5" r="1.2"/><circle cx="15" cy="13.5" r="1.2"/><path d="M2 13v2.5M22 13v2.5"/>',
  send: '<path d="M21 3 10.5 13.5"/><path d="m21 3-6.5 18-4-7.5L3 9.5 21 3Z"/>',
  sparkles: '<path d="M12 3.5 13.6 8a3 3 0 0 0 1.9 1.9L20 11.5l-4.5 1.6a3 3 0 0 0-1.9 1.9L12 19.5 10.4 15a3 3 0 0 0-1.9-1.9L4 11.5 8.5 9.9A3 3 0 0 0 10.4 8L12 3.5Z"/><path d="M19 3v3M17.5 4.5h3"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.6-4.5L4 8"/><path d="M4 3.5V8h4.5"/><path d="M4 13a8 8 0 0 0 14.6 4.5L20 16"/><path d="M20 20.5V16h-4.5"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  checkCircle: '<circle cx="12" cy="12" r="9"/><path d="m8.2 12.3 2.6 2.6 5-5.2"/>',
  alert: '<path d="M12 3.5 2.8 19.5h18.4L12 3.5Z"/><path d="M12 10v4.2M12 17h.01"/>',
  alertCircle: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.2M12 16.3h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.7h.01"/>',
  logout: '<path d="M9.5 20.5H5.5a1.5 1.5 0 0 1-1.5-1.5V5a1.5 1.5 0 0 1 1.5-1.5h4"/><path d="m15.5 16.5 4.5-4.5-4.5-4.5"/><path d="M20 12H9"/>',
  home: '<path d="m3.5 11 8.5-7 8.5 7"/><path d="M5.5 9.5v10h13v-10"/><path d="M10 19.5v-5.5h4v5.5"/>',
  grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.4"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.4"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.4"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.4"/>',
  tag: '<path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3a1.5 1.5 0 0 1 0 2.1l-6.1 6.1a1.5 1.5 0 0 1-2.1 0l-8.8-7.8Z"/><circle cx="8" cy="8" r="1.4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M10.6 5.6A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a16 16 0 0 1-2.5 3.3"/><path d="M6.5 6.9C3.9 8.6 2.5 12 2.5 12S6 18.5 12 18.5c1.8 0 3.4-.6 4.7-1.4"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/><path d="m3 3 18 18"/>',
  receipt: '<path d="M5.5 3.5h13v17l-2.2-1.4-2.1 1.4-2.2-1.4-2.2 1.4-2.1-1.4-2.2 1.4v-17Z"/><path d="M9 8h6M9 11.5h6M9 15h3.5"/>',
  chat: '<path d="M4 5.5h16v10.5H9.5L5 19.5V16H4z"/><path d="M8 10h8M8 13h5"/>',
  zap: '<path d="M13 2.5 4.5 13.5H12l-1 8 8.5-11H12l1-8Z"/>',
  store: '<path d="M3.5 9.5 5 4h14l1.5 5.5"/><path d="M3.5 9.5a2.8 2.8 0 0 0 5.6 0 2.8 2.8 0 0 0 5.6 0 2.8 2.8 0 0 0 5.6 0"/><path d="M5 12v8h14v-8"/><path d="M10 20v-4.5h4V20"/>',
};

export function icon(name, size = 20, className = '') {
  const cls = className ? ` class="${className}"` : '';
  return `<svg${cls} width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICON_PATHS[name] || ICON_PATHS.package}</svg>`;
}

export function logoMark(size = 34) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 40 40" aria-hidden="true" focusable="false">
    <rect width="40" height="40" rx="10" fill="#2563eb"/>
    <path d="M11 13h18v4h-7v13h-4V17h-7z" fill="#fff"/>
    <circle cx="29" cy="28" r="3" fill="#93c5fd"/>
  </svg>`;
}
