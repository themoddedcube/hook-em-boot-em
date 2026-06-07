/**
 * Lesson + prompt + progressive hints (PRD §5.3, §6.5). Pure presentation,
 * driven by the active challenge JSON.
 */

/** Structural shape shared by assembly Challenges and ENIAC PuzzleChallenges. */
export interface LessonContent {
  title: string;
  lesson: string;
  prompt: string;
  hints: string[];
  successText?: string;
  sandbox?: boolean;
}

export function LessonPanel({
  challenge,
  hintsRevealed,
  onRevealHint,
  index,
  total,
}: {
  challenge: LessonContent;
  hintsRevealed: number;
  onRevealHint: () => void;
  index: number;
  total: number;
}) {
  const paragraphs = challenge.lesson.split("\n\n");
  const hintsLeft = challenge.hints.length - hintsRevealed;
  const sandbox = !!challenge.sandbox;

  return (
    <div className="lesson">
      <div className={`lesson-eyebrow ${sandbox ? "lesson-eyebrow-sandbox" : ""}`}>
        {sandbox ? "End of era · Sandbox" : `Challenge ${index + 1} of ${total}`}
      </div>
      <h2 className="lesson-title">{challenge.title}</h2>

      <div className="lesson-body">
        {paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>

      {!sandbox && (
        <div className="lesson-prompt">
          <h3 className="panel-title">Your task</h3>
          <p>{challenge.prompt}</p>
          {challenge.successText && (
            <p className="lesson-success-text">✓ {challenge.successText}</p>
          )}
        </div>
      )}

      {sandbox && (
        <div className="lesson-prompt lesson-prompt-sandbox">
          <p>{challenge.prompt}</p>
        </div>
      )}

      {!sandbox && (
      <div className="lesson-hints">
        {challenge.hints.slice(0, hintsRevealed).map((h, i) => (
          <div key={i} className="hint">
            <span className="hint-num">Hint {i + 1}</span>
            {h}
          </div>
        ))}
        {hintsLeft > 0 && (
          <button className="btn btn-ghost" onClick={onRevealHint}>
            Show a hint ({hintsLeft} left)
          </button>
        )}
      </div>
      )}
    </div>
  );
}
