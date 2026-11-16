export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="24" r="22" fill="#2c3a8f" />
      <circle cx="24" cy="24" r="17" fill="none" stroke="#fff" strokeWidth="1.4" strokeDasharray="2.2 2.6" />
      <path d="M15 24.5l6.2 6.2L33.5 18" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
