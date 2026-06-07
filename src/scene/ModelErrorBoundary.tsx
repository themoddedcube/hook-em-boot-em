/**
 * If a level's GLB fails to load (missing file, bad export), fall back to the
 * primitive placeholder so the scene — and the game loop — never breaks.
 */

import { Component, ReactNode } from "react";

export class ModelErrorBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.warn("[scene] GLB load failed, using placeholder:", error);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
