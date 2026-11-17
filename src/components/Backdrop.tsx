"use client";
import { useEffect, useRef } from "react";

// Fixed positions so the server and the browser render the same thing.
const PARTICLES = [
  { x: 6, s: 5, d: 22, o: 3 }, { x: 14, s: 3, d: 28, o: 12 }, { x: 23, s: 6, d: 25, o: 7 }, { x: 31, s: 4, d: 31, o: 19 },
  { x: 42, s: 3, d: 24, o: 2 }, { x: 51, s: 5, d: 29, o: 15 }, { x: 60, s: 4, d: 21, o: 9 }, { x: 68, s: 6, d: 33, o: 22 },
  { x: 77, s: 3, d: 26, o: 5 }, { x: 85, s: 5, d: 30, o: 17 }, { x: 93, s: 4, d: 23, o: 11 }, { x: 47, s: 3, d: 35, o: 26 },
];

/**
 * The living background behind every page: slow aurora lights, a drifting grid, rising particles and a soft glow
 * that follows the pointer. Purely decorative (aria-hidden, no pointer events). With
 * "reduce motion" switched on, everything stays still.
 */
export function Backdrop() {
  const glow = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = glow.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    let x = window.innerWidth / 2;
    let y = window.innerHeight / 3;
    const move = (e: PointerEvent) => {
      x = e.clientX;
      y = e.clientY;
      if (!frame) frame = requestAnimationFrame(() => {
        el.style.transform = `translate(${x - 300}px, ${y - 300}px)`;
        el.style.opacity = "1";
        frame = 0;
      });
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => {
      window.removeEventListener("pointermove", move);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="aurora aurora-1" />
      <div className="aurora aurora-2" />
      <div className="aurora aurora-3" />
      <div className="aurora aurora-4" />
      <div className="grid-pan absolute inset-0" />
      {PARTICLES.map((p, i) => (
        <span key={i} className="particle" style={{ left: `${p.x}%`, width: p.s, height: p.s, animationDuration: `${p.d}s`, animationDelay: `-${p.o}s` }} />
      ))}
      <div ref={glow} className="absolute left-0 top-0 h-[600px] w-[600px] rounded-full opacity-0 transition-opacity duration-700 [background:radial-gradient(circle,rgb(91_63_209/0.13),transparent_65%)]" />
    </div>
  );
}
