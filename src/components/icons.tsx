// Small line icons (inline SVG, no icon library). Decorative: always aria-hidden.
import type { ReactNode } from "react";

function I({ children, className = "h-5 w-5" }: { children: ReactNode; className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      {children}
    </svg>
  );
}

type P = { className?: string };
export const IconHome = (p: P) => <I {...p}><path d="M3 11.5 12 4l9 7.5" /><path d="M5 10v10h14V10" /></I>;
export const IconPen = (p: P) => <I {...p}><path d="M4 20h4L19 9l-4-4L4 16v4Z" /><path d="m13.5 6.5 4 4" /></I>;
export const IconInbox = (p: P) => <I {...p}><path d="M4 13h4l2 3h4l2-3h4" /><path d="M5 5h14l1 8v6H4v-6l1-8Z" /></I>;
export const IconChart = (p: P) => <I {...p}><path d="M4 20V10" /><path d="M10 20V4" /><path d="M16 20v-7" /><path d="M22 20H2" /></I>;
export const IconBook = (p: P) => <I {...p}><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5Z" /><path d="M4 19a2 2 0 0 1 2-2h13" /></I>;
export const IconFact = (p: P) => <I {...p}><circle cx="12" cy="12" r="9" /><path d="M12 11v5" /><path d="M12 8h.01" /></I>;
export const IconTrail = (p: P) => <I {...p}><path d="M12 8v4l3 2" /><circle cx="12" cy="12" r="9" /></I>;
export const IconShield = (p: P) => <I {...p}><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z" /><path d="m9 12 2 2 4-4" /></I>;
export const IconCheck = (p: P) => <I {...p}><path d="m5 12 5 5 9-10" /></I>;
export const IconSpark = (p: P) => <I {...p}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" /></I>;
export const IconImage = (p: P) => <I {...p}><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="m21 16-5-5-9 9" /></I>;
export const IconFile = (p: P) => <I {...p}><path d="M14 3H6v18h12V7l-4-4Z" /><path d="M14 3v4h4" /><path d="M9 13h6M9 17h4" /></I>;
export const IconBell = (p: P) => <I {...p}><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16Z" /><path d="M10 20a2 2 0 0 0 4 0" /></I>;
/** Stacked pages: a multi-page PDF document or deck. */
export const IconPages = (p: P) => <I {...p}><path d="M8 3h10v14H8z" /><path d="M5 6v15h11" /><path d="M11 8h4M11 12h4" /></I>;
export const IconUser = (p: P) => <I {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></I>;
export const IconArrow = (p: P) => <I {...p}><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></I>;
export const IconFlag = (p: P) => <I {...p}><path d="M5 21V4" /><path d="M5 4h11l-2 4 2 4H5" /></I>;
export const IconReset = (p: P) => <I {...p}><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /></I>;
export const IconBolt = (p: P) => <I {...p}><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" /></I>;
