// ─── Theme Definitions ───────────────────────────────────────────
// Single source of truth for all theme palettes.
// Edit ONLY this file to tweak any theme's colors.
// Keep in sync with the blocking <script> in index.html.
//
// The palettes share one recipe (OKLCH), taken from Slate and Indigo: one hue
// for the ground, the background glow, the hero gradient and the accent
// (glow within ±10°); a near-neutral ground (chroma ≤ 0.03); a mid-strength
// accent (lightness ≈ 0.72, chroma ≤ 0.12) with a dark label on the CTA.
// The newer palettes also keep text-m at 4.4:1 or more on base. Avoid stock
// Tailwind 500s and multi-hue gradients: they read as neon.
//
// Order below drives the picker grid (5 × 3, see THEME_GROUPS):
//   Neutral: mono    slate   stone
//   Cool:    teal    navy    indigo
//   Warm:    plum    rose    brick
//   Earth:   clay    ochre   sage
//   Light:   paper   mist    linen
// The coloured rows run once round the colour wheel, teal → sage.
// ──────────────────────────────────────────────────────────────────

export const THEME_IDS = [
  'mono', 'slate', 'stone',
  'teal', 'navy', 'indigo',
  'plum', 'rose', 'brick',
  'clay', 'ochre', 'sage',
  'paper', 'mist', 'linen',
] as const
export type ThemeId = (typeof THEME_IDS)[number]
export const DEFAULT_THEME: ThemeId = 'navy'

// Picker rows, in THEME_IDS order
export const THEME_GROUPS: { label: string; ids: ThemeId[] }[] = [
  { label: 'Neutral', ids: ['mono', 'slate', 'stone'] },
  { label: 'Cool', ids: ['teal', 'navy', 'indigo'] },
  { label: 'Warm', ids: ['plum', 'rose', 'brick'] },
  { label: 'Earth', ids: ['clay', 'ochre', 'sage'] },
  { label: 'Light', ids: ['paper', 'mist', 'linen'] },
]

export interface ThemeColors {
  '--deep': string
  '--base': string
  '--card': string
  '--panel': string
  '--input': string
  '--border': string
  '--text-1': string
  '--text-2': string
  '--text-m': string
  '--accent-l': string
  '--accent': string
  '--accent-d': string
  '--accent-rgb': string
  '--nav-bg': string
  '--shadow': string
  '--vignette': string
  '--check-color': string
  '--btn-text': string
  '--logo-bg': string
  '--p-grad': string
  '--wave-c1': string
  '--wave-c2': string
  '--wave-c3': string
  '--wave-c4': string
}

