'use client'
import { supabase } from './lib/supabase'
import { useEffect, useRef, useState } from 'react'

export default function Home() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [count, setCount] = useState(247)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })

  useEffect(() => {
    const handleMouse = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY })
    }
    window.addEventListener('mousemove', handleMouse, { passive: true })
    return () => window.removeEventListener('mousemove', handleMouse)
  }, [])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible')
          }
        })
      },
      { threshold: 0.1, rootMargin: '0px 0px -60px 0px' }
    )
    document.querySelectorAll('.reveal').forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return
    try {
      const { error } = await supabase
        .from('waitlist')
        .insert([{ email }])
      if (error && error.code !== '23505') {
        alert('Something went wrong. Please try again.')
        return
      }
      setSubmitted(true)
      setCount(c => c + 1)
    } catch (err) {
      console.error(err)
    }
  }

  const features = [
    { icon: '⌕', title: 'Search by creator', desc: 'Find every brand Ali Abdaal, MKBHD, or any creator has ever promoted — all indexed automatically.', color: '#6366F1' },
    { icon: '◷', title: 'Sponsorship timeline', desc: 'See how long a creator has backed a brand. Recurring deals over years signal genuine trust.', color: '#10B981' },
    { icon: '⌗', title: 'Active promo codes', desc: 'Every code, verified and updated. Copy in one click. Never dig through a description again.', color: '#F59E0B' },
    { icon: '▶', title: 'YouTube indexed', desc: 'Hundreds of thousands of sponsorships pulled from videos, descriptions and transcripts.', color: '#EF4444' },
    { icon: '◎', title: 'Podcasts too', desc: 'Every podcast sponsorship indexed. Finance, tech, health, true crime — all covered automatically.', color: '#8B5CF6' },
    { icon: '◈', title: 'Creator memory', desc: 'That product you half-remember from 6 months ago? We know exactly which video it was in.', color: '#14B8A6' },
  ]

  const steps = [
    { n: '01', title: 'Search what you remember', desc: 'Type the creator, brand, or anything you half-remember. "VPN Linus" or "mattress podcast" — we find it.' },
    { n: '02', title: 'See the full picture', desc: 'Every creator who promoted that brand, how long they\'ve been doing it, and whether they still do.' },
    { n: '03', title: 'Grab the code and go', desc: 'Copy the active promo code in one click. Verified, current, ready to use.' },
  ]

  const platforms = ['YouTube', 'Podcasts', 'TikTok', 'Instagram', 'Twitch']

  return (
    <>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        html{scroll-behavior:smooth}
        body{background:#060810;color:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;overflow-x:hidden}
        .reveal{opacity:0;transform:translateY(32px);transition:opacity .7s cubic-bezier(.16,1,.3,1),transform .7s cubic-bezier(.16,1,.3,1)}
        .reveal.visible{opacity:1;transform:translateY(0)}
        .reveal-delay-1{transition-delay:.1s}
        .reveal-delay-2{transition-delay:.2s}
        .reveal-delay-3{transition-delay:.3s}
        .reveal-delay-4{transition-delay:.4s}
        .reveal-delay-5{transition-delay:.5s}
        @keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(.8)}}
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
        @keyframes shimmer{0%{background-position:200% center}100%{background-position:-200% center}}
        .shimmer-text{background:linear-gradient(90deg,#fff 0%,#818CF8 25%,#fff 50%,#818CF8 75%,#fff 100%);background-size:200% auto;-webkit-background-clip:text;-webkit-text-fill-color:transparent;animation:shimmer 6s linear infinite}
        input::placeholder{color:rgba(255,255,255,.25)}
        input:focus{outline:none}
        button:hover{opacity:.9;transform:scale(.99)}
        button:active{transform:scale(.97)}
        button{transition:all .15s}
        .feat-card{transition:border-color .25s,transform .25s}
        .feat-card:hover{border-color:rgba(99,102,241,.35)!important;transform:translateY(-2px)}
        .step-card{transition:border-color .25s}
        .step-card:hover{border-color:rgba(99,102,241,.25)!important}
        .plat-pill{transition:all .2s}
        .plat-pill:hover{background:rgba(255,255,255,.08)!important;border-color:rgba(255,255,255,.15)!important;color:rgba(255,255,255,.8)!important}
      `}</style>

      {/* Mouse glow */}
      <div style={{
        position: 'fixed', top: 0, left: 0, pointerEvents: 'none', zIndex: 0,
        width: 500, height: 500, borderRadius: '50%',
        background: 'radial-gradient(circle,rgba(99,102,241,.08) 0%,transparent 70%)',
        transform: `translate(${mousePos.x - 250}px,${mousePos.y - 250}px)`,
        transition: 'transform .12s ease-out',
      }} />

      {/* Nav */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '18px 32px',
        background: 'rgba(6,8,16,.8)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,.05)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: 'linear-gradient(135deg,#6366F1,#8B5CF6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
          }}>✦</div>
          <span style={{ fontWeight: 600, fontSize: 15, letterSpacing: '-.02em' }}>that's the one</span>
        </div>
        <div style={{
          fontSize: 12, padding: '7px 16px', borderRadius: 20,
          background: 'rgba(99,102,241,.12)', color: '#818CF8',
          border: '1px solid rgba(99,102,241,.25)',
        }}>Early access</div>
      </nav>

      {/* Hero */}
      <section style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        textAlign: 'center', padding: '120px 24px 80px',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Grid */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 0,
          backgroundImage: 'linear-gradient(rgba(99,102,241,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(99,102,241,.04) 1px,transparent 1px)',
          backgroundSize: '64px 64px',
          maskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%,black 20%,transparent 100%)',
        }} />
        {/* Center glow */}
        <div style={{
          position: 'absolute', width: 800, height: 800, borderRadius: '50%',
          background: 'radial-gradient(circle,rgba(99,102,241,.1) 0%,transparent 65%)',
          top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 0,
        }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          {/* Eyebrow */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            fontSize: 11, color: 'rgba(255,255,255,.45)',
            background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)',
            borderRadius: 20, padding: '5px 14px', marginBottom: 28,
            letterSpacing: '.06em', textTransform: 'uppercase',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#6366F1', display: 'inline-block', animation: 'pulse 2s infinite' }} />
            Early access · Opening soon
          </div>

          <h1 style={{ fontSize: 'clamp(36px,6vw,68px)', fontWeight: 700, letterSpacing: '-.035em', lineHeight: 1.08, marginBottom: 22, maxWidth: 760 }}>
            <span className="shimmer-text">The search engine<br />for creator deals</span>
          </h1>

          <p style={{ fontSize: 'clamp(15px,2vw,18px)', color: 'rgba(255,255,255,.4)', lineHeight: 1.75, maxWidth: 480, margin: '0 auto 44px' }}>
            You heard about it from a creator.<br />
            Now find it, remember it, and grab the code — all in one place.
          </p>

          {/* Email form */}
          {!submitted ? (
            <form onSubmit={handleSubmit} style={{ maxWidth: 440, margin: '0 auto 14px' }}>
              <div style={{
                display: 'flex', gap: 8,
                background: 'rgba(255,255,255,.05)',
                border: '1px solid rgba(255,255,255,.1)',
                borderRadius: 14, padding: '5px 5px 5px 18px',
              }}>
                <input
                  type="email" required value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="Enter your email for early access"
                  style={{ flex: 1, background: 'none', border: 'none', fontSize: 14, color: '#fff', padding: '9px 0' }}
                />
                <button type="submit" style={{
                  background: 'linear-gradient(135deg,#6366F1,#8B5CF6)',
                  color: '#fff', border: 'none', borderRadius: 10,
                  padding: '10px 22px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}>
                  Get early access
                </button>
              </div>
            </form>
          ) : (
            <div style={{
              maxWidth: 440, margin: '0 auto 14px',
              background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.25)',
              borderRadius: 14, padding: '18px 24px',
              color: '#34D399', fontSize: 14, fontWeight: 500,
            }}>
              ✓ You're on the list — we'll be in touch soon
            </div>
          )}
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,.18)' }}>
            Join {count.toLocaleString()} people on the waitlist · No spam, ever
          </p>

          {/* Platform pills */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginTop: 40 }}>
            {platforms.map(p => (
              <div key={p} className="plat-pill" style={{
                fontSize: 12, padding: '6px 14px', borderRadius: 20,
                background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.07)',
                color: 'rgba(255,255,255,.4)', cursor: 'default',
              }}>{p}</div>
            ))}
          </div>
        </div>
      </section>

      {/* Problem statement */}
      <section style={{ padding: '80px 24px', textAlign: 'center', position: 'relative', zIndex: 1 }}>
        <div className="reveal" style={{ maxWidth: 640, margin: '0 auto' }}>
          <p style={{ fontSize: 11, color: 'rgba(99,102,241,.8)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 16 }}>The problem</p>
          <h2 style={{ fontSize: 'clamp(28px,4vw,42px)', fontWeight: 700, letterSpacing: '-.025em', lineHeight: 1.2, marginBottom: 20 }}>
            Creator deals are <span style={{ color: 'rgba(255,255,255,.25)', textDecoration: 'line-through' }}>ephemeral</span><br />
            <span style={{ color: '#818CF8' }}>We make them permanent</span>
          </h2>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,.35)', lineHeight: 1.75 }}>
            A creator mentions a product. You're not ready to buy. Six months later you can't remember which video, which creator, or what the discount code was. That moment of discovery — lost forever.<br /><br />
            Until now.
          </p>
        </div>
      </section>

      {/* Features */}
      <section style={{ padding: '60px 24px 80px', maxWidth: 960, margin: '0 auto', position: 'relative', zIndex: 1 }}>
        <div className="reveal" style={{ textAlign: 'center', marginBottom: 48 }}>
          <p style={{ fontSize: 11, color: 'rgba(99,102,241,.8)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 16 }}>Features</p>
          <h2 style={{ fontSize: 'clamp(28px,4vw,40px)', fontWeight: 700, letterSpacing: '-.025em', lineHeight: 1.2 }}>
            Everything about a sponsorship.<br />All in one search.
          </h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 12 }}>
          {features.map((f, i) => (
            <div key={f.title} className={`reveal feat-card reveal-delay-${i + 1}`} style={{
              background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.06)',
              borderRadius: 16, padding: '24px',
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 11,
                background: f.color + '18',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, color: f.color, marginBottom: 16,
              }}>{f.icon}</div>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{f.title}</h3>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,.35)', lineHeight: 1.65 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section style={{ padding: '60px 24px 80px', maxWidth: 680, margin: '0 auto', position: 'relative', zIndex: 1 }}>
        <div className="reveal" style={{ textAlign: 'center', marginBottom: 48 }}>
          <p style={{ fontSize: 11, color: 'rgba(99,102,241,.8)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 16 }}>How it works</p>
          <h2 style={{ fontSize: 'clamp(28px,4vw,40px)', fontWeight: 700, letterSpacing: '-.025em' }}>Three steps to that deal</h2>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {steps.map((s, i) => (
            <div key={s.n} className={`reveal step-card reveal-delay-${i + 1}`} style={{
              display: 'flex', gap: 20, padding: '24px',
              background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.06)',
              borderRadius: 16,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                background: 'rgba(99,102,241,.12)', border: '1px solid rgba(99,102,241,.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700, color: '#818CF8', marginTop: 2,
              }}>{s.n}</div>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>{s.title}</h3>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,.35)', lineHeight: 1.65 }}>{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="reveal" style={{ padding: '60px 24px 100px', position: 'relative', zIndex: 1 }}>
        <div style={{
          maxWidth: 560, margin: '0 auto', textAlign: 'center',
          background: 'rgba(99,102,241,.06)', border: '1px solid rgba(99,102,241,.15)',
          borderRadius: 24, padding: '56px 32px',
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', width: 400, height: 400, borderRadius: '50%',
            background: 'radial-gradient(circle,rgba(99,102,241,.12) 0%,transparent 70%)',
            top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 0,
          }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <h2 style={{ fontSize: 'clamp(24px,4vw,36px)', fontWeight: 700, letterSpacing: '-.025em', marginBottom: 12 }}>
              Be first to know
            </h2>
            <p style={{ fontSize: 15, color: 'rgba(255,255,255,.4)', marginBottom: 32, lineHeight: 1.65 }}>
              We're building the memory layer of the creator economy.<br />
              Join the waitlist and get early access before anyone else.
            </p>
            {!submitted ? (
              <form onSubmit={handleSubmit}>
                <div style={{
                  display: 'flex', gap: 8,
                  background: 'rgba(255,255,255,.05)',
                  border: '1px solid rgba(255,255,255,.1)',
                  borderRadius: 12, padding: '5px 5px 5px 16px',
                  marginBottom: 12,
                }}>
                  <input
                    type="email" required value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    style={{ flex: 1, background: 'none', border: 'none', fontSize: 14, color: '#fff', padding: '8px 0' }}
                  />
                  <button type="submit" style={{
                    background: 'linear-gradient(135deg,#6366F1,#8B5CF6)',
                    color: '#fff', border: 'none', borderRadius: 9,
                    padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  }}>
                    Join waitlist
                  </button>
                </div>
              </form>
            ) : (
              <div style={{
                background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.25)',
                borderRadius: 12, padding: '16px', color: '#34D399', fontSize: 14, fontWeight: 500, marginBottom: 12,
              }}>
                ✓ You're on the list — we'll be in touch soon
              </div>
            )}
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,.2)' }}>Free forever for early members · {count.toLocaleString()} already joined</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid rgba(255,255,255,.05)',
        padding: '24px 32px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'relative', zIndex: 1,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 22, height: 22, borderRadius: 6, background: 'linear-gradient(135deg,#6366F1,#8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>✦</div>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,.3)' }}>that's the one</span>
        </div>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,.15)' }}>© 2026 · thatsthe.one</span>
      </footer>
    </>
  )
}