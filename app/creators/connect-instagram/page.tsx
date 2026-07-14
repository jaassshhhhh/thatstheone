'use client'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function ConnectInstagramContent() {
  const params = useSearchParams()
  const success = params.get('success')
  const error = params.get('error')

  return (
    <div style={{ minHeight: '100vh', background: '#060810', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ maxWidth: 420, textAlign: 'center' }}>
        {success && (
          <>
            <p style={{ fontSize: 40, marginBottom: 12 }}>✓</p>
            <p style={{ fontSize: 18, color: '#fff', fontWeight: 600, marginBottom: 8 }}>Instagram connected</p>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,.5)' }}>
              We'll start tracking your posts for real brand mentions and sponsorships — you'll see it show up on your profile.
            </p>
          </>
        )}
        {error && (
          <>
            <p style={{ fontSize: 40, marginBottom: 12 }}>✗</p>
            <p style={{ fontSize: 18, color: '#fff', fontWeight: 600, marginBottom: 8 }}>Something went wrong</p>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,.5)' }}>Error: {error}</p>
          </>
        )}
        {!success && !error && (
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,.5)' }}>Waiting for connection...</p>
        )}
      </div>
    </div>
  )
}

export default function ConnectInstagramPage() {
  return (
    <Suspense>
      <ConnectInstagramContent />
    </Suspense>
  )
}