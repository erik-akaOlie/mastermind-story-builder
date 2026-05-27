// Renders the Terms of Service at #terms.
// The .md file under docs/legal/ is the canonical source — humans read the
// same file on GitHub that the app renders here, via Vite's `?raw` import.

import termsMarkdown from '../../docs/legal/terms-of-service.md?raw'
import LegalDocPage from './LegalDocPage'

export default function TermsOfServicePage() {
  return <LegalDocPage markdown={termsMarkdown} />
}
