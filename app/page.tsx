const raids = [
  { day: "FRI", date: "30 OCT", name: "Molten Core", time: "19:00", type: "Guild raid", filled: "32 / 40" },
  { day: "SUN", date: "01 NOV", name: "Semi-guild run", time: "18:30", type: "Guild + guests", filled: "26 / 40" },
  { day: "TUE", date: "03 NOV", name: "Raid night", time: "19:00", type: "Guild raid", filled: "18 / 40" },
];

const applicants = [
  { name: "Aetherwind", character: "Restoration Druid", status: "Awaiting review" },
  { name: "Ironward", character: "Protection Warrior", status: "Awaiting review" },
  { name: "Duskmere", character: "Mage", status: "Needs review" },
];

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="panel"><h2>{title}</h2>{children}</section>;
}

export default function Home() {
  return (
    <main className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/"><span className="brand-mark">W</span><span>WOW <b>FOREVER</b></span></a>
        <p className="nav-label">COMMAND</p>
        <nav>
          <a className="nav-item active" href="/">◈ Overview</a>
          <a className="nav-item" href="/raids">▦ Raid calendar</a>
          <a className="nav-item" href="/characters">⚔ My characters</a>
          <a className="nav-item" href="/guild">♜ Guild roster</a>
          <a className="nav-item" href="/account">♙ Account</a>
          <a className="nav-item" href="#">♙ Applications</a>
          <a className="nav-item" href="/admin/guests">♧ Guest players</a>
          <a className="nav-item" href="#">▤ Strategies</a>
        </nav>
        <details className="sidebar-mobile-menu"><summary aria-label="Toggle dashboard navigation"><span className="dashboard-burger" aria-hidden="true"><i/><i/><i/></span><span>Menu</span></summary>
          <nav aria-label="Mobile dashboard navigation">
            <a className="nav-item active" href="/">◈ Overview</a>
            <a className="nav-item" href="/raids">▦ Raid Calendar</a>
            <a className="nav-item" href="/characters">⚔ My Characters</a>
            <a className="nav-item" href="/guild">♜ Guild Roster</a>
            <a className="nav-item" href="/account">♙ Account</a>
          </nav>
        </details>
        <div className="sidebar-bottom"><span className="online-dot" />Development build<p>CLASSIC+ · LEVEL 60</p></div>
      </aside>

      <div className="main-content">
        <header className="topbar">
          <div><p className="eyebrow">GUILD COMMAND CENTER</p><h1>Overview</h1></div>
          <div className="profile"><span className="avatar">GM</span><span><b>Guild Master</b><small>Local preview</small></span></div>
        </header>

        <section className="welcome">
          <div><p className="eyebrow gold">YOUR GUILD. YOUR LEGACY.</p><h2>Ready for the next adventure?</h2><p>Manage your roster, prepare your raids, and bring your community together.</p></div>
          <div className="welcome-emblem">⚔</div>
        </section>

        <div className="stats-grid">
          <article className="stat-card"><span>GUILD MEMBERS</span><strong>42</strong><small>Across all characters</small></article>
          <article className="stat-card"><span>YOUR CHARACTERS</span><strong>8</strong><small>Mains and alts</small></article>
          <article className="stat-card"><span>GUESTS APPROVED</span><strong>16</strong><small>Raid-ready community</small></article>
          <article className="stat-card"><span>NEEDS ATTENTION</span><strong className="gold-text">3</strong><small>Pending guest reviews</small></article>
        </div>

        <div className="content-grid">
          <Panel title="Upcoming raids">
            <div className="panel-subtitle">Your shared guild and guest calendar</div>
            <div className="raid-list">{raids.map((raid) => (
              <article className="raid-row" key={raid.name}>
                <div className="date-tile"><b>{raid.day}</b><span>{raid.date}</span></div>
                <div className="raid-info"><b>{raid.name}</b><span>{raid.type} · {raid.time}</span></div>
                <span className="raid-count">{raid.filled}</span>
              </article>
            ))}</div>
            <button className="secondary-button" type="button" disabled title="Calendar coming in a future milestone">Raid calendar coming soon</button>
          </Panel>

          <Panel title="Guest approval queue">
            <div className="panel-subtitle">Review before guests can sign up</div>
            <div className="applicant-list">{applicants.map((applicant) => (
              <article className="applicant-row" key={applicant.name}>
                <div className="applicant-avatar">{applicant.name[0]}</div>
                <div className="applicant-info"><b>{applicant.name}</b><span>{applicant.character}</span><small>{applicant.status}</small></div>
                <span className="review-pending">Coming soon</span>
              </article>
            ))}</div>
            <p className="privacy-note">Guest access stays restricted until approval once authentication is implemented.</p>
          </Panel>
        </div>
        <footer>WOW FOREVER <span>·</span> Community first. Adventure always.</footer>
      </div>
    </main>
  );
}
