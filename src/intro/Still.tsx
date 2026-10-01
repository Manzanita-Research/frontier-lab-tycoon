// Reduced motion (FLT-70): no 3D, no camera moves. The box on a plain shelf, its back, a Play button, and the manual
// as plain text for anyone who wants to read it.
import type { Intro } from "./actor";
import boxFront from "./assets/box-front.webp";
import { HERO, STORE } from "./content";
import { PAGES, type Block } from "./manual";

export default function Still({ intro, manual }: { intro: Intro; manual: boolean }) {
  const send = intro.send;

  return (
    <div className="still">
      <header className="still-sign">
        <b>{STORE.name}</b> <span>{STORE.aisle}</span>
      </header>
      <main className="still-main">
        <div className="still-box">
          <img className="still-box-art" src={boxFront} alt={`${HERO.title}: the box`} />
        </div>
        <section className="still-back">
          <h1>{HERO.title}</h1>
          <p className="still-tag">{HERO.tagline}</p>
          <ul>
            {HERO.back.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
          <p className="still-fine">{HERO.requirements}</p>
          <div className="intro-row">
            <button className="intro-primary still-play" onClick={() => send({ type: "PLAY" })} autoFocus>
              ▶ Play
            </button>
            <button onClick={() => send(manual ? { type: "BACK" } : { type: "FOCUS", item: "manual" })}>{manual ? "Close the manual" : "Read the manual"}</button>
          </div>
        </section>
      </main>
      {manual && (
        <article className="still-manual" aria-label="The manual">
          {PAGES.map((p, i) =>
            p.kind !== "text" ? null : (
              <section key={i}>
                {p.chapter && <p className="still-chapter">{p.chapter}</p>}
                {p.title && <h2>{p.title}</h2>}
                {p.blocks.map((b, j) => (
                  <BlockHtml key={j} b={b} />
                ))}
              </section>
            ),
          )}
        </article>
      )}
    </div>
  );
}

function BlockHtml({ b }: { b: Block }) {
  switch (b.t) {
    case "h":
      return <h3>{b.text}</h3>;
    case "p":
      return <p>{b.text}</p>;
    case "tip":
      return <p className="still-tip">{b.text}</p>;
    case "code":
      return <pre>{b.text}</pre>;
    case "stamp":
      return <p className="still-stamp">{b.text}</p>;
    case "list":
      return b.numbered ? (
        <ol>
          {b.items.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ol>
      ) : (
        <ul>
          {b.items.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      );
    case "table":
      return (
        <table>
          <tbody>
            {b.rows.map(([k, v]) => (
              <tr key={k}>
                <th>{k}</th>
                <td>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
  }
}