export const themes: Record<ThemeId, ThemeColors> = {
  // ── Mono — true AMOLED black, grayscale ─────────────────
  mono: {
    '--deep': '#000000',
    '--base': '#030303',
    '--card': '#080808',
    '--panel': '#0d0d0d',
    '--input': '#141414',
    '--border': '#1f1f1f',
    '--text-1': '#fafafa',
    '--text-2': '#d4d4d4',
    '--text-m': '#737373',
    '--accent-l': '#fafafa',
    '--accent': '#a3a3a3',
    '--accent-d': '#525252',
    '--accent-rgb': '163,163,163',
    '--nav-bg': 'rgba(5,5,5,0.95)',
    '--shadow': 'rgba(0,0,0,0.5)',
    '--vignette': '#000000',
    '--check-color': 'white',
    '--btn-text': 'black',
    '--logo-bg': '#050505',
    '--p-grad': 'linear-gradient(135deg, #fafafa 0%, #a3a3a3 50%, #525252 100%)',
    '--wave-c1': '#d4d4d4',
    '--wave-c2': '#737373',
    '--wave-c3': '#a3a3a3',
    '--wave-c4': '#525252',
  },

  // ── Slate — cool blue-gray steel ────────────────────────
  slate: {
    '--deep': '#0f1318',
    '--base': '#1c2128',
    '--card': '#252c36',
    '--panel': '#2c343f',
    '--input': '#232a33',
    '--border': '#3a4250',
    '--text-1': '#e2e8f0',
    '--text-2': '#b8c2d0',
    '--text-m': '#64748b',
    '--accent-l': '#cbd5e1',
    '--accent': '#94a3b8',
    '--accent-d': '#64748b',
    '--accent-rgb': '148,163,184',
    '--nav-bg': 'rgba(28,33,40,0.95)',
    '--shadow': 'rgba(0,0,0,0.35)',
    '--vignette': '#0f1318',
    '--check-color': 'white',
    '--btn-text': '#1c2128',
    '--logo-bg': '#252c36',
    '--p-grad': 'linear-gradient(135deg, #cbd5e1 0%, #94a3b8 50%, #64748b 100%)',
    '--wave-c1': '#475569',
    '--wave-c2': '#334155',
    '--wave-c3': '#64748b',
    '--wave-c4': '#3f4a5c',
  },

  // ── Stone — warm gray, Slate's warm twin ────────────────
  stone: {
    '--deep': '#110e0b',
    '--base': '#1c1915',
    '--card': '#25211d',
    '--panel': '#2c2824',
    '--input': '#211d1a',
    '--border': '#3b3732',
    '--text-1': '#eae7e4',
    '--text-2': '#c5c0bb',
    '--text-m': '#918b84',
    '--accent-l': '#d9cfc4',
    '--accent': '#b7a897',
    '--accent-d': '#918475',
    '--accent-rgb': '183,168,151',
    '--nav-bg': 'rgba(28,25,21,0.95)',
    '--shadow': 'rgba(0,0,0,0.35)',
    '--vignette': '#110e0b',
    '--check-color': 'white',
    '--btn-text': '#1c1915',
    '--logo-bg': '#25211d',
    '--p-grad': 'linear-gradient(135deg, #d9cfc6 0%, #b7a897 50%, #83796a 100%)',
    '--wave-c1': '#655447',
    '--wave-c2': '#4f4639',
    '--wave-c3': '#7f7264',
    '--wave-c4': '#433c33',
  },

  // ── Teal — petrol ground, muted teal ────────────────────
  teal: {
    '--deep': '#051112',
    '--base': '#0c1c1e',
    '--card': '#142527',
    '--panel': '#1b2c2e',
    '--input': '#112123',
    '--border': '#283c3e',
    '--text-1': '#deebec',
    '--text-2': '#b1c5c8',
    '--text-m': '#779295',
    '--accent-l': '#a3d5db',
    '--accent': '#5db4be',
    '--accent-d': '#408d96',
    '--accent-rgb': '93,180,190',
    '--nav-bg': 'rgba(12,28,30,0.95)',
    '--shadow': 'rgba(0,0,0,0.35)',
    '--vignette': '#051112',
    '--check-color': 'white',
    '--btn-text': '#0c1c1e',
    '--logo-bg': '#142527',
    '--p-grad': 'linear-gradient(135deg, #aedbdc 0%, #5db4be 50%, #408693 100%)',
    '--wave-c1': '#196464',
    '--wave-c2': '#1d505a',
    '--wave-c3': '#447f86',
    '--wave-c4': '#204349',
  },

  // ── Navy (default) — navy ground, muted sky ─────────────
  navy: {
    '--deep': '#060f1a',
    '--base': '#0f1a28',
    '--card': '#162232',
    '--panel': '#1e2a39',
    '--input': '#141f2d',
    '--border': '#2b394b',
    '--text-1': '#e1e9f2',
    '--text-2': '#b6c2d1',
    '--text-m': '#7e8ea2',
    '--accent-l': '#a3d1f1',
    '--accent': '#60aedf',
    '--accent-d': '#4388b2',
    '--accent-rgb': '96,174,223',
    '--nav-bg': 'rgba(15,26,40,0.95)',
    '--shadow': 'rgba(0,0,0,0.35)',
    '--vignette': '#060f1a',
    '--check-color': 'white',
    '--btn-text': '#0f1a28',
    '--logo-bg': '#162232',
    '--p-grad': 'linear-gradient(135deg, #acd8f1 0%, #60aedf 50%, #4980ab 100%)',
    '--wave-c1': '#0f617d',
    '--wave-c2': '#264b6a',
    '--wave-c3': '#467b9c',
    '--wave-c4': '#234056',
  },

  // ── Indigo — tokyo-night deep navy ──────────────────────
  indigo: {
    '--deep': '#0f1019',
    '--base': '#1a1b26',
    '--card': '#1f2335',
    '--panel': '#24283b',
    '--input': '#1c1f30',
    '--border': '#2f3550',
    '--text-1': '#c0caf5',
    '--text-2': '#9aa5ce',
    '--text-m': '#565f89',
    '--accent-l': '#7aa2f7',
    '--accent': '#5b7cd9',
    '--accent-d': '#3d59a1',
    '--accent-rgb': '91,124,217',
    '--nav-bg': 'rgba(26,27,38,0.95)',
    '--shadow': 'rgba(0,0,0,0.4)',
    '--vignette': '#0f1019',
    '--check-color': 'white',
    '--btn-text': 'white',
    '--logo-bg': '#1f2335',
    '--p-grad': 'linear-gradient(135deg, #7aa2f7 0%, #5b7cd9 50%, #3d59a1 100%)',
    '--wave-c1': '#3d59a1',
    '--wave-c2': '#5b7cd9',
    '--wave-c3': '#7aa2f7',
    '--wave-c4': '#2c3552',
  },

  // ── Plum — plum ground, dusty lavender ──────────────────
  plum: {
    '--deep': '#120c14',
    '--base': '#1e1621',
    '--card': '#261e2a',
    '--panel': '#2e2532',
    '--input': '#221b26',
    '--border': '#3d3442',
    '--text-1': '#ece5ef',
    '--text-2': '#c7bdcc',
    '--text-m': '#94869b',
    '--accent-l': '#d2c2e7',
    '--accent': '#b197d0',
    '--accent-d': '#8b75a5',
    '--accent-rgb': '177,151,208',
    '--nav-bg': 'rgba(30,22,33,0.95)',
    '--shadow': 'rgba(0,0,0,0.35)',
    '--vignette': '#120c14',
    '--check-color': 'white',
    '--btn-text': '#1e1621',
    '--logo-bg': '#261e2a',
    '--p-grad': 'linear-gradient(135deg, #d5cbec 0%, #b197d0 50%, #886e9a 100%)',
    '--wave-c1': '#5b507b',
    '--wave-c2': '#523f5d',
    '--wave-c3': '#7d6b93',
    '--wave-c4': '#44374e',
  },

  // ── Rose — warm charcoal, dusty rose ────────────────────
  rose: {
    '--deep': '#140c0c',
    '--base': '#201716',
    '--card': '#291f1e',
    '--panel': '#312625',
    '--input': '#251b1b',
    '--border': '#413434',
    '--text-1': '#eee5e5',
    '--text-2': '#cbbdbd',
    '--text-m': '#998786',
    '--accent-l': '#e7bfc5',
    '--accent': '#ce919c',
    '--accent-d': '#a46f78',
    '--accent-rgb': '206,145,156',
    '--nav-bg': 'rgba(32,23,22,0.95)',
    '--shadow': 'rgba(0,0,0,0.35)',
    '--vignette': '#140c0c',
    '--check-color': 'white',
    '--btn-text': '#201716',
    '--logo-bg': '#291f1e',
    '--p-grad': 'linear-gradient(135deg, #eac6cf 0%, #ce919c 50%, #9c6b6f 100%)',
    '--wave-c1': '#744a58',
    '--wave-c2': '#5f3d3f',
    '--wave-c3': '#91676e',
    '--wave-c4': '#4e3538',
  },

  // ── Brick — oxblood ground, brick red ───────────────────
  brick: {
    '--deep': '#170a0a',
    '--base': '#251414',
    '--card': '#2e1c1b',
    '--panel': '#362322',
    '--input': '#2a1918',
    '--border': '#473130',
    '--text-1': '#f2e4e3',
    '--text-2': '#d1bbba',
    '--text-m': '#a18483',
    '--accent-l': '#e3a69b',
    '--accent': '#d17465',
    '--accent-d': '#a45448',
    '--accent-rgb': '209,116,101',
    '--nav-bg': 'rgba(37,20,20,0.95)',
    '--shadow': 'rgba(0,0,0,0.35)',
    '--vignette': '#170a0a',
    '--check-color': 'white',
    '--btn-text': '#251414',
    '--logo-bg': '#2e1c1b',
    '--p-grad': 'linear-gradient(135deg, #fac1bc 0%, #d17465 50%, #ae634f 100%)',
    '--wave-c1': '#7f4545',
    '--wave-c2': '#653b2e',
    '--wave-c3': '#9a645b',
    '--wave-c4': '#53342c',
  },

  // ── Clay — warm charcoal, terracotta ────────────────────
  clay: {
    '--deep': '#120d09',
    '--base': '#1f1813',
    '--card': '#27201b',
    '--panel': '#2f2722',
    '--input': '#231c18',
    '--border': '#3f3630',
    '--text-1': '#ede6e3',
    '--text-2': '#c8bfb9',
    '--text-m': '#968981',
    '--accent-l': '#dfbca3',
    '--accent': '#c79169',
    '--accent-d': '#9d6f4c',
    '--accent-rgb': '199,145,105',
    '--nav-bg': 'rgba(31,24,19,0.95)',
    '--shadow': 'rgba(0,0,0,0.35)',
    '--vignette': '#120d09',
    '--check-color': 'white',
    '--btn-text': '#1f1813',
    '--logo-bg': '#27201b',
    '--p-grad': 'linear-gradient(135deg, #ebc9b6 0%, #c79169 50%, #99714c 100%)',
    '--wave-c1': '#764d37',
    '--wave-c2': '#5b4228',
    '--wave-c3': '#8f6c52',
    '--wave-c4': '#4c3928',
  },

  // ── Ochre — umber ground, muted ochre ───────────────────
  ochre: {
    '--deep': '#110e09',
    '--base': '#1c1912',
    '--card': '#25211a',
    '--panel': '#2c2821',
    '--input': '#211e17',
    '--border': '#3c372f',
    '--text-1': '#eae7e2',
    '--text-2': '#c5c0b7',
    '--text-m': '#928b7f',
    '--accent-l': '#e3d3ad',
    '--accent': '#c4ab6e',
    '--accent-d': '#9c8751',
    '--accent-rgb': '196,171,110',
    '--nav-bg': 'rgba(28,25,18,0.95)',
    '--shadow': 'rgba(0,0,0,0.35)',
    '--vignette': '#110e09',
    '--check-color': 'white',
    '--btn-text': '#1c1912',
    '--logo-bg': '#25211a',
    '--p-grad': 'linear-gradient(135deg, #e1cfaf 0%, #c4ab6e 50%, #887a47 100%)',
    '--wave-c1': '#6b5430',
    '--wave-c2': '#4f4829',
    '--wave-c3': '#82734f',
    '--wave-c4': '#443d27',
  },

  // ── Sage — moss ground, sage green ──────────────────────
  sage: {
    '--deep': '#0a100b',
    '--base': '#141c15',
    '--card': '#1b241d',
    '--panel': '#222c24',
    '--input': '#18211a',
    '--border': '#313b32',
    '--text-1': '#e3eae4',
    '--text-2': '#b9c4bb',
    '--text-m': '#829184',
    '--accent-l': '#b6d4bb',
    '--accent': '#83b28c',
    '--accent-d': '#638c6b',
    '--accent-rgb': '131,178,140',
    '--nav-bg': 'rgba(20,28,21,0.95)',
    '--shadow': 'rgba(0,0,0,0.35)',
    '--vignette': '#0a100b',
    '--check-color': 'white',
    '--btn-text': '#141c15',
    '--logo-bg': '#1b241d',
    '--p-grad': 'linear-gradient(135deg, #c1d9c0 0%, #83b28c 50%, #5b866b 100%)',
    '--wave-c1': '#466040',
    '--wave-c2': '#31503e',
    '--wave-c3': '#5e7e64',
    '--wave-c4': '#2e4334',
  },

  // ── Paper — neutral light, slate accent ─────────────────
  paper: {
    '--deep': '#d5d8db',
    '--base': '#f2f4f5',
    '--card': '#ffffff',
    '--panel': '#e7eaed',
    '--input': '#e2e5e8',
    '--border': '#ced1d5',
    '--text-1': '#1c2024',
    '--text-2': '#43484e',
    '--text-m': '#6d7278',
    '--accent-l': '#495a6b',
    '--accent': '#607183',
    '--accent-d': '#798898',
    '--accent-rgb': '96,113,131',
    '--nav-bg': 'rgba(242,244,245,0.95)',
    '--shadow': 'rgba(20,30,50,0.07)',
    '--vignette': '#d5d8db',
    '--check-color': 'white',
    '--btn-text': 'white',
    '--logo-bg': '#f2f4f5',
    '--p-grad': 'linear-gradient(135deg, #384a59 0%, #607183 50%, #818d9d 100%)',
    '--wave-c1': '#c6d3dd',
    '--wave-c2': '#d8dee7',
    '--wave-c3': '#d0d9e2',
    '--wave-c4': '#c5cbd2',
  },

  // ── Mist — cool light, slate-blue accent ────────────────
  mist: {
    '--deep': '#d1d8e1',
    '--base': '#f0f4f8',
    '--card': '#ffffff',
    '--panel': '#e4eaf2',
    '--input': '#dfe5ed',
    '--border': '#cad2db',
    '--text-1': '#18202b',
    '--text-2': '#3e4956',
    '--text-m': '#677381',
    '--accent-l': '#2e598f',
    '--accent': '#4570a8',
    '--accent-d': '#6388b9',
    '--accent-rgb': '69,112,168',
    '--nav-bg': 'rgba(240,244,248,0.95)',
    '--shadow': 'rgba(20,30,50,0.07)',
    '--vignette': '#d1d8e1',
    '--check-color': 'white',
    '--btn-text': 'white',
    '--logo-bg': '#f0f4f8',
    '--p-grad': 'linear-gradient(135deg, #0f4a7b 0%, #4570a8 50%, #718dbd 100%)',
    '--wave-c1': '#b6d5f0',
    '--wave-c2': '#d2dff6',
    '--wave-c3': '#c6d9f2',
    '--wave-c4': '#bfcbdf',
  },

  // ── Linen — warm cream + taupe ──────────────────────────
  linen: {
    '--deep': '#c8bea8',
    '--base': '#f5f1ea',
    '--card': '#fdfaf4',
    '--panel': '#ede5d6',
    '--input': '#e8e0d0',
    '--border': '#d0c5b0',
    '--text-1': '#3a2f24',
    '--text-2': '#5c4e3e',
    '--text-m': '#998a72',
    '--accent-l': '#a89070',
    '--accent': '#8b7355',
    '--accent-d': '#6e5a40',
    '--accent-rgb': '139,115,85',
    '--nav-bg': 'rgba(245,241,234,0.95)',
    '--shadow': 'rgba(60,40,20,0.08)',
    '--vignette': '#c8bea8',
    '--check-color': 'white',
    '--btn-text': 'white',
    '--logo-bg': '#f5f1ea',
    '--p-grad': 'linear-gradient(135deg, #a89070 0%, #8b7355 50%, #6e5a40 100%)',
    '--wave-c1': '#e8dfd0',
    '--wave-c2': '#d9cdb8',
    '--wave-c3': '#c9b896',
    '--wave-c4': '#b09e85',
  },
}
