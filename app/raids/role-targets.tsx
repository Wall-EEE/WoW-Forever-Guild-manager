'use client';
import { useState } from 'react';

const presets: Record<string, [number, number]> = {
  '10': [1, 2], '20': [2, 3], '40': [4, 8],
};

export default function RoleTargets() {
  const [size, setSize] = useState('20');
  const [tanks, setTanks] = useState(2);
  const [healers, setHealers] = useState(3);
  const capacity = Number(size);
  const dps = capacity - tanks - healers;

  function setRaidSize(nextSize: string) {
    const [nextTanks, nextHealers] = presets[nextSize];
    setSize(nextSize);
    setTanks(nextTanks);
    setHealers(nextHealers);
  }

  return <>
    <label>Raid size
      <select name="capacity" value={size} onChange={event => setRaidSize(event.target.value)} required>
        <option value="10">10 players</option>
        <option value="20">20 players</option>
        <option value="40">40 players</option>
      </select>
    </label>
    <fieldset className="raid-targets">
      <legend>Needed roles</legend>
      <div className="raid-target-fields">
        <label>Tanks
          <select name="tank_slots" value={tanks} onChange={event => setTanks(Number(event.target.value))} required>
            {Array.from({ length: capacity - healers + 1 }, (_, index) =>
              <option key={index} value={index}>{index}</option>
            )}
          </select>
        </label>
        <label>Healers
          <select name="healer_slots" value={healers} onChange={event => setHealers(Number(event.target.value))} required>
            {Array.from({ length: capacity - tanks + 1 }, (_, index) =>
              <option key={index} value={index}>{index}</option>
            )}
          </select>
        </label>
        <div className="raid-auto-dps">
          <span>DPS <small>(automatic)</small></span>
          <strong aria-live="polite">{dps}</strong>
          <input type="hidden" name="dps_slots" value={dps} />
        </div>
      </div>
      <p className="raid-target-ok">
        {tanks} tanks + {healers} healers + {dps} DPS = {capacity} players ✓
      </p>
    </fieldset>
  </>;
}
