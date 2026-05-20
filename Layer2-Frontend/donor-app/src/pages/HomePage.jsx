import { useNavigate } from 'react-router-dom'
import logoUrl from '../assets/outbackshare-logo.png'
import heroBg from '../assets/Gemini_Generated_Image_tfnod8tfnod8tfno.png'
import LanguageSwitcher from '../components/LanguageSwitcher'

const HANDS_IMG = 'https://lh3.googleusercontent.com/aida-public/AB6AXuAMbSo66B4rcKCRGaTmb9NoE7PGidXGrFIDvxlABrMqnZHcVI1IwywSTeVtEwUEKWcvHfpgMJj8u34yw3PEZ38F0ef7aNt7SZZdXjHR5BNxSXRuYXAFyWeP9SixfAxbyn-YqmigCW_N57bli4qIiiBFT-ccODojYI7zTrmVGNSpALIcFPuk8KCj_db7qc0WoVPhojzKhUXytxwQbl6zlkglJVnhHSU2mxOXp269CDAQcfYMKakO1Mvk1EJBzqKXgLjp_JKhebZXbuI'

export default function HomePage() {
  const navigate = useNavigate()

  return (
    <div className="bg-background text-on-background overflow-x-hidden" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <style>{`
        .paper-shadow { box-shadow: 0 4px 24px rgba(61,64,91,0.08); }
        .paper-shadow-hover { transition: transform 0.2s ease, box-shadow 0.2s ease; }
        .paper-shadow-hover:hover { transform: translateY(-5px); box-shadow: 0 16px 48px rgba(61,64,91,0.14); }
        .paper-texture { background-image: url(https://lh3.googleusercontent.com/aida-public/AB6AXuC6I3itRtJZUwoWD1-CkMoT7VDhiWMUBZOhDockJr0KWoqLTkRiGyZaMZzc06IsNuaZFm40PGGH1kFG_qqkJZkQApoHVGkqPePQ3kFf5rNKw2r-3-i0w-oRvGpeASib8UN5yCLhckd2Sj_ZlLF56jml51AxpXCGSgKIe28orzscw8yPvvYXCZX4J6psPBBLpv8HGRHfWd9U2is-uTCiXg1YApo8jhHX1q8cKDnnCjAJnSMBo6E6FXm_wt4kNr-gGopqqhoYU78rxCY); }
        .organic-blob { border-radius: 40% 60% 70% 30%/40% 50% 60% 50%; }
        @keyframes bounce-subtle { 0%,100%{transform:translateY(0)} 50%{transform:translateY(12px)} }
        .scroll-indicator { animation: bounce-subtle 2s infinite; }
        .journey-line { background-image: radial-gradient(circle,#bfc9c1 1px,transparent 1px); background-size: 28px 28px; }
        .hero-btn-primary {
          background: #9a442d; color: #fff; border: none; cursor: pointer;
          display: flex; align-items: center; gap: 10px; font-weight: 700;
          border-radius: 16px; transition: filter 0.15s ease, transform 0.15s ease;
          font-size: 17px; padding: 18px 40px; letter-spacing: -0.01em;
        }
        .hero-btn-primary:hover { filter: brightness(1.1); transform: translateY(-2px); }
        .hero-btn-ghost {
          background: rgba(255,255,255,0.12); color: #fff;
          border: 1.5px solid rgba(255,255,255,0.4); cursor: pointer; font-weight: 600;
          border-radius: 16px; backdrop-filter: blur(10px);
          transition: background 0.15s ease; font-size: 17px; padding: 18px 40px;
        }
        .hero-btn-ghost:hover { background: rgba(255,255,255,0.22); }
      `}</style>

      <main>

        {/* Hero */}
        <section className="relative h-screen flex items-center overflow-hidden">

          {/* Background image */}
          <div className="absolute inset-0 z-0">
            <img
              alt="Community food cooperative"
              src={heroBg}
              className="w-full h-full object-cover object-center"
            />
            {/* Left-side darkening for text legibility */}
            <div
              className="absolute inset-0"
              style={{ background: 'linear-gradient(to right, rgba(8,24,16,0.80) 0%, rgba(8,24,16,0.55) 42%, rgba(8,24,16,0.10) 75%, transparent 100%)' }}
            />
            {/* Bottom fade into page background */}
            <div
              className="absolute inset-0"
              style={{ background: 'linear-gradient(to top, #f9f9f6 0%, rgba(249,249,246,0.12) 22%, transparent 50%)' }}
            />
          </div>

          {/* Logo — floats at top of hero, no header bar */}
          <div
            className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-10 md:px-16"
            style={{ height: '88px' }}
          >
            <img
              src={logoUrl}
              alt="OutBackShare"
              style={{ height: '52px', width: 'auto', filter: 'brightness(0) invert(1)', opacity: 0.95 }}
            />
            <LanguageSwitcher dark />
          </div>

          {/* Hero content */}
          <div className="relative z-10 w-full px-10 md:px-16" style={{ maxWidth: '1280px', margin: '0 auto' }}>
            <div style={{ maxWidth: '720px' }}>
              <span
                style={{
                  display: 'inline-block', marginBottom: '28px', fontWeight: 700,
                  fontSize: '13px', letterSpacing: '0.18em', textTransform: 'uppercase',
                  background: 'rgba(255,255,255,0.13)', backdropFilter: 'blur(8px)',
                  color: '#b1f0ce', border: '1px solid rgba(177,240,206,0.3)',
                  padding: '8px 20px', borderRadius: '999px'
                }}
              >
                Victoria's Food Stewardship
              </span>

              <h1
                style={{
                  fontWeight: 900, color: '#fff', marginBottom: '28px',
                  fontSize: 'clamp(56px, 8vw, 96px)',
                  lineHeight: 1.05, letterSpacing: '-0.04em',
                  textShadow: '0 2px 24px rgba(0,0,0,0.25)'
                }}
              >
                Where{' '}
                <span style={{ color: '#95d4b3', fontStyle: 'italic' }}>excess</span>
                {' '}becomes
                <br />
                <span style={{ color: '#ffb4a1', fontStyle: 'italic' }}>enough</span>.
              </h1>

              <p
                style={{
                  color: 'rgba(255,255,255,0.88)', marginBottom: '44px',
                  fontSize: 'clamp(18px, 2.4vw, 24px)', maxWidth: '540px',
                  lineHeight: 1.65, textShadow: '0 1px 8px rgba(0,0,0,0.2)'
                }}
              >
                We bridge the gap between Victoria's surplus food and the communities that need it most.
                Join our local network and help build a resilient food system today.
              </p>

              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                <button className="hero-btn-primary" onClick={() => navigate('/register/donor')}>
                  Start Donating
                  <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>arrow_forward</span>
                </button>
                <button className="hero-btn-ghost" onClick={() => navigate('/register/org')}>
                  Find Food Support
                </button>
              </div>
            </div>
          </div>

          {/* Scroll indicator */}
          <button
            className="scroll-indicator absolute left-1/2 z-10 flex flex-col items-center"
            onClick={() => document.getElementById('pathfinding').scrollIntoView({ behavior: 'smooth' })}
            style={{ bottom: '36px', transform: 'translateX(-50%)', gap: '4px', color: 'rgba(255,255,255,0.5)', background: 'none', border: 'none', cursor: 'pointer', padding: '8px 16px', borderRadius: '999px', transition: 'color 0.2s' }}
            onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.85)'}
            onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.5)'}
            aria-label="Scroll to next section"
          >
            <span style={{ fontSize: '12px', fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase' }}>Discover</span>
            <span className="material-symbols-outlined" style={{ fontSize: '36px' }}>keyboard_arrow_down</span>
          </button>
        </section>

        {/* Pathfinding */}
        <section id="pathfinding" className="paper-texture" style={{ padding: '104px 0', background: '#f4f4f1' }}>
          <div className="mx-auto px-10 md:px-16" style={{ maxWidth: '1280px' }}>
            <div
              className="bg-white flex flex-col lg:flex-row items-center relative overflow-hidden"
              style={{ gap: '72px', borderRadius: '2.5rem', padding: '72px', boxShadow: '0 20px 60px rgba(61,64,91,0.10)' }}
            >
              <div className="absolute top-0 right-0 w-80 h-80 bg-green-50 organic-blob -translate-y-1/2 translate-x-1/3 opacity-50" />

              <div className="lg:w-1/2 relative z-10">
                <span style={{ display: 'block', fontWeight: 700, fontSize: '12px', letterSpacing: '0.22em', textTransform: 'uppercase', color: '#9a442d', marginBottom: '16px' }}>
                  Join the Circle
                </span>
                <h2 style={{ fontWeight: 800, fontSize: 'clamp(30px, 3.8vw, 48px)', letterSpacing: '-0.025em', lineHeight: 1.12, color: '#1a1c1b', marginBottom: '24px' }}>
                  Choose your path today
                </h2>
                <p style={{ fontSize: '19px', color: '#5a6360', lineHeight: 1.70, maxWidth: '440px', marginBottom: '40px' }}>
                  Whether you're a local bakery with surplus bread or a community hub serving families,
                  your contribution matters. Select your workspace to begin your impact journey.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {[
                    { icon: 'volunteer_activism', color: '#9a442d', bg: 'rgba(154,68,45,0.08)', title: 'I want to donate food', sub: 'Post excess listings for local groups', path: '/register/donor' },
                    { icon: 'apartment', color: '#0f5238', bg: 'rgba(15,82,56,0.08)', title: 'I manage an organisation', sub: 'Coordinate collection and distribution', path: '/register/org' },
                  ].map(item => (
                    <div
                      key={item.path}
                      className="paper-shadow-hover"
                      onClick={() => navigate(item.path)}
                      role="button" tabIndex={0}
                      onKeyDown={e => e.key === 'Enter' && navigate(item.path)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '20px', cursor: 'pointer',
                        padding: '22px 26px', background: '#f9f9f6', borderRadius: '18px',
                        border: '1px solid #e2e3e0'
                      }}
                    >
                      <div style={{ width: '60px', height: '60px', borderRadius: '9999px', background: item.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '28px', color: item.color }}>{item.icon}</span>
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: '17px', fontWeight: 700, color: '#1a1c1b', marginBottom: '3px' }}>{item.title}</p>
                        <p style={{ fontSize: '15px', color: '#6b7280' }}>{item.sub}</p>
                      </div>
                      <span className="material-symbols-outlined" style={{ fontSize: '24px', color: '#d1d5db' }}>chevron_right</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="lg:w-1/2 relative">
                <div
                  style={{ borderRadius: '2rem', overflow: 'hidden', boxShadow: '0 24px 60px rgba(61,64,91,0.18)', transform: 'rotate(2deg)', transition: 'transform 0.5s ease' }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'rotate(0deg)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'rotate(2deg)'}
                >
                  <img alt="Hands exchanging food" src={HANDS_IMG} style={{ width: '100%', height: '500px', objectFit: 'cover' }} />
                </div>
                <div className="organic-blob absolute" style={{ width: '128px', height: '128px', bottom: '-24px', left: '-24px', background: 'rgba(154,68,45,0.10)', zIndex: -1 }} />
              </div>
            </div>
          </div>
        </section>

        {/* Sharing Journey */}
        <section className="relative overflow-hidden" style={{ padding: '104px 0', background: '#ffffff' }}>
          <div className="absolute inset-0 journey-line opacity-20" />
          <div className="relative z-10 mx-auto px-10 md:px-16" style={{ maxWidth: '1280px' }}>
            <div className="text-center" style={{ marginBottom: '88px' }}>
              <h2 style={{ fontWeight: 800, fontSize: 'clamp(30px, 3.8vw, 48px)', letterSpacing: '-0.025em', color: '#1a1c1b', marginBottom: '16px' }}>
                The Sharing Journey
              </h2>
              <p style={{ fontSize: '19px', color: '#6b7280', maxWidth: '520px', margin: '0 auto', lineHeight: 1.65 }}>
                Connecting donors and organizations through a simple, high-impact loop.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: '64px', position: 'relative' }}>
              <div className="hidden md:block absolute h-px" style={{ top: '56px', left: '25%', right: '25%', background: 'linear-gradient(to right, rgba(154,68,45,0.3), rgba(15,82,56,0.3), rgba(66,69,97,0.3))' }} />

              {[
                { num: '01', icon: 'upload_file', color: '#9a442d', title: 'Post Surplus', desc: 'Donors list excess food in seconds via our streamlined mobile dashboard.' },
                { num: '02', icon: 'task_alt', color: '#0f5238', title: 'Claim & Alert', desc: 'Local charities receive real-time alerts and claim listings that match their needs.' },
                { num: '03', icon: 'volunteer_activism', color: '#424561', title: 'Direct Impact', desc: 'High-quality food is delivered directly to families across Victoria.' },
              ].map(step => (
                <div key={step.num} className="flex flex-col items-center text-center" style={{ position: 'relative', zIndex: 10 }}>
                  <div
                    className="paper-shadow"
                    style={{
                      width: '108px', height: '108px', borderRadius: '9999px', background: '#fff',
                      border: '2px solid #e2e3e0', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', marginBottom: '28px',
                      transition: 'border-color 0.2s, transform 0.2s'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = step.color; e.currentTarget.style.transform = 'scale(1.08)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e3e0'; e.currentTarget.style.transform = 'scale(1)' }}
                  >
                    <span style={{ fontSize: '18px', fontWeight: 900, color: step.color, opacity: 0.22, marginRight: '2px' }}>{step.num}</span>
                    <span className="material-symbols-outlined" style={{ fontSize: '42px', color: step.color }}>{step.icon}</span>
                  </div>
                  <h3 style={{ fontWeight: 700, fontSize: '24px', color: '#1a1c1b', marginBottom: '12px' }}>{step.title}</h3>
                  <p style={{ fontSize: '17px', color: '#6b7280', lineHeight: 1.65 }}>{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Our Vision (Impact Metrics) */}
        <section className="paper-texture" style={{ padding: '104px 0', background: '#eeeeeb' }}>
          <div className="mx-auto px-10 md:px-16" style={{ maxWidth: '1280px' }}>
            <div className="text-center" style={{ marginBottom: '88px' }}>
              <h2 style={{ fontWeight: 800, fontSize: 'clamp(30px, 3.8vw, 48px)', letterSpacing: '-0.025em', color: '#1a1c1b', marginBottom: '16px' }}>
                Our Vision
              </h2>
              <p style={{ fontSize: '19px', color: '#6b7280', maxWidth: '520px', margin: '0 auto', lineHeight: 1.65 }}>
                The future we're building together for Victoria's communities.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: '24px' }}>
              {/* Meals Saved */}
              <div
                className="bg-white paper-shadow paper-shadow-hover relative overflow-hidden"
                style={{ padding: '52px 44px', borderRadius: '32px', border: '1px solid #e2e3e0' }}
              >
                <div className="organic-blob absolute" style={{ width: '180px', height: '180px', right: '-32px', bottom: '-32px', background: 'rgba(15,82,56,0.05)', transition: 'transform 0.3s' }} />
                <div style={{ position: 'relative', zIndex: 1 }}>
                  <div style={{ width: '64px', height: '64px', borderRadius: '18px', background: 'rgba(15,82,56,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '32px', color: '#0f5238' }}>restaurant</span>
                  </div>
                  <p style={{ fontSize: '14px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9ca3af', marginBottom: '8px' }}>Meals Saved</p>
                  <p style={{ fontSize: 'clamp(60px, 7vw, 88px)', fontWeight: 900, lineHeight: 1, color: '#1a1c1b', letterSpacing: '-0.04em', marginBottom: '20px' }}>1.2M+</p>
                  <p style={{ fontSize: '16px', color: '#6b7280', lineHeight: 1.65 }}>Diverted from Victorian landfills and shared with the community.</p>
                </div>
              </div>

              {/* CO2 Reduced */}
              <div
                className="bg-white paper-shadow paper-shadow-hover relative overflow-hidden"
                style={{ padding: '52px 44px', borderRadius: '32px', border: '1px solid #e2e3e0' }}
              >
                <div className="organic-blob absolute" style={{ width: '180px', height: '180px', right: '-32px', bottom: '-32px', background: 'rgba(154,68,45,0.05)', transition: 'transform 0.3s' }} />
                <div style={{ position: 'relative', zIndex: 1 }}>
                  <div style={{ width: '64px', height: '64px', borderRadius: '18px', background: 'rgba(154,68,45,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '32px', color: '#9a442d' }}>eco</span>
                  </div>
                  <p style={{ fontSize: '14px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9ca3af', marginBottom: '8px' }}>CO2 Reduced</p>
                  <p style={{ lineHeight: 1, marginBottom: '20px' }}>
                    <span style={{ fontSize: 'clamp(60px, 7vw, 88px)', fontWeight: 900, color: '#1a1c1b', letterSpacing: '-0.04em' }}>340</span>
                    <span style={{ fontSize: '32px', fontWeight: 600, color: '#9ca3af', marginLeft: '6px' }}>t</span>
                  </p>
                  <p style={{ fontSize: '16px', color: '#6b7280', lineHeight: 1.65 }}>Mitigating the environmental impact through conscious redistribution.</p>
                </div>
              </div>

              {/* Towns Reached */}
              <div
                className="paper-shadow-hover relative overflow-hidden"
                style={{ padding: '52px 44px', borderRadius: '32px', background: '#0f5238' }}
              >
                <div className="organic-blob absolute" style={{ width: '180px', height: '180px', right: '-32px', bottom: '-32px', background: 'rgba(255,255,255,0.08)', transition: 'transform 0.3s' }} />
                <div style={{ position: 'relative', zIndex: 1 }}>
                  <div style={{ width: '64px', height: '64px', borderRadius: '18px', background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px', backdropFilter: 'blur(8px)' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '32px', color: '#fff' }}>groups</span>
                  </div>
                  <p style={{ fontSize: '14px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(177,240,206,0.7)', marginBottom: '8px' }}>Towns Reached</p>
                  <p style={{ fontSize: 'clamp(60px, 7vw, 88px)', fontWeight: 900, lineHeight: 1, color: '#fff', letterSpacing: '-0.04em', marginBottom: '20px' }}>84+</p>
                  <p style={{ fontSize: '16px', color: 'rgba(177,240,206,0.75)', lineHeight: 1.65 }}>Regional hubs and urban suburbs actively participating across Victoria.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer style={{ background: '#2D3047', color: '#fff', paddingTop: '88px', paddingBottom: '44px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="mx-auto px-10 md:px-16" style={{ maxWidth: '1280px' }}>
          <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5" style={{ gap: '56px', marginBottom: '64px' }}>
            <div className="lg:col-span-2">
              <img src={logoUrl} alt="OutBackShare" style={{ height: '36px', width: 'auto', marginBottom: '20px', filter: 'brightness(0) invert(1)', opacity: 0.9 }} />
              <p style={{ fontSize: '15px', color: 'rgba(255,255,255,0.48)', maxWidth: '280px', lineHeight: 1.75, marginBottom: '24px' }}>
                A community-driven platform for Victoria, ensuring no local surplus goes to waste while our neighbors go hungry.
              </p>
              <div style={{ display: 'flex', gap: '12px' }}>
                {['public', 'alternate_email'].map(icon => (
                  <a key={icon} href="#" style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', color: '#fff', transition: 'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>{icon}</span>
                  </a>
                ))}
              </div>
            </div>

            {[
              { head: 'Platform', links: ['About Us', 'How it Works', 'Safety & Quality'] },
              { head: 'Network', links: ['Success Stories', 'Partner Hubs', 'Volunteer'] },
              { head: 'Legal', links: ['Privacy Policy', 'Terms of Use', 'FAQ'] },
            ].map(col => (
              <div key={col.head}>
                <h5 style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.38)', marginBottom: '20px' }}>{col.head}</h5>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {col.links.map(l => (
                    <li key={l}>
                      <a href="#" style={{ fontSize: '15px', color: 'rgba(255,255,255,0.55)', textDecoration: 'none', transition: 'color 0.15s' }}
                        onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                        onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.55)'}
                      >{l}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: '28px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
            <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.32)' }}>
              &copy; 2024 OutBackShare Victoria. Built with care for our community.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#9a442d' }}>favorite</span>
              <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.32)' }}>Supporting local families.</p>
            </div>
          </div>
        </div>
      </footer>

      {/* Mobile bottom nav */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 w-full z-50 flex justify-around items-center"
        style={{ padding: '14px 16px 18px', background: 'rgba(249,249,246,0.97)', backdropFilter: 'blur(12px)', borderTop: '1px solid #e2e3e0', boxShadow: '0 -4px 20px rgba(61,64,91,0.07)' }}
      >
        {[
          { icon: 'home', label: 'Home', path: '/', fill: true, active: true },
          { icon: 'travel_explore', label: 'Insights', path: '/org/intelligence', fill: false, active: false },
          { icon: 'notifications', label: 'Alerts', path: '/org/alerts', fill: false, active: false },
          { icon: 'person', label: 'Profile', path: '/register', fill: false, active: false },
        ].map(item => (
          <button
            key={item.label}
            onClick={() => navigate(item.path)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: item.active ? '#0f5238' : '#9ca3af',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px'
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: '28px', fontVariationSettings: item.active && item.fill ? "'FILL' 1" : "'FILL' 0" }}
            >
              {item.icon}
            </span>
            <span style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.02em' }}>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
