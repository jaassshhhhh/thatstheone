import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = "That's The One — Creator Commerce Intelligence"
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#060810',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 20,
            marginBottom: 32,
          }}
        >
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 20,
              background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 36,
              color: '#fff',
            }}
          >
            ✦
          </div>
          <div style={{ fontSize: 56, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' }}>
            that's the one
          </div>
        </div>
        <div style={{ fontSize: 28, color: 'rgba(255,255,255,0.5)', textAlign: 'center', maxWidth: 800 }}>
          The intelligence layer for creator commerce
        </div>
      </div>
    ),
    { ...size }
  )
}