import { supabase } from './pipeline.mjs'

async function verifyUrlLive(url) {
  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(5000) })
    return res.ok || (res.status >= 300 && res.status < 400)
  } catch {
    return false
  }
}

async function auditTable(table, idField, urlField) {
  const { data: rows } = await supabase.from(table).select(`${idField}, ${urlField}`).not(urlField, 'is', null)
  console.log(`\n🔍 Auditing ${table}.${urlField} — ${(rows || []).length} rows with a URL`)

  let broken = 0
  for (const row of (rows || [])) {
    const ok = await verifyUrlLive(row[urlField])
    if (!ok) {
      broken++
      console.log(`  ❌ ${row[idField]}: ${row[urlField]} — dead, nulling out`)
      await supabase.from(table).update({ [urlField]: null }).eq(idField, row[idField])
    }
    await new Promise(r => setTimeout(r, 150))
  }
  console.log(`  Done: ${broken} broken, nulled out.`)
}

async function run() {
  console.log('🔧 URL integrity audit — checking every live URL in the database\n')
  await auditTable('brands', 'id', 'website_url')
  await auditTable('sponsorships', 'id', 'product_url')
  await auditTable('sponsorships', 'id', 'promo_url')
  console.log('\n✅ Audit complete.')
}

run()