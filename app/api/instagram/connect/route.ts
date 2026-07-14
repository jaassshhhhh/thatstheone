import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const appId = process.env.INSTAGRAM_APP_ID
  const redirectUri = process.env.INSTAGRAM_REDIRECT_URI

  if (!appId || !redirectUri) {
    return NextResponse.json(
      { error: 'Instagram app not configured — set INSTAGRAM_APP_ID and INSTAGRAM_REDIRECT_URI in .env.local' },
      { status: 500 }
    )
  }

  const creatorId = request.nextUrl.searchParams.get('creator_id')
  if (!creatorId) {
    return NextResponse.json({ error: 'Missing creator_id' }, { status: 400 })
  }

  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    scope: 'instagram_business_basic,instagram_business_content_publish',
    response_type: 'code',
    state: creatorId,
  })

  const authUrl = `https://api.instagram.com/oauth/authorize?${params.toString()}`
  return NextResponse.redirect(authUrl)
}