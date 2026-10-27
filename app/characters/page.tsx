import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { saveCharacter, deleteCharacter, makeMain } from './actions';
import './characters.css';

export const dynamic = 'force-dynamic';

const classes = ['Warrior', 'Paladin', 'Hunter', 'Rogue', 'Priest', 'Shaman', 'Mage', 'Warlock', 'Druid'];
const roles = [
  { value: 'tank', label: 'Tank' }, { value: 'healer', label: 'Healer' },
  { value: 'dps', label: 'DPS' }, { value: 'flex', label: 'Flexible' },
];
type Character = {
  id: string; character_name: string; realm: string; class_name: string;
  race_name: string | null; level: number; raid_role: string; is_main: boolean;
};

function CharacterForm({ character }: { character?: Character }) {
  return <form className="character-form" action={saveCharacter}>
    {character && <input type="hidden" name="character_id" value={character.id} />}
    <div className="form-grid">
      <label>Character name <input name="character_name" required minLength={2} maxLength={40} defaultValue={character?.character_name} placeholder="Aetherwind" /></label>
      <label>Realm <input name="realm" required minLength={2} maxLength={80} defaultValue={character?.realm} placeholder="Your realm" /></label>
      <label>Class
        <select name="class_name" required defaultValue={character?.class_name ?? ''}>
          <option value="" disabled>Select a class</option>
          {classes.map(name => <option value={name} key={name}>{name}</option>)}
        </select>
      </label>
      <label>Race (optional) <input name="race_name" minLength={2} maxLength={40} defaultValue={character?.race_name ?? ''} placeholder="Human, Orc, ..." /></label>
      <label>Level (1–60) <input name="level" type="number" required min={1} max={60} step={1} defaultValue={character?.level ?? 1} /></label>
      <label>Preferred raid role
        <select name="raid_role" defaultValue={character?.raid_role ?? 'flex'}>
          {roles.map(role => <option key={role.value} value={role.value}>{role.label}</option>)}
        </select>
      </label>
    </div>
    <button type="submit" className="char-primary">{character ? 'Save changes' : '+ Add character'}</button>
  </form>;
}

export default async function CharactersPage({ searchParams }: { searchParams: Promise<{ result?: string }> }) {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) redirect('/login');
  const userId = String(claims.claims.sub);
  const [{ data, error }, { data: profile }] = await Promise.all([
    supabase.from('characters')
      .select('id,character_name,realm,class_name,race_name,level,raid_role,is_main')
      .eq('owner_id', userId).order('is_main', { ascending: false }).order('character_name'),
    supabase.from('profiles').select('display_name,role,guest_status').eq('id', userId).single(),
  ]);
  const characters = (data ?? []) as Character[];
  const { result } = await searchParams;
  const feedback: Record<string, string> = {
    created: 'Character added successfully.', updated: 'Changes saved.',
    deleted: 'Character deleted.', main: 'Main character updated.',
    error: 'Unable to save your changes. Check the fields, or make sure this character belongs to you and is not already registered on this realm.',
  };
  const main = characters.find(char => char.is_main);

  return <main className="char-shell">
    <header className="char-top">
      <Link className="char-brand" href="/">⚔ <span>WOW <b>FOREVER</b></span></Link>
      <nav><Link href="/">Overview</Link><Link className="char-current" href="/characters">My Characters</Link><Link href="/account">Account</Link></nav>
      <span className="char-user">{profile?.display_name ?? 'Adventurer'} · {profile?.role === 'guest' ? 'Guest' : 'Guild'}</span>
    </header>
    <div className="char-inner">
      <div className="char-breadcrumb">GUILD COMMAND CENTER / ROSTER</div>
      <div className="char-heading"><div><p className="char-kicker">THE HALL OF HEROES</p><h1>My Characters</h1>
        <p>All your adventurers, one roster. Prepare your mains and alts for the raids ahead.</p></div>
        <span className="char-cap">CLASSIC+ <strong>LEVEL CAP 60</strong></span>
      </div>

      {result && feedback[result] && <div role="status" className={result === 'error' ? 'char-notice char-notice-error' : 'char-notice'}>{feedback[result]}</div>}

      <div className="char-summary">
        <div><span>REGISTERED CHARACTERS</span><strong>{characters.length}</strong></div>
        <div><span>AT LEVEL 60</span><strong>{characters.filter(c => c.level === 60).length}</strong></div>
        <div><span>YOUR MAIN</span><strong className="char-main-stat">{main?.character_name ?? 'Not selected'}</strong></div>
      </div>

      <div className="char-columns">
        <section className="char-panel">
          <div className="char-panel-head"><div><p className="char-kicker">YOUR ADVENTURERS</p><h2>Character roster</h2></div><span>{characters.length} total</span></div>
          {error ? <p className="char-empty">Could not load your characters. Check the database migration and permissions.</p> :
          characters.length === 0 ? <div className="char-empty"><span>⚔</span><h3>Your story begins here</h3><p>Register your first character using the form beside this panel.</p></div> :
          <div className="char-list">{characters.map(char => <article className="char-card" key={char.id}>
            <div className="char-emblem" data-class={char.class_name}>{char.class_name.slice(0,1)}</div>
            <div className="char-info">
              <div className="char-name">{char.character_name} {char.is_main && <span className="char-main-badge">★ MAIN</span>}</div>
              <div className="char-meta">Level {char.level} {char.race_name ? char.race_name + ' ' : ''}{char.class_name} · {char.raid_role.toUpperCase()}</div>
              <div className="char-realm">Realm: {char.realm}</div>
            </div>
            <div className="char-actions">
              {!char.is_main && <form action={makeMain}><input type="hidden" name="character_id" value={char.id}/><button type="submit" className="char-action">Set main</button></form>}
              <details className="char-edit"><summary className="char-action">Edit</summary><div className="char-edit-form"><CharacterForm character={char} /></div></details>
              <form action={deleteCharacter}><input type="hidden" name="character_id" value={char.id}/>
                <button type="submit" className="char-action char-danger" aria-label={'Delete ' + char.character_name}>Delete</button>
              </form>
            </div>
          </article>)}</div>}
        </section>
        <aside className="char-panel char-create">
          <p className="char-kicker">EXPAND YOUR ROSTER</p>
          <h2>Register a character</h2>
          <p className="char-help">Enter your character details manually. Game imports can be added when supported.</p>
          <CharacterForm />
          <p className="char-helper">Characters are private to your account. Guild officers may view them, but only you can edit or delete them.</p>
        </aside>
      </div>
      <p className="char-footnote">WoW Forever · Built for guild members and approved guest raiders. Character registration is available to all signed-in accounts.</p>
    </div>
  </main>;
}
