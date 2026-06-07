/**
 * One-time narrative intro framing (PRD §5.1): the player is a Cockrell School
 * ECE student who finds a computing time machine. Shown on first visit; the
 * "seen" flag persists in localStorage.
 */

import { useState } from "react";

const SEEN_KEY = "hookem-bootem.introSeen.v1";

export function hasSeenIntro(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

export function IntroOverlay({ onStart }: { onStart: () => void }) {
  const [closing, setClosing] = useState(false);

  const start = () => {
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* ignore */
    }
    setClosing(true);
    setTimeout(onStart, 220);
  };

  return (
    <div className={`intro ${closing ? "intro-closing" : ""}`}>
      <div className="intro-card">
        <div className="intro-mark">🤘</div>
        <h1 className="intro-title">Hook 'Em, Boot 'Em</h1>
        <p className="intro-tagline">A journey through computer architecture</p>

        <div className="intro-story">
          <p>
            You're a Cockrell School ECE student. Down in the basement of the ECE
            building, behind a stack of forgotten lab equipment, you find
            something that shouldn't exist: a <em>computing time machine</em>.
          </p>
          <p>
            To power it forward through history, you'll program the real
            computers that built our field: from a 30-ton room of vacuum tubes in
            1945 toward the top-tier supercomputer humming across campus at TACC
            today. Each machine speaks its own language. Learn it, solve its
            puzzles, and earn the part that sends you to the next era.
          </p>
          <p className="intro-first">
            First stop: <strong>1945, and ENIAC</strong>, the 30-ton room where
            it all began.
          </p>
        </div>

        <button className="btn btn-primary intro-start" onClick={start}>
          ▶ Boot the machine
        </button>
        <p className="intro-foot">
          For UT Austin ECE · EE 306 / EE 460N · Hook 'em 🤘
        </p>
      </div>
    </div>
  );
}
