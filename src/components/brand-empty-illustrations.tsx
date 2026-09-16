/** Dekorative Empty-State-Illustrationen in den Kernfarben. */

type IllustrationProps = { className?: string }

const baseSvg = {
  xmlns: 'http://www.w3.org/2000/svg',
  viewBox: '0 0 160 140',
  fill: 'none',
  'aria-hidden': true as const,
}

function Ground({ cy = 122 }: { cy?: number }) {
  return <ellipse cx="80" cy={cy} rx="52" ry="9" fill="rgb(45 79 30 / 0.1)" />
}

function Sun({ cx = 124, cy = 36 }: { cx?: number; cy?: number }) {
  return (
    <>
      <circle cx={cx} cy={cy} r="16" fill="rgb(230 126 34 / 0.15)" />
      <circle cx={cx} cy={cy} r="10" fill="rgb(230 126 34)" />
    </>
  )
}

/** Vorschläge / Erfolgsruhe: Zelt + Sonne + Häkchen. */
export function SuggestionsEmptyIllustration({ className }: IllustrationProps) {
  return (
    <svg {...baseSvg} className={className}>
      <Ground cy={118} />
      <path
        d="M80 28 L128 108 H32 Z"
        fill="rgb(45 79 30 / 0.1)"
        stroke="rgb(45 79 30)"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path d="M80 28 V108" stroke="rgb(45 79 30)" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M62 108 L80 72 L98 108" fill="rgb(45 79 30 / 0.2)" />
      <Sun cx={122} cy={36} />
      <circle cx="48" cy="92" r="16" className="fill-card" stroke="rgb(45 79 30)" strokeWidth="2.5" />
      <path
        d="M41 92 L46 97 L56 86"
        stroke="rgb(45 79 30)"
        strokeWidth="2.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Alias für Erfolgszustände („Alles gepackt/erledigt/aktuell“). */
export const SuccessEmptyIllustration = SuggestionsEmptyIllustration

/** Packliste leer: offener Rucksack. */
export function PacklistEmptyIllustration({ className }: IllustrationProps) {
  return (
    <svg {...baseSvg} className={className}>
      <Ground />
      <path
        d="M48 58 h64 a12 12 0 0 1 12 12 v40 a14 14 0 0 1 -14 14 H50 a14 14 0 0 1 -14 -14 V70 a12 12 0 0 1 12 -12 Z"
        fill="rgb(45 79 30 / 0.1)"
        stroke="rgb(45 79 30)"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path d="M52 58 Q80 38 108 58" stroke="rgb(45 79 30)" strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M58 70 V48 a8 8 0 0 1 8 -8 h4" stroke="rgb(45 79 30)" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <path d="M102 70 V48 a8 8 0 0 0 -8 -8 h-4" stroke="rgb(45 79 30)" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <rect x="62" y="78" width="36" height="28" rx="6" fill="rgb(45 79 30 / 0.15)" stroke="rgb(45 79 30)" strokeWidth="2" />
      <circle cx="80" cy="92" r="5" fill="rgb(230 126 34)" />
      <Sun />
    </svg>
  )
}

/** Suche/Filter ohne Treffer: Lupe über Landschaft. */
export function PacklistSearchEmptyIllustration({ className }: IllustrationProps) {
  return (
    <svg {...baseSvg} className={className}>
      <Ground />
      <path
        d="M20 108 Q48 78 76 100 Q100 72 140 108"
        stroke="rgb(45 79 30)"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="rgb(45 79 30 / 0.08)"
      />
      <path
        d="M42 100 L54 72 L66 100 Z"
        fill="rgb(45 79 30 / 0.15)"
        stroke="rgb(45 79 30)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="96" cy="58" r="22" className="fill-card" stroke="rgb(45 79 30)" strokeWidth="3.5" />
      <circle cx="96" cy="58" r="12" fill="rgb(45 79 30 / 0.08)" />
      <path d="M112 74 L128 92" stroke="rgb(230 126 34)" strokeWidth="4" strokeLinecap="round" />
    </svg>
  )
}

export const SearchEmptyIllustration = PacklistSearchEmptyIllustration

/** Urlaube: Kalender mit Zelt-Akzent. */
export function VacationEmptyIllustration({ className }: IllustrationProps) {
  return (
    <svg {...baseSvg} className={className}>
      <Ground />
      <rect x="38" y="36" width="84" height="72" rx="10" fill="rgb(45 79 30 / 0.1)" stroke="rgb(45 79 30)" strokeWidth="3" />
      <rect x="38" y="36" width="84" height="18" rx="10" fill="rgb(45 79 30)" />
      <rect x="38" y="46" width="84" height="8" fill="rgb(45 79 30)" />
      <path d="M56 30 V44" stroke="rgb(230 126 34)" strokeWidth="3" strokeLinecap="round" />
      <path d="M104 30 V44" stroke="rgb(230 126 34)" strokeWidth="3" strokeLinecap="round" />
      <path d="M68 78 L80 58 L92 78 Z" fill="rgb(45 79 30 / 0.2)" stroke="rgb(45 79 30)" strokeWidth="2" strokeLinejoin="round" />
      <path d="M80 58 V78" stroke="rgb(45 79 30)" strokeWidth="1.5" />
      <Sun cx={128} cy={28} />
    </svg>
  )
}

/** Orte (Camping-/Rastplätze): Kartenpin. */
export function PlaceEmptyIllustration({ className }: IllustrationProps) {
  return (
    <svg {...baseSvg} className={className}>
      <Ground />
      <path
        d="M80 28 C62 28 48 42 48 60 C48 82 80 112 80 112 C80 112 112 82 112 60 C112 42 98 28 80 28 Z"
        fill="rgb(45 79 30 / 0.12)"
        stroke="rgb(45 79 30)"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <circle cx="80" cy="58" r="14" className="fill-card" stroke="rgb(45 79 30)" strokeWidth="2.5" />
      <circle cx="80" cy="58" r="6" fill="rgb(230 126 34)" />
      <Sun cx={128} cy={34} />
    </svg>
  )
}

/** Ausrüstung / Listen: Kiste mit Werkzeug-Akzent. */
export function GearEmptyIllustration({ className }: IllustrationProps) {
  return (
    <svg {...baseSvg} className={className}>
      <Ground />
      <path
        d="M36 58 H124 V108 H36 Z"
        fill="rgb(45 79 30 / 0.1)"
        stroke="rgb(45 79 30)"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path d="M28 58 H132 V70 H28 Z" fill="rgb(45 79 30 / 0.2)" stroke="rgb(45 79 30)" strokeWidth="3" strokeLinejoin="round" />
      <rect x="68" y="48" width="24" height="14" rx="4" fill="rgb(230 126 34)" />
      <path d="M56 84 H104" stroke="rgb(45 79 30)" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M56 94 H90" stroke="rgb(45 79 30)" strokeWidth="2.5" strokeLinecap="round" opacity="0.5" />
      <Sun cx={128} cy={32} />
    </svg>
  )
}

/** Checklisten: Klemmbrett. */
export function ChecklistEmptyIllustration({ className }: IllustrationProps) {
  return (
    <svg {...baseSvg} className={className}>
      <Ground />
      <rect x="44" y="28" width="72" height="88" rx="8" fill="rgb(45 79 30 / 0.1)" stroke="rgb(45 79 30)" strokeWidth="3" />
      <rect x="62" y="22" width="36" height="14" rx="4" fill="rgb(230 126 34)" />
      <path d="M58 58 H102" stroke="rgb(45 79 30)" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M58 72 H102" stroke="rgb(45 79 30)" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M58 86 H88" stroke="rgb(45 79 30)" strokeWidth="2.5" strokeLinecap="round" opacity="0.45" />
      <circle cx="52" cy="58" r="3" fill="rgb(45 79 30)" />
      <circle cx="52" cy="72" r="3" fill="rgb(45 79 30)" />
      <circle cx="52" cy="86" r="3" fill="rgb(45 79 30)" opacity="0.45" />
    </svg>
  )
}

/** Optimierungen: Glühbirne / Idee. */
export function IdeaEmptyIllustration({ className }: IllustrationProps) {
  return (
    <svg {...baseSvg} className={className}>
      <Ground />
      <path
        d="M80 24 C62 24 50 38 50 54 C50 66 58 74 64 80 V90 H96 V80 C102 74 110 66 110 54 C110 38 98 24 80 24 Z"
        fill="rgb(45 79 30 / 0.1)"
        stroke="rgb(45 79 30)"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path d="M64 96 H96" stroke="rgb(45 79 30)" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M68 104 H92" stroke="rgb(45 79 30)" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M80 40 V56" stroke="rgb(230 126 34)" strokeWidth="3" strokeLinecap="round" />
      <path d="M68 48 H92" stroke="rgb(230 126 34)" strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />
      <Sun cx={128} cy={30} />
    </svg>
  )
}

/** Wartung / Fälligkeiten: Schraubenschlüssel. */
export function MaintenanceEmptyIllustration({ className }: IllustrationProps) {
  return (
    <svg {...baseSvg} className={className}>
      <Ground />
      <path
        d="M52 42 C52 30 62 24 72 28 L78 34 L70 42 L76 48 L84 40 L90 46 C96 52 94 64 84 68 L78 62 L72 68 L66 62 C56 66 48 58 52 48 L58 42 Z"
        fill="rgb(45 79 30 / 0.12)"
        stroke="rgb(45 79 30)"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path d="M84 68 L118 102" stroke="rgb(45 79 30)" strokeWidth="8" strokeLinecap="round" />
      <path d="M84 68 L118 102" stroke="rgb(230 126 34)" strokeWidth="3" strokeLinecap="round" />
      <circle cx="64" cy="44" r="6" className="fill-card" stroke="rgb(45 79 30)" strokeWidth="2" />
    </svg>
  )
}

/** Transportmittel: einfaches Fahrzeug. */
export function TransportEmptyIllustration({ className }: IllustrationProps) {
  return (
    <svg {...baseSvg} className={className}>
      <Ground />
      <path
        d="M28 88 H132 V100 H28 Z"
        fill="rgb(45 79 30 / 0.08)"
      />
      <path
        d="M36 78 H50 L62 52 H110 L124 78 H128 V94 H36 Z"
        fill="rgb(45 79 30 / 0.12)"
        stroke="rgb(45 79 30)"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path d="M66 56 H106 L116 78 H62 Z" fill="rgb(45 79 30 / 0.08)" stroke="rgb(45 79 30)" strokeWidth="2" />
      <circle cx="54" cy="94" r="10" className="fill-card" stroke="rgb(45 79 30)" strokeWidth="2.5" />
      <circle cx="110" cy="94" r="10" className="fill-card" stroke="rgb(45 79 30)" strokeWidth="2.5" />
      <circle cx="54" cy="94" r="3.5" fill="rgb(230 126 34)" />
      <circle cx="110" cy="94" r="3.5" fill="rgb(230 126 34)" />
      <Sun cx={128} cy={30} />
    </svg>
  )
}

/** Mitreisende: zwei Personen-Silhouetten. */
export function PeopleEmptyIllustration({ className }: IllustrationProps) {
  return (
    <svg {...baseSvg} className={className}>
      <Ground />
      <circle cx="58" cy="48" r="16" fill="rgb(45 79 30 / 0.12)" stroke="rgb(45 79 30)" strokeWidth="2.5" />
      <path
        d="M30 108 C30 84 42 72 58 72 C74 72 86 84 86 108"
        fill="rgb(45 79 30 / 0.1)"
        stroke="rgb(45 79 30)"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <circle cx="104" cy="52" r="14" fill="rgb(45 79 30 / 0.08)" stroke="rgb(45 79 30)" strokeWidth="2.5" />
      <path
        d="M80 108 C80 88 90 78 104 78 C118 78 128 88 128 108"
        fill="rgb(45 79 30 / 0.08)"
        stroke="rgb(45 79 30)"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <Sun cx={132} cy={28} />
    </svg>
  )
}

/** Vorlagen: Dokument mit Stern. */
export function TemplateEmptyIllustration({ className }: IllustrationProps) {
  return (
    <svg {...baseSvg} className={className}>
      <Ground />
      <path
        d="M48 28 H96 L116 48 V112 H48 Z"
        fill="rgb(45 79 30 / 0.1)"
        stroke="rgb(45 79 30)"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path d="M96 28 V48 H116" stroke="rgb(45 79 30)" strokeWidth="3" strokeLinejoin="round" fill="rgb(45 79 30 / 0.15)" />
      <path d="M62 70 H102" stroke="rgb(45 79 30)" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M62 84 H92" stroke="rgb(45 79 30)" strokeWidth="2.5" strokeLinecap="round" opacity="0.5" />
      <circle cx="120" cy="36" r="14" fill="rgb(230 126 34 / 0.2)" />
      <path
        d="M120 26 L123 34 H132 L125 39 L128 48 L120 43 L112 48 L115 39 L108 34 H117 Z"
        fill="rgb(230 126 34)"
      />
    </svg>
  )
}

export const EMPTY_ILLUSTRATION_CLASS = 'h-28 w-auto sm:h-32'
