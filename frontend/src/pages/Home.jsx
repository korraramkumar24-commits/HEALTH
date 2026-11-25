import { Link } from 'react-router-dom';

const Home = () => (
  <div className="home-page">
    <main>
    <div className="home-showcase">
      <header className="home-header">
        <Link className="home-brand" to="/" aria-label="CareHub home">
          <span className="home-brand-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M20.8 8.8c0 5.2-8.8 11-8.8 11s-8.8-5.8-8.8-11A4.7 4.7 0 0 1 12 6.3a4.7 4.7 0 0 1 8.8 2.5Z" />
              <path d="M6.4 12h3l1.6-3.1 2.2 6 1.6-3h2.8" />
            </svg>
          </span>
          <span>carehub<span className="home-brand-period">.</span></span>
        </Link>
        <nav className="home-nav" aria-label="Main navigation">
          <a href="#how-it-works">How it works</a>
          <a href="#care-team">For care teams</a>
        </nav>
        <div className="home-header-actions">
          <Link className="home-sign-in" to="/login">Sign in</Link>
          <Link className="home-button home-button-small" to="/register">Get started <span aria-hidden="true">↗</span></Link>
        </div>
      </header>

      <section className="home-hero" aria-labelledby="home-heading">
        <div className="home-hero-copy">
          <p className="home-eyebrow"><span aria-hidden="true" /> CAREHUB FOR CHRONIC CARE</p>
          <h1 id="home-heading">Chronic disease <span>remote monitoring.</span></h1>
          <p className="home-hero-description">
            Remote monitoring for chronic conditions, made more human. Bring everyday readings and care-team follow-up into one connected experience.
          </p>
          <div className="home-hero-actions">
            <Link className="home-button" to="/register">Explore CareHub <span aria-hidden="true">↗</span></Link>
            <a className="home-text-link" href="#how-it-works"><span className="home-play-icon" aria-hidden="true">↓</span> See how it works</a>
          </div>
          <div className="home-proof">
            <div className="home-avatar-stack" aria-hidden="true"><span>J</span><span>M</span><span>A</span></div>
            <p><strong>Care that keeps the conversation going.</strong><br />At home, between appointments.</p>
          </div>
        </div>

        <div className="home-hero-art" aria-label="Illustration of a connected care dashboard with sample health readings">
          <div className="home-art-orbit home-art-orbit-one" />
          <div className="home-art-orbit home-art-orbit-two" />
          <div className="home-monitor-card">
            <div className="home-monitor-top">
              <span className="home-monitor-brand"><span className="home-mini-mark">+</span> Care overview</span>
              <span className="home-live"><i /> DEMO DATA</span>
            </div>
            <p className="home-monitor-date">YOUR WEEK AT A GLANCE <span>•••</span></p>
            <div className="home-reading-card">
              <span className="home-reading-icon home-reading-heart" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M20.8 8.8c0 5.2-8.8 11-8.8 11s-8.8-5.8-8.8-11A4.7 4.7 0 0 1 12 6.3a4.7 4.7 0 0 1 8.8 2.5Z" /><path d="M6.5 12h3l1.5-3 2.1 6 1.7-3h2.7" /></svg>
              </span>
              <span className="home-reading-label">Heart rate</span>
              <strong>72 <small>bpm</small></strong>
              <span className="home-reading-status">Within your usual range</span>
              <svg className="home-sparkline" viewBox="0 0 300 62" role="img" aria-label="Illustrative heart-rate trend">
                <defs><linearGradient id="home-chart-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#81c7ff" stopOpacity=".34" /><stop offset="1" stopColor="#81c7ff" stopOpacity="0" /></linearGradient></defs>
                <path d="M0 47 C18 47 19 31 36 35 S57 47 73 39 S91 17 109 29 S130 45 146 36 S165 25 182 33 S199 43 216 29 S237 14 253 25 S278 35 300 13 V62 H0Z" fill="url(#home-chart-fill)" />
                <path d="M0 47 C18 47 19 31 36 35 S57 47 73 39 S91 17 109 29 S130 45 146 36 S165 25 182 33 S199 43 216 29 S237 14 253 25 S278 35 300 13" fill="none" stroke="#3c9df4" strokeLinecap="round" strokeWidth="3" />
              </svg>
            </div>
            <div className="home-monitor-bottom">
              <div className="home-mini-reading">
                <span className="home-reading-icon home-reading-pressure" aria-hidden="true">↗</span>
                <span><small>Blood pressure</small><strong>118 / 76</strong></span>
                <b>●</b>
              </div>
              <div className="home-mini-reading">
                <span className="home-reading-icon home-reading-oxygen" aria-hidden="true">◌</span>
                <span><small>Daily check-in</small><strong>Up to date</strong></span>
                <b>✓</b>
              </div>
            </div>
            <div className="home-care-note"><span aria-hidden="true">✳</span><p><strong>Your care team, in the loop.</strong><br />Shared readings can support more informed follow-ups.</p></div>
          </div>
          <div className="home-floating-note"><span className="home-note-icon" aria-hidden="true">✓</span><span><strong>A little progress,</strong><br />noticed every day</span></div>
          <span className="home-art-spark home-art-spark-one" aria-hidden="true">✳</span>
          <span className="home-art-spark home-art-spark-two" aria-hidden="true">✳</span>
        </div>
      </section>
    </div>
      <section className="home-benefits" id="how-it-works" aria-labelledby="benefits-heading">
        <div className="home-section-intro">
          <p className="home-eyebrow">CARE THAT CONNECTS THE DOTS</p>
          <h2 id="benefits-heading">More than a reading.<br /><span>A clearer picture.</span></h2>
          <p>Living with a long-term condition is a day-to-day journey. CareHub helps make the moments between visits count.</p>
        </div>
        <div className="home-benefit-grid">
          <article className="home-benefit-card">
            <span className="home-benefit-icon home-benefit-blue" aria-hidden="true">⌁</span>
            <h3>Check in from home</h3>
            <p>Keep track of health readings and daily check-ins in one simple place.</p>
          </article>
          <article className="home-benefit-card">
            <span className="home-benefit-icon home-benefit-mint" aria-hidden="true">◎</span>
            <h3>Stay connected to care</h3>
            <p>Help your care team see shared updates and follow up with more context.</p>
          </article>
          <article className="home-benefit-card" id="care-team">
            <span className="home-benefit-icon home-benefit-lilac" aria-hidden="true">↗</span>
            <h3>See the bigger picture</h3>
            <p>Bring trends, care plans, and conversations together between appointments.</p>
          </article>
        </div>
      </section>

      <section className="home-cta" aria-label="Get started with CareHub">
        <div><p className="home-eyebrow">A MORE CONNECTED CARE JOURNEY</p><h2>Small steps. Better-informed care.</h2></div>
        <Link className="home-button home-button-light" to="/register">Get started <span aria-hidden="true">↗</span></Link>
      </section>
    </main>

    <footer className="home-footer">
      <Link className="home-brand" to="/" aria-label="CareHub home">
        <span className="home-brand-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M20.8 8.8c0 5.2-8.8 11-8.8 11s-8.8-5.8-8.8-11A4.7 4.7 0 0 1 12 6.3a4.7 4.7 0 0 1 8.8 2.5Z" /><path d="M6.4 12h3l1.6-3.1 2.2 6 1.6-3h2.8" /></svg>
        </span>
        <span>carehub<span className="home-brand-period">.</span></span>
      </Link>
      <p>A demonstration experience using fake data only. Not for medical use.</p>
      <span>© CareHub Demo</span>
    </footer>
  </div>
);

export default Home;
