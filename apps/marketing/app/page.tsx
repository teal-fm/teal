const activity = [
  { initial: "M", name: "marisol.fm", action: "saved", title: "Dragon New Warm Mountain I Believe in You", detail: "Big Thief · 2022", tone: "coral" },
  { initial: "E", name: "eli.bsky.social", action: "listened to", title: "Fool", detail: "Adrianne Lenker · 2024", tone: "mint" },
  { initial: "J", name: "juno.teal.fm", action: "found", title: "Desire, I Want to Turn Into You", detail: "Caroline Polachek · 2023", tone: "sky" },
];

const principles = [
  {
    number: "01",
    title: "Keep the feeling.",
    text: "A listen is more than a timestamp. Teal gives the music around your life a home that feels like yours.",
  },
  {
    number: "02",
    title: "Stay connected.",
    text: "Follow the people whose taste moves you. Find the records, artists, and little obsessions worth passing on.",
  },
  {
    number: "03",
    title: "Take it with you.",
    text: "Your listening life lives on the open social web, so your profile remains yours—not a platform's property.",
  },
];

export default function Home() {
  return (
    <main>
      <section className="hero" id="top">
        <nav className="nav" aria-label="Main navigation">
          <a className="wordmark" href="#top" aria-label="Teal home">Teal<span>.</span></a>
          <div className="nav-links">
            <a href="#why-teal">Why Teal</a>
            <a href="#open">On the open web</a>
          </div>
          <a className="nav-cta" href="https://sigilyph.teal.fm">Open Teal <span aria-hidden="true">↗</span></a>
        </nav>

        <div className="hero-grid">
          <div className="hero-copy">
            <p className="eyebrow"><span className="pulse" aria-hidden="true" /> A social home for your music</p>
            <h1>Keep your<br /><em>music close.</em></h1>
            <p className="hero-intro">Teal is a more personal way to remember what you listen to, find what moves you, and share your taste with people who get it.</p>
            <div className="hero-actions">
              <a className="button primary" href="https://sigilyph.teal.fm">Start listening <span aria-hidden="true">↗</span></a>
              <a className="text-link" href="#why-teal">Take a look <span aria-hidden="true">↓</span></a>
            </div>
          </div>

          <div className="signal-art" aria-label="An abstract visual representation of music moving between listeners" role="img">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="orbit orbit-three" />
            <div className="orbit orbit-four" />
            <span className="signal-dot dot-main">✦</span>
            <span className="signal-dot dot-one">✦</span>
            <span className="signal-dot dot-two">✦</span>
            <span className="signal-dot dot-three">✦</span>
            <span className="signal-mark mark-one">+</span>
            <span className="signal-mark mark-two">{"//"}</span>
            <p className="signal-label">always<br />in motion</p>
          </div>
        </div>

        <div className="hero-footer">
          <p>Made for the songs that become part of you.</p>
          <a href="#why-teal" aria-label="Scroll to why Teal">Scroll to wander <span aria-hidden="true">↓</span></a>
        </div>
      </section>

      <section className="listening-strip" aria-label="A sample of listening activity">
        <p className="strip-label">A little closer to the music</p>
        <div className="activity-list">
          {activity.map((item) => (
            <article className="activity-item" key={item.name}>
              <span className={`avatar ${item.tone}`}>{item.initial}</span>
              <p><strong>{item.name}</strong> {item.action}<br /><span>{item.title}</span></p>
              <small>{item.detail}</small>
            </article>
          ))}
        </div>
      </section>

      <section className="why-section" id="why-teal">
        <div className="section-heading">
          <p className="eyebrow dark"><span aria-hidden="true">✦</span> A different kind of music diary</p>
          <h2>Remember the<br /><em>whole story.</em></h2>
        </div>
        <div className="principles">
          {principles.map((item) => (
            <article className="principle" key={item.number}>
              <span>{item.number}</span>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="open-section" id="open">
        <div className="open-copy">
          <p className="eyebrow"><span aria-hidden="true">✦</span> Built for the open social web</p>
          <h2>Good taste<br />should travel.</h2>
          <p>Teal is built on AT Protocol—an open, decentralized network that lets your identity and community move with you. No walled garden. No starting over.</p>
          <a className="text-link light" href="https://atproto.com">Meet AT Protocol <span aria-hidden="true">↗</span></a>
        </div>
        <div className="open-card">
          <div className="open-card-top"><span className="mini-logo">Teal.</span><span>your music, your profile</span></div>
          <div className="route-line"><i /><i /><i /><i /><i /></div>
          <div className="open-card-bottom"><strong>Open by design</strong><span>for music people everywhere</span></div>
        </div>
      </section>

      <section className="cta-section">
        <p className="eyebrow dark"><span aria-hidden="true">✦</span> Your next favorite thing is out there</p>
        <h2>Make space for<br /><em>what you love.</em></h2>
        <a className="button primary" href="https://sigilyph.teal.fm">Open Teal <span aria-hidden="true">↗</span></a>
      </section>

      <footer>
        <a className="wordmark footer-mark" href="#top">Teal<span>.</span></a>
        <p>A social home for your music.</p>
        <div><a href="https://github.com/teal-fm/teal">GitHub</a><a href="https://sigilyph.teal.fm">The app ↗</a></div>
      </footer>
    </main>
  );
}
