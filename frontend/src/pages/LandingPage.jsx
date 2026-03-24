import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaRobot, FaImage, FaMicrophone, FaBolt, FaChartLine, FaGlobe, FaBuilding, FaCar } from 'react-icons/fa';
import './LandingPage.css';

const GALLERY = [
  { url: 'https://picsum.photos/seed/abudhabi1/600/400',  label: 'Abu Dhabi Skyline' },
  { url: 'https://picsum.photos/seed/mosque2/600/400',    label: 'Sheikh Zayed Mosque' },
  { url: 'https://picsum.photos/seed/ferrari3/600/400',   label: 'Ferrari World' },
  { url: 'https://picsum.photos/seed/corniche4/600/400',  label: 'The Corniche' },
  { url: 'https://picsum.photos/seed/yasisle5/600/400',   label: 'Yas Island' },
  { url: 'https://picsum.photos/seed/towers6/600/400',    label: 'Luxury Towers' },
  { url: 'https://picsum.photos/seed/supercar7/600/400',  label: 'Supercars' },
  { url: 'https://picsum.photos/seed/marina8/600/400',    label: 'Marina Lights' },
  { url: 'https://picsum.photos/seed/golden9/600/400',    label: 'Golden Hour' },
  { url: 'https://picsum.photos/seed/resort10/600/400',   label: 'Luxury Resort' },
];

const features = [
  { icon: <FaRobot size={36} />,    title: 'Groq AI Assistant',       desc: 'GPT-OSS 20B for blazing-fast real estate answers' },
  { icon: <FaImage size={36} />,    title: 'Vision Analysis',         desc: 'Llama 4 Scout analyses property images instantly' },
  { icon: <FaMicrophone size={36}/>, title: 'Voice Powered',          desc: 'Speak your query, hear the response aloud' },
  { icon: <FaBolt size={36} />,     title: 'Real-time Streaming',     desc: 'Token-by-token SSE streaming — no waiting' },
  { icon: <FaChartLine size={36}/>, title: 'Market Insights',         desc: 'Live Abu Dhabi rental & sales data' },
  { icon: <FaGlobe size={36} />,    title: 'Live Listings',           desc: 'PropertyFinder.ae scraper via MCP server' },
  { icon: <FaBuilding size={36}/>,  title: 'High-Rise Experts',       desc: 'Corniche, Al Reem, Yas, Saadiyat coverage' },
  { icon: <FaCar size={36} />,      title: 'Lifestyle Intelligence',  desc: 'Schools, malls, beaches & leisure insights' },
];

