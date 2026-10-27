// Small line icons for the inventory module (24 px grid, stroke = currentColor, decorative).
type P = { className?: string }
const base = (className = 'size-5') => ({
  className,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
})

export const IconPlus = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
)
export const IconClose = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
)
export const IconCheck = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
)
export const IconBack = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M15 18l-6-6 6-6" className="flip-rtl" />
  </svg>
)
/** Box with an arrow in: an entry / collecte. */
export const IconEntry = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M4 8l8-4 8 4v8l-8 4-8-4z" />
    <path d="M12 8v6M9.5 11.5L12 14l2.5-2.5" />
  </svg>
)
export const IconTransfer = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M4 8h13M14 5l3 3-3 3M20 16H7M10 13l-3 3 3 3" />
  </svg>
)
/** Out of stock: consumed or lost. */
export const IconOut = ({ className }: P) => (
  <svg {...base(className)}>
    <circle cx="12" cy="12" r="8" />
    <path d="M8.5 12h7" />
  </svg>
)
export const IconCount = ({ className }: P) => (
  <svg {...base(className)}>
    <rect x="5" y="4" width="14" height="17" rx="2" />
    <path d="M9 4.5V3h6v1.5M9 10l1.5 1.5L13 9M9 16h6" />
  </svg>
)
export const IconCamera = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
    <circle cx="12" cy="13" r="3.5" />
  </svg>
)
export const IconArchive = ({ className }: P) => (
  <svg {...base(className)}>
    <rect x="3" y="4" width="18" height="5" rx="1" />
    <path d="M5 9v10h14V9M10 13h4" />
  </svg>
)
export const IconTrash = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
  </svg>
)
export const IconUndo = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M9 14L4 9l5-5" className="flip-rtl" />
    <path d="M4 9h10a6 6 0 010 12h-3" className="flip-rtl" />
  </svg>
)
export const IconPrint = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M7 9V3h10v6M7 17H4v-7h16v7h-3" />
    <rect x="7" y="14" width="10" height="7" />
  </svg>
)
export const IconWarning = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M12 4l9 16H3z" />
    <path d="M12 10v4M12 17.5v.01" />
  </svg>
)
export const IconEdit = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M4 20h4L19 9l-4-4L4 16z" />
  </svg>
)
export const IconCopy = ({ className }: P) => (
  <svg {...base(className)}>
    <rect x="8" y="8" width="12" height="12" rx="2" />
    <path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3" />
  </svg>
)
export const IconCalendar = ({ className }: P) => (
  <svg {...base(className)}>
    <rect x="4" y="5" width="16" height="16" rx="2" />
    <path d="M8 3v4M16 3v4M4 10h16" />
  </svg>
)
export const IconUsers = ({ className }: P) => (
  <svg {...base(className)}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 4.5a3.5 3.5 0 010 7M18 14c1.9.8 3 2.9 3 6" />
  </svg>
)
export const IconTasks = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M4 6l1.5 1.5L8 5M4 12l1.5 1.5L8 11M4 18l1.5 1.5L8 17M11 6h9M11 12h9M11 18h9" />
  </svg>
)
export const IconMoney = ({ className }: P) => (
  <svg {...base(className)}>
    <rect x="3" y="6" width="18" height="12" rx="2" />
    <circle cx="12" cy="12" r="2.5" />
    <path d="M6.5 9.5v.01M17.5 14.5v.01" />
  </svg>
)
export const IconMail = ({ className }: P) => (
  <svg {...base(className)}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3.5 6.5L12 13l8.5-6.5" />
  </svg>
)
export const IconClock = ({ className }: P) => (
  <svg {...base(className)}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </svg>
)
export const IconPin = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M12 21s-7-6.2-7-11.5A7 7 0 0119 9.5C19 14.8 12 21 12 21z" />
    <circle cx="12" cy="9.5" r="2.5" />
  </svg>
)
export const IconPhoto = ({ className }: P) => (
  <svg {...base(className)}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <circle cx="8.5" cy="10" r="1.5" />
    <path d="M21 16l-5-5-8 8" />
  </svg>
)
export const IconHeart = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M12 20s-7.5-4.5-7.5-10A4.5 4.5 0 0112 7a4.5 4.5 0 017.5 3c0 5.5-7.5 10-7.5 10z" />
  </svg>
)
export const IconInbox = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M4 13l2.5-8h11L20 13v6H4z" />
    <path d="M4 13h4.5l1 2h5l1-2H20" />
  </svg>
)
export const IconSearch = ({ className }: P) => (
  <svg {...base(className)}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M20 20l-4.2-4.2" />
  </svg>
)
export const IconArrow = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M5 12h14M13 6l6 6-6 6" className="flip-rtl" />
  </svg>
)
export const IconUserCheck = ({ className }: P) => (
  <svg {...base(className)}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M15.5 11.5l2 2 4-4" />
  </svg>
)
