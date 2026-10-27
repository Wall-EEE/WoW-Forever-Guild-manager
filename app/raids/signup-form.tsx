'use client';
import { useState } from 'react';
import { joinRaid } from './actions';

type Char = {id:string;character_name:string;class_name:string;spec_name:string|null;raid_role:string;level:number};
type Role = 'tank'|'healer'|'dps';
const roleLabels: Record<Role,string> = {tank:'Tank',healer:'Healer',dps:'DPS'};
function allowedRoles(className:string):Role[]{
  return [
    ...(['Warrior','Druid','Paladin','Shaman'].includes(className)?['tank' as Role]:[]),
    ...(['Priest','Druid','Paladin','Shaman'].includes(className)?['healer' as Role]:[]),
    'dps' as Role,
  ];
}
function firstRole(character:Char,slots:Record<Role,number>):Role{
  const possible=allowedRoles(character.class_name).filter(role=>slots[role]>0);
  return possible.includes(character.raid_role as Role)?character.raid_role as Role:possible[0]??'dps';
}
export default function RaidSignupForm({raidId,characters,remaining}:{raidId:string;characters:Char[];remaining:Record<Role,number>}){
  const [characterId,setCharacterId]=useState(characters[0].id);
  const chosen=characters.find(c=>c.id===characterId)??characters[0];
  const [role,setRole]=useState<Role>(()=>firstRole(chosen,remaining));
  const options=allowedRoles(chosen.class_name).filter(r=>remaining[r]>0);
  const selected=options.includes(role)?role:options[0]??'dps';
  return <form action={joinRaid}>
    <input type="hidden" name="raid_id" value={raidId}/>
    <select name="character_id" aria-label="Choose your character" required value={characterId}
      onChange={e=>{setCharacterId(e.target.value);const next=characters.find(c=>c.id===e.target.value);if(next)setRole(firstRole(next,remaining));}}>
      {characters.map(c=><option value={c.id} key={c.id}>{c.character_name} · {c.spec_name??'Unspecified'} {c.class_name}</option>)}
    </select>
    <select name="signup_role" aria-label="Choose your raid role" required value={selected}
      disabled={!options.length} onChange={e=>setRole(e.target.value as Role)}>
      {options.map(r=><option value={r} key={r}>{roleLabels[r]} · {remaining[r]} left</option>)}
    </select>
    <button className="raid-button" type="submit" disabled={!options.length}>{options.length?'Sign up':'No slots for class'}</button>
  </form>;
}
