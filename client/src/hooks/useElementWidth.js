import { useCallback, useState } from 'react';

// Callback ref + the element's current content width, kept in sync by a
// ResizeObserver. Lets an SVG chart use a 1:1 viewBox so its text stays at real
// pixel sizes on a phone instead of shrinking with the whole drawing.
export function useElementWidth() {
  const [width, setWidth] = useState(0);
  const ref = useCallback((el) => {
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}