function LandingPage() {
  const navigate = useNavigate();
  const trackRef = useRef(null);

  // Duplicate gallery for seamless infinite scroll
  const items = [...GALLERY, ...GALLERY];

  return (
    <div className="lp">

      {/* ── HERO ── */}
      <section className="lp-hero">
        <div className="lp-hero-bg" />
        <div className="lp-particles">{Array.from({length: 60}).map((_,i) => <span key={i} className="lp-particle" style={{'--i': i}} />)}</div>
        <div className="lp-city-silhouette" />

        <div className="lp-hero-inner">
          <div className="lp-hero-text">
            <div className="lp-badge">
              <span className="lp-pulse" />
              Live Market Data &nbsp;·&nbsp; Groq AI &nbsp;·&nbsp; Voice Ready
            </div>

            <h1 className="lp-h1">
              Find Your Dream<br />
              <span className="lp-gold">Abu Dhabi</span> Property
            </h1>

            <p className="lp-sub">
              AI-powered real estate assistant for Abu Dhabi's finest towers,
              waterfront residences, and luxury communities — powered by Groq.
            </p>

            <div className="lp-btns">
              <button className="lp-btn-primary" onClick={() => navigate('/chat')}>
                Launch AI Assistant <span>→</span>
              </button>
              <button className="lp-btn-ghost" onClick={() => document.getElementById('gallery').scrollIntoView({behavior:'smooth'})}>
                Explore Abu Dhabi
              </button>
            </div>

            <div className="lp-stats">
              {[['3', 'AI Models'], ['<1s', 'Response'], ['Live', 'Listings'], ['100%', 'Free']].map(([v,l]) => (
                <div key={l} className="lp-stat">
                  <span className="lp-stat-val">{v}</span>
                  <span className="lp-stat-lbl">{l}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right side floating property cards */}
          <div className="lp-hero-cards">
            {[
              { img: 'https://picsum.photos/seed/reem/300/200',     name: 'Al Reem Island',       price: 'AED 85k/yr',  tag: '🏙️ High-Rise' },
              { img: 'https://picsum.photos/seed/corniche/300/200', name: 'Corniche Residences',  price: 'AED 120k/yr', tag: '🌊 Sea View' },
              { img: 'https://picsum.photos/seed/yas/300/200',      name: 'Yas Island Villa',     price: 'AED 200k/yr', tag: '🏎️ Ferrari World' },
            ].map((c, i) => (
              <div key={i} className="lp-prop-card" style={{'--ci': i}}>
                <img src={c.img} alt={c.name} />
                <div className="lp-prop-info">
                  <span className="lp-prop-tag">{c.tag}</span>
                  <div className="lp-prop-name">{c.name}</div>
                  <div className="lp-prop-price">{c.price}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SCROLLING GALLERY ── */}
      <section id="gallery" className="lp-gallery-section">
        <h2 className="lp-section-title">Experience <span className="lp-gold">Abu Dhabi</span></h2>
        <p className="lp-section-sub">From gleaming towers to golden sunsets — discover the city you'll call home</p>
        <div className="lp-marquee-wrap">
          <div className="lp-marquee-track" ref={trackRef}>
            {items.map((item, i) => (
              <div key={i} className="lp-marquee-card">
                <img src={item.url} alt={item.label} loading="lazy" />
                <div className="lp-marquee-label">{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="lp-features">
        <h2 className="lp-section-title dark">Intelligent Features</h2>
        <p className="lp-section-sub dark">Everything you need to find the perfect Abu Dhabi property</p>
        <div className="lp-feat-grid">
          {features.map((f, i) => (
            <div key={i} className="lp-feat-card" style={{'--fi': i}}>
              <div className="lp-feat-icon">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── LANDMARKS STRIP ── */}
      <section className="lp-landmarks">
        <div className="lp-landmarks-bg" />
        <div className="lp-landmarks-inner">
          <h2>Abu Dhabi's Finest Locations</h2>
          <div className="lp-loc-grid">
            {[
              { emoji: '🕌', name: 'Sheikh Zayed Mosque', area: 'Al Mushrif' },
              { emoji: '🏎️', name: 'Ferrari World',       area: 'Yas Island' },
              { emoji: '🌊', name: 'The Corniche',        area: 'Downtown' },
              { emoji: '🏝️', name: 'Saadiyat Island',    area: 'Cultural District' },
              { emoji: '🏙️', name: 'Al Reem Island',     area: 'New District' },
              { emoji: '🎡', name: 'Warner Bros. World',  area: 'Yas Island' },
            ].map((loc, i) => (
              <div key={i} className="lp-loc-card">
                <div className="lp-loc-emoji">{loc.emoji}</div>
                <div className="lp-loc-name">{loc.name}</div>
                <div className="lp-loc-area">{loc.area}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="lp-cta">
        <div className="lp-cta-bg" />
        <div className="lp-cta-content">
          <h2>Ready to find your <span className="lp-gold">perfect home</span>?</h2>
          <p>Chat with our AI — ask about prices, neighbourhoods, schools, and more.</p>
          <button className="lp-btn-primary lp-btn-xl" onClick={() => navigate('/chat')}>
            Start Chatting Now &nbsp;🏠
          </button>
        </div>
      </section>

      <footer className="lp-footer">
        <p>Abu Dhabi Real Estate AI · Powered by Groq · React · FastAPI</p>
      </footer>
    </div>
  );
}

export default LandingPage;
