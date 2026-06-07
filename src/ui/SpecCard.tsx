/**
 * A compact "spec card" overlaid on the 3D scene showing the machine's real
 * physical facts — size first. Feeling the scale of each era (a room → a
 * wardrobe → a chip) is central to the game's pedagogy.
 */

import { MachineSpecs } from "../engine/level";

export function SpecCard({
  title,
  year,
  specs,
}: {
  title: string;
  year: number;
  specs?: MachineSpecs;
}) {
  if (!specs) return null;
  return (
    <div className="spec-card">
      <div className="spec-head">
        <span className="spec-year">{year}</span>
        <span className="spec-title">{title}</span>
      </div>
      <dl className="spec-list">
        <div className="spec-row spec-size">
          <dt>Size</dt>
          <dd>
            {specs.size}
            {specs.sizeCompare && (
              <span className="spec-compare"> ({specs.sizeCompare})</span>
            )}
          </dd>
        </div>
        {specs.weight && (
          <div className="spec-row">
            <dt>Weight</dt>
            <dd>{specs.weight}</dd>
          </div>
        )}
        {specs.memory && (
          <div className="spec-row">
            <dt>Memory</dt>
            <dd>{specs.memory}</dd>
          </div>
        )}
        {specs.speed && (
          <div className="spec-row">
            <dt>Speed</dt>
            <dd>{specs.speed}</dd>
          </div>
        )}
        {specs.price && (
          <div className="spec-row">
            <dt>Price</dt>
            <dd>{specs.price}</dd>
          </div>
        )}
        {specs.note && (
          <div className="spec-row">
            <dt>Note</dt>
            <dd>{specs.note}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}
