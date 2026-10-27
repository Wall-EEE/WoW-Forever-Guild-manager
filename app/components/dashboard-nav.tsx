import Link from 'next/link';

const items=[
  {href:'/',label:'Overview'},
  {href:'/raids',label:'Raid Calendar'},
  {href:'/characters',label:'My Characters'},
  {href:'/guild',label:'Guild Roster'},
  {href:'/account',label:'Account'},
];

export default function DashboardNav({active,displayName}:{active:string;displayName?:string}){
  return <header className="dashboard-nav">
    <Link className="dashboard-brand" href="/">⚔ <span>WOW <b>FOREVER</b></span></Link>
    <nav className="dashboard-desktop-links" aria-label="Main navigation">
      {items.map(item=><Link key={item.href} href={item.href} aria-current={active===item.href?'page':undefined}>{item.label}</Link>)}
    </nav>
    <span className="dashboard-nav-user">{displayName??'Adventurer'}</span>
    <details className="dashboard-mobile-menu">
      <summary aria-label="Open navigation menu"><span className="dashboard-burger" aria-hidden="true"><i/><i/><i/></span><span>Menu</span></summary>
      <nav aria-label="Mobile navigation">{items.map(item=><Link key={item.href} href={item.href} aria-current={active===item.href?'page':undefined}>{item.label}</Link>)}</nav>
    </details>
  </header>;
}
