import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Scrollschutz für Zahlenfelder: Ist das Feld fokussiert, würde der Browser
 * den Wert per Mausrad verändern. Wir lösen stattdessen den Fokus – das
 * Wheel-Ereignis wird NICHT abgebrochen, die Seite/der Container scrollt normal.
 */
export function protectNumberWheel(el: HTMLInputElement | null | undefined) {
  if (el && el.type === "number" && el.ownerDocument?.activeElement === el) el.blur();
}

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, onWheel, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        ref={ref}
        onWheel={(e) => {
          if (type === "number") protectNumberWheel(e.currentTarget);
          onWheel?.(e);
        }}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
