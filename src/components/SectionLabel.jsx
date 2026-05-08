// Small label component used at the top of every section in EditModal
// (Summary, Story Notes, Hidden Lore, DM Notes, Inspiration, Connections).
export default function SectionLabel({ children }) {
  return (
    <span className="block text-xs font-medium text-[#6b7280] uppercase tracking-wide">
      {children}
    </span>
  )
}
