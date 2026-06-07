/**
 * Console / output + assembler diagnostics + challenge pass/fail feedback.
 */

import { AsmError } from "../engine/machineInterface";

export function Console({
  output,
  errors,
  failures,
  passed,
  hasRun,
  sandbox = false,
}: {
  output: string;
  errors: AsmError[];
  failures: string[];
  passed: boolean;
  hasRun: boolean;
  sandbox?: boolean;
}) {
  const realErrors = errors.filter((e) => e.severity !== "warning");

  return (
    <div className="console">
      <h3 className="panel-title">Console</h3>
      <div className="console-body">
        {realErrors.length > 0 && (
          <div className="console-errors">
            {realErrors.map((e, i) => (
              <div key={i} className="console-error">
                line {e.line}: {e.message}
              </div>
            ))}
          </div>
        )}

        {output && <pre className="console-output">{output}</pre>}

        {sandbox && realErrors.length === 0 && (
          <div className="result result-sandbox">
            🧪 Sandbox: no objective here. Run any code you like and watch the
            registers, memory, and screen respond.
          </div>
        )}

        {!sandbox && hasRun && passed && (
          <div className="result result-pass">
            ✓ Challenge passed! Hook 'em 🤘
          </div>
        )}

        {!sandbox && hasRun && !passed && realErrors.length === 0 && (
          <div className="result result-fail">
            <div className="result-fail-head">Not quite yet:</div>
            <ul>
              {failures.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          </div>
        )}

        {!sandbox && !hasRun && realErrors.length === 0 && !output && (
          <div className="console-hint">
            Press <strong>Run</strong> to assemble and execute, or{" "}
            <strong>Step</strong> to advance one instruction at a time.
          </div>
        )}
      </div>
    </div>
  );
}
