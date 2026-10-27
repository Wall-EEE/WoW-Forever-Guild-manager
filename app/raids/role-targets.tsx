'use client';
import { useState } from 'react';

const presets: Record<string,[number,number,number]> = {
  '10':[1,2,7], '20':[2,3,15], '40':[4,8,28]
};
export default function RoleTargets(){
  const [size,setSize]=useState('20');
  const [targets,setTargets]=useState<[number,number,number]>(presets['20']);
  const sum=targets.reduce((a,b)=>a+b,0);
  const values=['Tanks','Healers','DPS'];
  const fields=['tank_slots','healer_slots','dps_slots'];
  return <>
    <label>Raid size <select name="capacity" value={size} onChange={e=>{const s=e.target.value;setSize(s);setTargets([...presets[s]] as [number,number,number]);}} required>
      <option value="10">10 players</option><option value="20">20 players</option><option value="40">40 players</option>
    </select></label>
    <fieldset className="raid-targets">
      <legend>Needed roles</legend>
      <div className="raid-target-fields">
        {values.map((label,i)=><label key={label}>{label}
          <input type="number" name={fields[i]} min={0} max={Number(size)} required value={targets[i]}
            onChange={e=>{const n=Number(e.target.value);setTargets(previous=>previous.map((v,index)=>index===i?n:v) as [number,number,number]);}}/>
        </label>)}
      </div>
      <p className={sum===Number(size)?'raid-target-ok':'raid-target-warn'}>
        Total: {sum}/{size} spots {sum===Number(size)?'✓':'— role targets must add up to raid size'}
      </p>
    </fieldset>
  </>;
}
