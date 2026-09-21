import { useEffect, useRef, useState, type RefObject } from "react";

interface SyncedHorizontalScrollbarProps {
  targetRef: RefObject<HTMLElement>;
}

export function SyncedHorizontalScrollbar({ targetRef }: SyncedHorizontalScrollbarProps) {
  const topRef = useRef<HTMLDivElement>(null);
  const [contentWidth, setContentWidth] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const top = topRef.current;
    const target = targetRef.current;
    if (!top || !target) return;

    let syncing = false;
    const syncTop = () => {
      if (syncing) return;
      syncing = true;
      target.scrollLeft = top.scrollLeft;
      syncing = false;
    };
    const syncBottom = () => {
      if (syncing) return;
      syncing = true;
      top.scrollLeft = target.scrollLeft;
      syncing = false;
    };
    const measure = () => {
      setContentWidth(target.scrollWidth);
      setVisible(target.scrollWidth > target.clientWidth + 1);
      top.scrollLeft = target.scrollLeft;
    };

    measure();
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(target);
    if (target.firstElementChild) resizeObserver.observe(target.firstElementChild);
    top.addEventListener("scroll", syncTop, { passive: true });
    target.addEventListener("scroll", syncBottom, { passive: true });

    return () => {
      resizeObserver.disconnect();
      top.removeEventListener("scroll", syncTop);
      target.removeEventListener("scroll", syncBottom);
    };
  }, [targetRef]);

  return (
    <div
      ref={topRef}
      className={`sticky top-0 z-50 h-4 w-full overflow-x-auto overflow-y-hidden bg-background ${visible ? "block" : "hidden"}`}
      aria-label="Tabelle horizontal scrollen"
      role="region"
      aria-hidden={!visible}
    >
      <div aria-hidden="true" style={{ width: contentWidth, height: 1 }} />
    </div>
  );
}