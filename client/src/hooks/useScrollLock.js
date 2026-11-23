import { useEffect } from 'react';

// Counted rather than a plain on/off: the day modal renders the add-meal modal
// in its place while staying mounted, so two holders overlap.
let holders = 0;
let restore = null;

// Stops the page behind a modal from scrolling while the caller is mounted.
export function useScrollLock() {
  useEffect(() => {
    if (holders === 0) {
      const { body, documentElement } = document;
      const previous = { overflow: body.style.overflow, paddingRight: body.style.paddingRight };
      // Where scrollbars take up space, hiding the page's would widen it and
      // shift everything sideways; pad the body by the same amount instead.
      const scrollbarWidth = window.innerWidth - documentElement.clientWidth;
      body.style.overflow = 'hidden';
      if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`;
      restore = () => {
        body.style.overflow = previous.overflow;
        body.style.paddingRight = previous.paddingRight;
      };
    }
    holders += 1;
    return () => {
      holders -= 1;
      if (holders === 0) {
        restore();
        restore = null;
      }
    };
  }, []);
}
