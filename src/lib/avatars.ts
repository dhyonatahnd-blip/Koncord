export interface PresetAvatar {
  id: string;
  label: string;
  dataUrl: string;
}

function makeSvgAvatar(bg1: string, bg2: string, glyph: string, accent: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${bg1}"/>
        <stop offset="100%" stop-color="${bg2}"/>
      </linearGradient>
    </defs>
    <rect width="128" height="128" rx="32" fill="url(#g)"/>
    <circle cx="64" cy="64" r="44" fill="none" stroke="${accent}" stroke-opacity="0.35" stroke-width="2"/>
    ${glyph}
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const PRESET_AVATARS: PresetAvatar[] = [
  {
    id: 'aurora',
    label: 'Aurora',
    dataUrl: makeSvgAvatar(
      '#1D4ED8',
      '#7C3AED',
      '<path d="M36 82 L64 38 L92 82 Z" fill="none" stroke="#FFFFFF" stroke-width="6" stroke-linejoin="round"/><circle cx="64" cy="66" r="7" fill="#93C5FD"/>',
      '#A5B4FC'
    ),
  },
  {
    id: 'nordic',
    label: 'Nordic',
    dataUrl: makeSvgAvatar(
      '#0F172A',
      '#1E40AF',
      '<circle cx="64" cy="52" r="18" fill="#60A5FA" fill-opacity="0.9"/><path d="M32 98 C36 78, 92 78, 96 98" fill="none" stroke="#E0F2FE" stroke-width="6" stroke-linecap="round"/>',
      '#60A5FA'
    ),
  },
  {
    id: 'prism',
    label: 'Prism',
    dataUrl: makeSvgAvatar(
      '#4C1D95',
      '#2563EB',
      '<polygon points="64,30 94,54 82,90 46,90 34,54" fill="none" stroke="#F5F3FF" stroke-width="5.5" stroke-linejoin="round"/><circle cx="64" cy="62" r="9" fill="#C4B5FD"/>',
      '#C4B5FD'
    ),
  },
  {
    id: 'meridian',
    label: 'Meridian',
    dataUrl: makeSvgAvatar(
      '#0F766E',
      '#1D4ED8',
      '<circle cx="64" cy="64" r="24" fill="none" stroke="#CCFBF1" stroke-width="5.5"/><ellipse cx="64" cy="64" rx="11" ry="24" fill="none" stroke="#99F6E4" stroke-width="4"/><line x1="40" y1="64" x2="88" y2="64" stroke="#99F6E4" stroke-width="4"/>',
      '#5EEAD4'
    ),
  },
  {
    id: 'cobalt',
    label: 'Cobalt',
    dataUrl: makeSvgAvatar(
      '#1E1B4B',
      '#4338CA',
      '<rect x="42" y="42" width="44" height="44" rx="12" transform="rotate(45 64 64)" fill="none" stroke="#E0E7FF" stroke-width="5.5"/><circle cx="64" cy="64" r="8" fill="#818CF8"/>',
      '#818CF8'
    ),
  },
  {
    id: 'horizon',
    label: 'Horizon',
    dataUrl: makeSvgAvatar(
      '#1E293B',
      '#6D28D9',
      '<circle cx="64" cy="54" r="14" fill="#FDE68A" fill-opacity="0.9"/><path d="M28 84 Q48 70 64 84 T100 84" fill="none" stroke="#DDD6FE" stroke-width="5.5" stroke-linecap="round"/>',
      '#A78BFA'
    ),
  },
  {
    id: 'pulse',
    label: 'Pulse',
    dataUrl: makeSvgAvatar(
      '#312E81',
      '#0369A1',
      '<polyline points="28,68 46,68 56,42 70,86 82,56 98,56" fill="none" stroke="#E0F2FE" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/>',
      '#38BDF8'
    ),
  },
  {
    id: 'orbit',
    label: 'Orbit',
    dataUrl: makeSvgAvatar(
      '#18181B',
      '#3730A3',
      '<circle cx="64" cy="64" r="13" fill="#A5B4FC"/><ellipse cx="64" cy="64" rx="34" ry="14" transform="rotate(-28 64 64)" fill="none" stroke="#E0E7FF" stroke-width="4.5"/>',
      '#818CF8'
    ),
  },
];
