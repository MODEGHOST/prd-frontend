import { useEffect, useRef, useState } from "react";

/**
 * Renders only the items near the scroll viewport. Usage stays the same for
 * the caller: pass the full list; users still scroll through every item.
 */
export function VirtualList({
  items,
  estimateSize = 128,
  overscan = 5,
  className = "",
  style,
  getItemKey = (item, index) => item?.id ?? index,
  children,
}) {
  const parentRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(estimateSize * 8);

  useEffect(() => {
    const node = parentRef.current;
    if (!node) return undefined;

    const updateHeight = () => {
      setViewportHeight(node.clientHeight || estimateSize * 8);
    };
    updateHeight();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateHeight);
      return () => window.removeEventListener("resize", updateHeight);
    }

    const observer = new ResizeObserver(updateHeight);
    observer.observe(node);
    return () => observer.disconnect();
  }, [estimateSize]);

  const itemCount = items.length;
  const startIndex = Math.max(0, Math.floor(scrollTop / estimateSize) - overscan);
  const visibleCount = Math.ceil(viewportHeight / estimateSize) + overscan * 2;
  const endIndex = Math.min(itemCount, startIndex + visibleCount);
  const paddingTop = startIndex * estimateSize;
  const paddingBottom = Math.max(0, (itemCount - endIndex) * estimateSize);
  const visibleItems = items.slice(startIndex, endIndex);

  return (
    <div
      ref={parentRef}
      className={className}
      style={style}
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
    >
      <div style={{ paddingTop, paddingBottom }}>
        {visibleItems.map((item, offset) => {
          const index = startIndex + offset;
          return (
            <div key={getItemKey(item, index)} className="virtual-list-item">
              {children(item, index)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
