'use client';

import { useState } from 'react';
import { saveCharacter } from './actions';

export const classSpecs: Record<string,string[]> = {
  Warrior: ['Arms','Fury','Protection'],
  Paladin: ['Holy','Protection','Retribution'],
  Hunter: ['Beast Mastery','Marksmanship','Survival'],
  Rogue: ['Assassination','Combat','Subtlety'],
  Priest: ['Discipline','Holy','Shadow'],
  Shaman: ['Elemental','Enhancement','Restoration'],
  Mage: ['Arcane','Fire','Frost'],
  Warlock: ['Affliction','Demonology','Destruction'],
  Druid: ['Balance','Feral','Restoration'],
};
const races = ['Orc','Tauren','Troll','Undead','Skyborne'];
const roles = [{value:'tank',label:'Tank'},{value:'healer',label:'Healer'},{value:'dps',label:'DPS'},{value:'flex',label:'Flexible'}];
type Character = {id:string;character_name:string;class_name:string;race_name:string|null;raid_role:string;spec_name:string|null};
export default function CharacterForm({character}:{character?:Character}) {
  const [chosenClass,setChosenClass] = useState(character?.class_name ?? '');
  const [spec,setSpec] = useState(character?.spec_name ?? '');
  return <form className="character-form" action={saveCharacter}>
    {character && <input type="hidden" name="character_id" value={character.id}/>}
    <div className="form-grid">
      <label>Character name <input name="character_name" required minLength={2} maxLength={40} defaultValue={character?.character_name} placeholder="Aetherwind"/></label>
      <label>Class
        <select name="class_name" required value={chosenClass} onChange={e=>{setChosenClass(e.target.value);setSpec('');}}>
          <option value="" disabled>Select class</option>
          {Object.keys(classSpecs).map(name=><option key={name} value={name}>{name}</option>)}
        </select>
      </label>
      <label>Specialization
        <select name="spec_name" value={spec} onChange={e=>setSpec(e.target.value)} required disabled={!chosenClass}>
          <option value="" disabled>Select spec</option>
          {(classSpecs[chosenClass] ?? []).map(name=><option key={name} value={name}>{name}</option>)}
        </select>
      </label>
      <label>Race <select name="race_name" required defaultValue={character?.race_name??''}>
        <option value="" disabled>Select race</option>
        {races.map(name=><option key={name} value={name}>{name}</option>)}
      </select></label>
      <label>Preferred raid role <select name="raid_role" defaultValue={character?.raid_role??'flex'}>
        {roles.map(role=><option key={role.value} value={role.value}>{role.label}</option>)}
      </select></label>
    </div>
    <button className="char-primary" type="submit">{character?'Save changes':'+ Add character'}</button>
  </form>;
}
