import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// ─── Config ──────────────────────────────────────────────
const GROWTH_THRESHOLD = 1.3          // predict 30%+ growth
const GRADE_WINDOW_DAYS = 90
const NEW_PREDICTIONS_PER_RUN = 5     // top N brands by velocity, capped per run
const MIN_BASELINE_MENTIONS = 3       // guardrail — same threshold as the Content Playbook's BVI guardrail

// ─── Grade predictions whose window has closed ─────────────
async function gradeDuePredictions() {
  const { data: due, error } = await supabase
    .from('predictions')
    .select('id, brand_id, brand_name, baseline_value, target_value')
    .eq('graded', false)
    .lte('grade_date', new Date().toISOString())

  if (error) {
    console.log(`  ✗ Failed to fetch due predictions: ${error.message}`)
    return { graded: 0, correct: 0 }
  }
  if (!due || due.length === 0) {
    console.log('  · No predictions due for grading')
    return { graded: 0, correct: 0 }
  }

  let correctCount = 0
  for (const p of due) {
    const { count } = await supabase
      .from('sponsorships')
      .select('*', { count: 'exact', head: true })
      .eq('brand_id', p.brand_id)

    const actual = count || 0
    const outcome = actual >= p.target_value ? 'correct' : 'incorrect'
    if (outcome === 'correct') correctCount++

    await supabase
      .from('predictions')
      .update({ graded: true, graded_at: new Date().toISOString(), actual_value: actual, outcome })
      .eq('id', p.id)

    console.log(`  ${outcome === 'correct' ? '✓' : '✗'} ${p.brand_name}: predicted ${p.baseline_value}→${p.target_value}+, actual ${actual} — ${outcome.toUpperCase()}`)
  }

  return { graded: due.length, correct: correctCount }
}

// ─── Log new predictions from current top-velocity brands ──
async function logNewPredictions() {
  const { data: brands, error } = await supabase
    .from('brands')
    .select('id, name, slug, velocity_score')
    .order('velocity_score', { ascending: false, nullsFirst: false })
    .limit(30)

  if (error) {
    console.log(`  ✗ Failed to fetch brands: ${error.message}`)
    return 0
  }

  // Brands that already have an open (ungraded) prediction — skip these
  const { data: open } = await supabase
    .from('predictions')
    .select('brand_id')
    .eq('graded', false)
  const openBrandIds = new Set((open || []).map(p => p.brand_id))

  let logged = 0
  for (const brand of brands || []) {
    if (logged >= NEW_PREDICTIONS_PER_RUN) break
    if (openBrandIds.has(brand.id)) continue

    const { count } = await supabase
      .from('sponsorships')
      .select('*', { count: 'exact', head: true })
      .eq('brand_id', brand.id)

    const baseline = count || 0
    if (baseline < MIN_BASELINE_MENTIONS) continue

    const target = Math.ceil(baseline * GROWTH_THRESHOLD)
    const gradeDate = new Date(Date.now() + GRADE_WINDOW_DAYS * 86400000).toISOString()
    const claim = `${brand.name} mentions will grow ${Math.round((GROWTH_THRESHOLD - 1) * 100)}%+ (${baseline} → ${target}+) within ${GRADE_WINDOW_DAYS} days`

    const { error: insertError } = await supabase.from('predictions').insert({
      brand_id: brand.id,
      brand_name: brand.name,
      brand_slug: brand.slug,
      claim,
      baseline_value: baseline,
      target_value: target,
      direction: 'up',
      velocity_score_at_call: brand.velocity_score,
      grade_date: gradeDate,
    })

    if (insertError) {
      // Unique index catches a race/duplicate — not a real failure
      if (!insertError.message.includes('duplicate')) {
        console.log(`  ✗ ${brand.name}: ${insertError.message}`)
      }
      continue
    }

    console.log(`  📝 ${claim}`)
    logged++
  }

  return logged
}

// ─── Run ─────────────────────────────────────────────────
async function run() {
  console.log(`${'═'.repeat(55)}`)
  console.log(`📊 Prediction track record — ${new Date().toISOString()}`)
  console.log(`${'═'.repeat(55)}`)

  console.log('\nGrading due predictions...')
  const { graded, correct } = await gradeDuePredictions()

  console.log('\nLogging new predictions...')
  const logged = await logNewPredictions()

  console.log(`\n${'═'.repeat(55)}`)
  console.log(`✅ Done — ${graded} graded (${correct} correct), ${logged} new predictions logged`)
  console.log(`${'═'.repeat(55)}`)
}

run().catch(err => {
  console.error('✗ predictions.mjs failed:', err)
  process.exit(1)
})