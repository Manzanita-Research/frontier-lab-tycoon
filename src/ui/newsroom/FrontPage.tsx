import type { FrontPage as Page } from "../../newsroom/edition";
import { formatDate } from "../../sim/format";
export function FrontPage({ page }: { page: Page }) {
  return <article className="front-page">
    <div className="paper-eyebrow"><span>Independent. Mostly.</span><span>WEEK {Math.floor(page.day / 7)}</span><span>2 tokens</span></div>
    <h1 className="masthead">The Frontier Times</h1>
    <div className="paper-date"><span>{formatDate(page.from)} — {formatDate(page.day - 1)}</span><span>All the news that's fit to prompt</span></div>
    <div className="paper-lead">
      <div><span className="paper-section">{page.lead.kind === "filler" ? "The week in AI" : `${page.lead.kind} / campus dispatch`}</span><h2>{page.lead.text}</h2><p className="paper-deck">A week at {page.lab}. Everyone has a take. The compute cluster has a hum.</p><div className="byline">By our extremely online correspondent</div></div>
      <figure>{page.photo ? <img src={page.photo} alt={`The current campus camera view at ${page.lab}`} /> : <div className="paper-no-photo">Our photographer is experiencing a context window.</div>}<figcaption>{page.caption}</figcaption></figure>
    </div>
    <div className="paper-substories">{page.sub.map((s, i) => <section key={s.id}><span className="paper-section">{["Elsewhere", "Developing", "The back page"][i]}</span><h3>{s.text}</h3><p>{s.kind === "filler" ? "Our editorial desk is monitoring the situation, mostly from the kombucha queue." : "Campus sources confirm the situation remains a situation. More as the discourse develops."}</p></section>)}</div>
    <div className="paper-bottom"><section><span className="paper-section">Classifieds · No refunds</span><p>{page.classified}</p></section><section><span className="paper-section">Rival watch · Fictional sentiment index</span><div className="rival-stocks">{page.stocks.map((s) => <div key={s.name}><b>{s.name}</b><span>{s.price}</span><em className={s.change >= 0 ? "up" : "down"}>{s.change >= 0 ? "▲" : "▼"} {Math.abs(s.change)}%</em></div>)}</div></section></div>
    <footer className="paper-footer">Printed on 100% recycled discourse. Please supervise this newspaper.</footer>
  </article>;
}
