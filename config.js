// ============================================================
// ALP PLANNER - CONFIG
// ============================================================

const CONFIG = {

  gateway: 'GEG',

  shiftCutoffHour: 12,

  // ── AIRCRAFT POSITION LAYOUTS ──────────────────────────────
  aircraft: {
    'A3': {
      label: 'A300',
      topDeck:   ['1','2L','3L','4L','5L','6L','7L','8L','9L','10L','11L','12L','2R','3R','4R','5R','6R','7R','8R','9R','10R','11R','12R','13'],
      lowerDeck: ['P1','P2','P3','P4','P5','P6','P7','AB'],
    },
    '76': {
      label: '767',
      topDeck:   ['1','2L','3L','4L','5L','6L','7L','8L','9L','10L','2R','3R','4R','5R','6R','7R','8R','9R','10R','11','12','13'],
      lowerDeck: ['P1','P2','P3','P4','P5','P6','P7','AB'],
    },
    '75': {
      label: '757',
      mainDeck:  ['1','2','3','4','5','6','7','8','9','10','11','12','13','14','15'],
    },
  },

  // ── TRAILER UID → TYPE ─────────────────────────────────────
  // 'A4' = 4 slots, 'A5' = 5 slots
  trailerTypes: {
    // '12345': 'A4',
    // '67890': 'A5',
  },

  // ── THROUGH-FREIGHT ORIGIN → GATEWAY ───────────────────────
  throughFreightOrigins: {
    '4009': 'SDF',
    '9159': 'ONT',
  },

  gatewayToSlic: {
    'SDF': '4009',
    'ONT': '9159',
  },

  // ── DISPO ROUTING OVERRIDES ────────────────────────────────
  dispoRouting: {
    'P': 'USPS',
    'X': 'USPS',
  },

  // ── DESTINATION ROUTING ────────────────────────────────────
  // section options: 'USPS', 'MDU', 'SFAC', 'HOLDOVER', 'TRAILER', 'THROUGH'
  destinationRouting: {
    AM: {
      '9949S': { section: 'MDU' },
      '9929N': { section: 'HOLDOVER' },
      '9929T': { section: 'HOLDOVER' },
      '9929P': { section: 'TRAILER', trailerDest: '9929P' },
      '8385P': { section: 'TRAILER', trailerDest: '8385P' },
      '9930P': { section: 'TRAILER', trailerDest: '9930P', sfacOverflow: true },
      '9880P': { section: 'SFAC' },
      '9916':  { section: 'HOLDOVER' },
    },
    PM: {
      '9929N': { section: 'TRAILER', trailerDest: '9929N' },
      '9929T': { section: 'TRAILER', trailerDest: '9929N' },
      '9929D': { section: 'TRAILER', trailerDest: '9929D', alwaysOwn: true },
      '8385P': { section: 'TRAILER', trailerDest: '8385P', minForTrailer: 2 },
      '9930P': { section: 'TRAILER', trailerDest: '9930P', minForTrailer: 2, sfacOverflow: true },
      '9929P': { section: 'TRAILER', trailerDest: '9929P' },
      '9916':  { section: 'HOLDOVER' },
    },
  },

  // SLICs that can overflow onto 9929N as last resort (PM only)
  nineN_overflow: ['8385P', '9930P'],

  // Number of 9930P cans to divert to SFAC (if total > 1)
  sfacOverflowCount: 1,

  trailersPerRow: 3,
  maxTrailerRows: 4,
  mduMaxSlots: 19,
  sfacSlots: 5,

  // ── VENDOR SHORTHAND LABELS ────────────────────────────────
  // Trailers are labelled T1, T2, etc. dynamically.
  // These are for non-trailer sections.
  vendorSectionLabels: {
    'USPS':    'USPS',
    'HOLDOVER':'WB',
    'MDU':     'MDU',
    'SFAC':    'SFAC',
    'THROUGH': 'JET',
  },

  alpBase: 'https://alp.inside.ups.com/web/LoadPlan/ViewLoadPlan',
  alpTableId: 'info',

};
