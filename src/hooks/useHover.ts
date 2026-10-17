import { useState } from 'react';

/**
 * Tracks whether the pointer is over a View. Only fires with a mouse or trackpad,
 * such as on web or a tablet with a mouse; on touch screens it stays false.
 */
export function useHover() {
  const [hovered, setHovered] = useState(false);
  return {
    hovered,
    hoverProps: {
      onPointerEnter: () => setHovered(true),
      onPointerLeave: () => setHovered(false),
    },
  };
}
