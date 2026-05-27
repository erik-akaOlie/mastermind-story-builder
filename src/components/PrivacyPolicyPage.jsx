// Renders the Privacy Policy at #privacy.
// The .md file under docs/legal/ is the canonical source — humans read the
// same file on GitHub that the app renders here, via Vite's `?raw` import.

import privacyMarkdown from '../../docs/legal/privacy-policy.md?raw'
import LegalDocPage from './LegalDocPage'

export default function PrivacyPolicyPage() {
  return <LegalDocPage markdown={privacyMarkdown} />
}
