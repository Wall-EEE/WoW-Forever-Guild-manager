'use client';
import {useMemo,useState} from 'react';
import type {RosterRow} from './page';

type Member={id:string;name:string;role:string;joined:string;characters:RosterRow[]};
const rank:Record<string,number>={guild_master:0,officer:1,member:2};
const labels:Record<string,string>={guild_master:'Guild Master',officer:'Officer',member:'Member'};
export default function RosterBrowser({rows}:{rows:RosterRow[]}){
  const [query,setQuery]=useState('');
  const [role,setRole]=useState('all');
  const [className,setClassName]=useState('all');
  const [onlyMains,setOnlyMains]=useState(false);
  const classes=[...new Set(rows.map(r=>r.class_name).filter((v):v is string=>!!v))].sort();
  const members=useMemo(()=>{
    const map=new Map<string,Member>();
    for(const r of rows){
      let m=map.get(r.profile_id);
      if(!m){m={id:r.profile_id,name:r.display_name,role:r.guild_role,joined:r.joined_at,characters:[]};map.set(r.profile_id,m);}
      if(r.character_id)m.characters.push(r);
    }
    const needle=query.trim().toLocaleLowerCase();
    return [...map.values()].filter(m=>{
      if(role!=='all'&&m.role!==role)return false;
      const matching=m.characters.filter(c=>(className==='all'||c.class_name===className)&&(!onlyMains||c.is_main));
      if(className!=='all'&&!matching.length)return false;
      if(onlyMains&&!matching.length)return false;
      if(needle&&!m.name.toLocaleLowerCase().includes(needle)&&!matching.some(c=>
        c.character_name?.toLocaleLowerCase().includes(needle)||c.spec_name?.toLocaleLowerCase().includes(needle)))return false;
      return true;
    }).sort((a,b)=>(rank[a.role]??9)-(rank[b.role]??9)||a.name.localeCompare(b.name));
  },[rows,query,role,className,onlyMains]);
  return <section className="roster-browser">
    <div className="roster-browser-head"><div><p className="roster-kicker">MEMBER DIRECTORY</p><h2>Hall of Heroes</h2></div><span>{members.length} players shown</span></div>
    <div className="roster-filters">
      <label>Search members or characters<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Name, character or spec…"/></label>
      <label>Guild rank<select value={role} onChange={e=>setRole(e.target.value)}><option value="all">All ranks</option><option value="guild_master">Guild Master</option><option value="officer">Officers</option><option value="member">Members</option></select></label>
      <label>Class<select value={className} onChange={e=>setClassName(e.target.value)}><option value="all">All classes</option>{classes.map(c=><option value={c} key={c}>{c}</option>)}</select></label>
      <label className="roster-check"><input type="checkbox" checked={onlyMains} onChange={e=>setOnlyMains(e.target.checked)}/> Mains only</label>
    </div>
    {!members.length?<div className="roster-empty">No members match these filters.</div>:
      <div className="roster-members">{members.map(m=>{
        const shown=m.characters.filter(c=>(className==='all'||c.class_name===className)&&(!onlyMains||c.is_main));
        return <article className="roster-member" key={m.id}>
          <div className="roster-member-head"><div className="roster-avatar">{m.name.slice(0,1).toUpperCase()}</div><div className="roster-member-name"><h3>{m.name}</h3><span className={'roster-rank roster-rank-'+m.role}>{labels[m.role]??m.role}</span></div><small>{m.characters.length} character{m.characters.length===1?'':'s'}</small></div>
          <div className="roster-character-grid">{shown.length?shown.map(c=><div className="roster-character" key={c.character_id}>
            <span className="roster-class-icon" data-class={c.class_name}>{c.class_name?.slice(0,1)}</span>
            <div><strong>{c.character_name} {c.is_main&&<em>★ MAIN</em>}</strong>
              <span>{c.spec_name??'Spec not set'} {c.class_name} · {c.race_name??'Horde'}</span>
              <small>{c.raid_role?.toUpperCase()??'DPS'}</small></div>
          </div>):<p className="roster-no-chars">{m.characters.length?'No characters match this filter.':'No characters registered yet.'}</p>}</div>
        </article>;
      })}</div>}
  </section>;
}
