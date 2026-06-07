/**
 * Live register / flag / memory inspector (PRD §6.3) — the pedagogical heart.
 * Renders itself entirely from the machine's `descriptor` + `MachineState`, so
 * it works for any machine without modification.
 */

import { MachineDescriptor, MachineState } from "../engine/machineInterface";

/** Format a (possibly negative) value as unsigned hex for its bit width. */
function hex(value: number, bits: number) {
  const digits = Math.ceil(bits / 4);
  // Mask to the register width so two's-complement negatives read correctly.
  const masked =
    bits >= 32 ? value >>> 0 : value & (Math.pow(2, bits) - 1);
  return masked.toString(16).toUpperCase().padStart(digits, "0");
}

function bitsFor(descriptor: MachineDescriptor, name: string): number {
  if (descriptor.registerBits?.[name] != null) return descriptor.registerBits[name];
  if ((descriptor.wideRegisters ?? []).includes(name)) return 16;
  return 8;
}

export function RegisterInspector({
  descriptor,
  state,
}: {
  descriptor: MachineDescriptor;
  state: MachineState | null;
}) {
  return (
    <div className="inspector">
      <h3 className="panel-title">Registers</h3>
      <div className="reg-grid">
        {descriptor.registerOrder.map((name) => {
          const v = state?.registers[name] ?? 0;
          return (
            <div key={name} className="reg-cell">
              <span className="reg-name">{name}</span>
              <span className="reg-val">${hex(v, bitsFor(descriptor, name))}</span>
              <span className="reg-dec">{v}</span>
            </div>
          );
        })}
      </div>

      <h3 className="panel-title">Flags</h3>
      <div className="flag-row">
        {descriptor.flagOrder.map((name) => {
          const on = state?.flags[name] ?? false;
          return (
            <div
              key={name}
              className={`flag-bit ${on ? "on" : ""}`}
              title={`${name} = ${on ? 1 : 0}`}
            >
              <span className="flag-name">{name}</span>
              <span className="flag-val">{on ? "1" : "0"}</span>
            </div>
          );
        })}
      </div>

      <div className="cycles-row">
        <span>cycles</span>
        <strong>{state?.cycles ?? 0}</strong>
        {state?.halted && <span className="halted-pill">halted</span>}
      </div>
    </div>
  );
}
