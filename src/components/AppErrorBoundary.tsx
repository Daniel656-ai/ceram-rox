import type { ReactNode } from "react";
import ErrorBoundary from "@/components/ErrorBoundary";

/**
 * Globales Auffangnetz: Ein Renderfehler in einer einzelnen Ansicht darf die
 * Anwendung nicht weiß werden lassen. Statt eines leeren Bildschirms erscheint
 * eine verständliche Meldung mit der Möglichkeit, erneut zu laden.
 */
export default function AppErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      fallback={(error, reset) => (
        <div className="min-h-screen flex items-center justify-center bg-background p-6">
          <div className="max-w-lg w-full rounded-lg border p-6 space-y-3">
            <h1 className="text-lg font-semibold">Diese Ansicht konnte nicht angezeigt werden</h1>
            <p className="text-sm text-muted-foreground break-words">{error.message}</p>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={reset}
                className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground"
              >
                Erneut versuchen
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="rounded-md border px-3 py-1.5 text-sm"
              >
                Anwendung neu laden
              </button>
            </div>
          </div>
        </div>
      )}
    >
      {children}
    </ErrorBoundary>
  );
}
