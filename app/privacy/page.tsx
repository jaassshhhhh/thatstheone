import Layout from '../components/Layout'

export default function PrivacyPage() {
  return (
    <Layout>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '40px 24px', color: '#fff' }}>
        <h1 style={{ fontSize: 28, fontWeight: 600, marginBottom: 8 }}>Privacy policy</h1>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,.3)', marginBottom: 40 }}>Last updated: June 2026</p>

        {[
          { title: 'What we collect', body: 'We collect anonymous session identifiers stored in your browser. These help us personalise your feed and improve recommendations. We collect email addresses only when you voluntarily join our waitlist.' },
          { title: 'What we do not collect', body: 'We do not collect your name, location, or any personally identifiable information unless you choose to create an account. We do not track you across other websites.' },
          { title: 'How we use your data', body: 'Anonymous session data is used solely to improve your experience — showing relevant content, remembering your recent searches, and personalising your feed. We never sell this data.' },
          { title: 'Cookies', body: 'We use localStorage in your browser to store your session ID and recent searches. No third-party advertising cookies are used.' },
          { title: 'Creator and brand data', body: 'All creator and brand data is sourced from publicly available content. If you are a creator and wish to claim, update or remove your profile, contact us at hello@thatsthe.one.' },
          { title: 'Third parties', body: 'We use Supabase for database storage and Vercel for hosting. Both are GDPR-compliant. We use OpenAI for content processing — no personal user data is sent to OpenAI.' },
          { title: 'Your rights', body: 'You may request deletion of any data associated with your email address by contacting hello@thatsthe.one. Anonymous session data cannot be linked back to you.' },
          { title: 'Contact', body: 'Privacy questions: hello@thatsthe.one' },
        ].map(s => (
          <div key={s.title} style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 16, fontWeight: 500, marginBottom: 8, color: '#fff' }}>{s.title}</h2>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,.45)', lineHeight: 1.7, margin: 0 }}>{s.body}</p>
          </div>
        ))}
      </div>
    </Layout>
  )
}