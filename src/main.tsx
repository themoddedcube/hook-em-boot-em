import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { GameShell } from "./app/GameShell";
import { useGameStore } from "./state/gameStore";
import "./app/theme.css";

// Expose the store in dev for debugging / smoke-testing in the browser console.
if (import.meta.env.DEV) {
  (window as unknown as { gameStore: typeof useGameStore }).gameStore =
    useGameStore;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <GameShell />
    <Analytics />
    <SpeedInsights />
  </StrictMode>
);
