"use client";
import { useEffect } from "react";

/**
 * Opening an address with a "#" (a refresh, a pasted link) scrolls to that part of the page. The page streams in after
 * a loading skeleton, so the browser's own jump finds nothing, and a scroll made too early can be reset as the page
 * settles. So: wait for the element, scroll to it, and repeat until it has stayed in place for half a second (at most
 * 6 s; a person scrolling stops it). Links inside the app are scrolled by Next.js itself. (Judge rehearsal, Block 3.)
 */
export function HashScroll() {
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (!id) return;
    let ticks = 0;
    let steady = 0;
    const stop = () => clearInterval(t);
    const byPerson = () => stop();
    const t = setInterval(() => {
      const el = document.getElementById(id);
      if (++ticks > 60) return stop();
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      const want = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
      if (Math.abs(top - want) <= 8) {
        if (++steady >= 5) stop();
        return;
      }
      steady = 0;
      el.scrollIntoView({ block: "start" });
    }, 100);
    window.addEventListener("wheel", byPerson, { once: true, passive: true });
    window.addEventListener("touchmove", byPerson, { once: true, passive: true });
    window.addEventListener("keydown", byPerson, { once: true });
    return () => {
      stop();
      window.removeEventListener("wheel", byPerson);
      window.removeEventListener("touchmove", byPerson);
      window.removeEventListener("keydown", byPerson);
    };
  }, []);
  return null;
}
