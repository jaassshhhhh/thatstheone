import Layout from '../components/Layout'

export default function TermsPage() {
  return (
    <Layout>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '40px 24px', color: '#fff' }}>
        <h1 style={{ fontSize: 28, fontWeight: 600, marginBottom: 8 }}>Terms of service</h1>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,.3)', marginBottom: 40 }}>Last updated: June 2026</p>

        {[
          { title: 'What we do', body: "That's The One indexes publicly available creator sponsorships, product recommendations and brand deals across YouTube, podcasts and other platforms. All data is sourced from publicly accessible content." },
          { title: 'How you can use this', body: 'You may use this platform for personal discovery and research. You may not scrape, resell or misuse data from this platform. Commercial use requires written permission.' },
          { title: 'Accuracy of data', body: 'Sponsorship data is extracted automatically using AI and may contain errors. We show a confidence rating on all data. We are not responsible for expired deals or incorrect codes — always verify before purchase.' },
          { title: 'Intellectual property', body: 'Creator quotes and video content remain the property of their respective creators. We surface short excerpts for informational purposes under fair use. If you are a creator and wish to update or remove your data, contact us.' },
          { title: 'Privacy', body: 'We use anonymous session tracking to improve recommendations. We do not sell personal data. See our privacy policy for full details.' },
          { title: 'Changes', body: 'We may update these terms as the platform evolves. Continued use constitutes acceptance.' },
          { title: 'Contact', body: 'For any questions: hello@thatsthe.one' },
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