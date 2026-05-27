// ============================================================================
// LegalDocPage
// ----------------------------------------------------------------------------
// Renders a Markdown document (Terms of Service, Privacy Policy) as a
// standalone, document-style page with clear typography and a back link.
//
// The .md file is the canonical source of truth — humans read the same file
// on GitHub that the app renders here, via Vite's `?raw` import. There is no
// HTML duplication to keep in sync.
//
// Cross-doc links inside the source markdown (`./privacy-policy.md`,
// `./terms-of-service.md`) are rewritten to in-app hash routes (`#privacy`,
// `#terms`) so clicking them stays in the app instead of trying to download
// the .md file.
//
// Hash routes are wired up in main.jsx, BEFORE the auth gate, so these pages
// are accessible without signing in — a prospective user must be able to read
// both documents before deciding to create an account.
// ============================================================================

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// Tailwind classes for each Markdown element. Tuned for readability of legal
// prose: generous line-height, clear hierarchy, sober (non-app) palette.
const components = {
  h1: ({ children }) => (
    <h1 className="text-3xl font-bold text-gray-900 mt-10 mb-6 leading-tight">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-2xl font-semibold text-gray-900 mt-10 mb-4 pb-2 border-b border-gray-200 leading-tight">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-xl font-semibold text-gray-900 mt-8 mb-3 leading-tight">{children}</h3>
  ),
  p: ({ children }) => (
    <p className="my-4 leading-relaxed text-gray-800">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="list-disc pl-6 my-4 space-y-2 text-gray-800">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal pl-6 my-4 space-y-2 text-gray-800">{children}</ol>
  ),
  li: ({ children }) => <li className="pl-1 leading-relaxed">{children}</li>,
  a: ({ href, children }) => (
    <a
      href={href}
      className="text-sky-700 hover:text-sky-900 underline"
      target={href?.startsWith('http') ? '_blank' : undefined}
      rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
    >
      {children}
    </a>
  ),
  strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  code: ({ children }) => (
    <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono text-gray-900">
      {children}
    </code>
  ),
  table: ({ children }) => (
    <div className="my-6 overflow-x-auto">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead>{children}</thead>,
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => <tr className="border-b border-gray-200">{children}</tr>,
  th: ({ children }) => (
    <th className="text-left font-semibold text-gray-900 p-3 border-b-2 border-gray-300 bg-gray-50 align-top">
      {children}
    </th>
  ),
  td: ({ children }) => <td className="p-3 align-top text-gray-800">{children}</td>,
  hr: () => <hr className="my-10 border-gray-300" />,
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-gray-300 pl-4 my-4 text-gray-700 italic">
      {children}
    </blockquote>
  ),
}

// Rewrite cross-doc relative links to hash routes so navigation stays in-app.
function rewriteInternalLinks(markdown) {
  return markdown
    .replace(/\(\.\/privacy-policy\.md\)/g,    '(#privacy)')
    .replace(/\(\.\/terms-of-service\.md\)/g,  '(#terms)')
}

export default function LegalDocPage({ markdown }) {
  const source = rewriteInternalLinks(markdown)

  return (
    <div className="min-h-screen bg-white">
      {/* Top bar — back link to app. Full-width subtle border so the link
          doesn't float in space at narrow viewports. */}
      <div className="border-b border-gray-200 bg-gray-50">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <a
            href="/"
            className="text-sm text-sky-700 hover:text-sky-900 inline-flex items-center gap-1"
          >
            <span aria-hidden="true">←</span>
            <span>Back to MasterMind</span>
          </a>
        </div>
      </div>

      {/* Document body */}
      <main className="max-w-3xl mx-auto px-6 py-10">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
          {source}
        </ReactMarkdown>
      </main>
    </div>
  )
}
