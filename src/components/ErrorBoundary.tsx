import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
  /** Kurzer Kontext, z. B. „Eigenschaften der Berechnung“. */
  title?: string;
  /** Eigene Darstellung statt der Standardmeldung. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Fängt Renderfehler eines Teilbaums ab, damit ein einzelnes fehlerhaft
 * konfiguriertes Element (z. B. eine Berechnung mit ungültigem Schlüssel oder
 * fehlerhafter Formel) niemals die gesamte Oberfläche weiß werden lässt.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Bewusst nur protokollieren – die Anwendung bleibt bedienbar.
    console.error("[ErrorBoundary]", this.props.title ?? "", error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(error, this.reset);
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs space-y-2">
        <p className="flex items-center gap-1 font-medium text-destructive">
          <AlertTriangle className="h-3.5 w-3.5" />
          {this.props.title ?? "Dieser Bereich konnte nicht angezeigt werden."}
        </p>
        <p className="text-muted-foreground break-words">{error.message}</p>
        <button type="button" onClick={this.reset} className="underline text-muted-foreground">
          Erneut versuchen
        </button>
      </div>
    );
  }
}
