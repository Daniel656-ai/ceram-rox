import { forwardRef, useRef, type HTMLAttributes, type Ref } from "react";

import { SyncedHorizontalScrollbar } from "@/components/ui/SyncedHorizontalScrollbar";
import { cn } from "@/lib/utils";

interface HorizontalScrollAreaProps extends HTMLAttributes<HTMLDivElement> {
  scrollContainerRef?: Ref<HTMLDivElement>;
  viewportClassName?: string;
}

function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (typeof ref === "function") ref(value);
  else if (ref) ref.current = value;
}

/** Shared overflow area that adds a top scrollbar only when content is wider. */
export const HorizontalScrollArea = forwardRef<HTMLDivElement, HorizontalScrollAreaProps>(
  ({ className, viewportClassName, scrollContainerRef, children, ...props }, forwardedRef) => {
    const viewportRef = useRef<HTMLDivElement>(null);

    return (
      <div className={cn("relative w-full", className)} {...props}>
        <SyncedHorizontalScrollbar targetRef={viewportRef} />
        <div
          ref={(node) => {
            viewportRef.current = node;
            assignRef(forwardedRef, node);
            assignRef(scrollContainerRef, node);
          }}
          className={cn("relative w-full overflow-auto", viewportClassName)}
        >
          {children}
        </div>
      </div>
    );
  },
);
HorizontalScrollArea.displayName = "HorizontalScrollArea";