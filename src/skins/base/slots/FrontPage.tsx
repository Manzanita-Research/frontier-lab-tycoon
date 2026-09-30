import type { SlotPropsMap } from "../../types";

export function FrontPage({ paper }: SlotPropsMap["FrontPage"]) {
  return (
    <article className="front-page">
      <div className="paper-eyebrow">
        <span>Independent. Mostly.</span>
        <span>WEEK {paper.week}</span>
        <span>2 tokens</span>
      </div>
      <h1 className="masthead">The Frontier Times</h1>
      <div className="paper-date">
        <span>{paper.range}</span>
        <span>All the news that's fit to prompt</span>
      </div>
      <div className="paper-lead">
        <div>
          <span className="paper-section">{paper.leadKind}</span>
          <h2>{paper.lead}</h2>
          <p className="paper-deck">A week at {paper.lab}. Everyone has a take. The compute cluster has a hum.</p>
          <div className="byline">By our extremely online correspondent</div>
        </div>
        <figure>
          {paper.photo ? <img src={paper.photo} alt={`The current campus camera view at ${paper.lab}`} /> : <div className="paper-no-photo">Our photographer is experiencing a context window.</div>}
          <figcaption>{paper.caption}</figcaption>
        </figure>
      </div>
      <div className="paper-substories">
        {paper.substories.map((s) => (
          <section key={s.id}>
            <span className="paper-section">{s.label}</span>
            <h3>{s.text}</h3>
            <p>{s.filler ? "Our editorial desk is monitoring the situation, mostly from the kombucha queue." : "Campus sources confirm the situation remains a situation. More as the discourse develops."}</p>
          </section>
        ))}
      </div>
      <div className="paper-bottom">
        <section>
          <span className="paper-section">Classifieds · No refunds</span>
          <p>{paper.classified}</p>
        </section>
        <section>
          <span className="paper-section">Rival watch · Fictional sentiment index</span>
          <div className="rival-stocks">
            {paper.stocks.map((s) => (
              <div key={s.name}>
                <b>{s.name}</b>
                <span>{s.price}</span>
                <em className={s.change >= 0 ? "up" : "down"}>
                  {s.change >= 0 ? "▲" : "▼"} {Math.abs(s.change)}%
                </em>
              </div>
            ))}
          </div>
        </section>
      </div>
      <footer className="paper-footer">Printed on 100% recycled discourse. Please supervise this newspaper.</footer>
    </article>
  );
}
