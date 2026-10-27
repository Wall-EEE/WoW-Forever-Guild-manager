'use client';
import { useState } from 'react';
import { offerAvailability } from './actions';

type Character = {id:string;character_name:string;class_name:string;spec_name:string|null;raid_role:string;level:number};
export default function RaidAvailabilityForm({raidId,characters,offered,confirmed,weekTitle,weekRange}:{raidId:string;characters:Character[];offered:string[];confirmed?:string;weekTitle:string;weekRange:string}) {
  const [selected,setSelected]=useState<string[]>(offered);
  const toggle=(id:string,checked:boolean)=>setSelected(previous=>checked?[...previous,id]:previous.filter(x=>x!==id));
  return <form className="raid-availability-form" action={offerAvailability}>
    <input type="hidden" name="raid_id" value={raidId}/>
    <div className="raid-availability-week"><strong>{weekTitle} · Wed–Wed</strong><span>{weekRange}</span></div>
    <p className="raid-availability-help">Available? Offer every character you could bring. The leader will assign your final character and role.</p>
    <div className="raid-offer-choices">
      {characters.map(c=><label key={c.id} className="raid-offer-choice">
        <input name="character_id" type="checkbox" value={c.id} checked={selected.includes(c.id)}
          disabled={!!confirmed && c.id===confirmed}
          onChange={e=>toggle(c.id,e.target.checked)}/>
        {confirmed===c.id && <input type="hidden" name="character_id" value={c.id}/>}
        <span><strong>{c.character_name}</strong><small>{c.spec_name??'Unspecified'} {c.class_name}</small></span>
      </label>)}
    </div>
    <button type="submit" className="raid-button">{selected.length?'Save availability':'Withdraw availability'}</button>
    {confirmed&&<small className="raid-confirm-note">A leader must unassign your confirmed character before you can withdraw it.</small>}
  </form>;
}
