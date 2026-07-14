import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '../../../lib/supabase'

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const creatorId = request.nextUrl.searchParams.get('state')
  const error = request.nextUrl.searchParams.get('error')

  if (error) {
    return NextResponse.redirect(new URL(`/creators/connect-instagram?error=${error}`, request.url))
  }
  if (!code || !creatorId) {
    return NextResponse.redirect(new URL('/creators/connect-instagram?error=missing_code', request.url))
  }

  const appId = process.env.INSTAGRAM_APP_ID
  const appSecret = process.env.INSTAGRAM_APP_SECRET
  const redirectUri = process.env.INSTAGRAM_REDIRECT_URI

  if (!appId || !appSecret || !redirectUri) {
    return NextResponse.json({ error: 'Instagram app not fully configured' }, { status: 500 })
  }

  try {
    const tokenForm = new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      code,
    })
    const tokenRes = await fetch('https://api.instagram.com/oauth/access_token', {
      method: 'POST',
      body: tokenForm,
    })
    const tokenData = await tokenRes.json()
    if (!tokenData.access_token) {
      console.error('Instagram token exchange failed:', tokenData)
      return NextResponse.redirect(new URL('/creators/connect-instagram?error=token_exchange_failed', request.url))
    }

    const longLivedRes = await fetch(
      `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${appSecret}&access_token=${tokenData.access_token}`
    )
    const longLivedData = await longLivedRes.json()
    if (!longLivedData.access_token) {
      console.error('Instagram long-lived token exchange failed:', longLivedData)
      return NextResponse.redirect(new URL('/creators/connect-instagram?error=long_lived_exchange_failed', request.url))
    }

    const profileRes = await fetch(
      `https://graph.instagram.com/me?fields=id,username&access_token=${longLivedData.access_token}`
    )
    const profileData = await profileRes.json()

    const expiresAt = new Date(Date.now() + (longLivedData.expires_in || 5184000) * 1000).toISOString()
    const { error: dbError } = await supabase
      .from('creator_instagram_connections')
      .upsert({
        creator_id: creatorId,
        instagram_user_id: profileData.id,
        instagram_username: profileData.username,
        access_token: longLivedData.access_token,
        token_expires_at: expiresAt,
        connected_at: new Date().toISOString(),
        is_active: true,
      }, { onConflict: 'instagram_user_id' })

    if (dbError) {
      console.error('Failed to store Instagram connection:', dbError)
      return NextResponse.redirect(new URL('/creators/connect-instagram?error=storage_failed', request.url))
    }

    return NextResponse.redirect(new URL('/creators/connect-instagram?success=true', request.url))
  } catch (err: any) {
    console.error('Instagram OAuth callback error:', err.message)
    return NextResponse.redirect(new URL('/creators/connect-instagram?error=unexpected', request.url))
  }
}