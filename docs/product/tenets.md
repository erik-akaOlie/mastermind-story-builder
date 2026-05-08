# MasterMind: Story Builder — Tenets

*Product-level principles that shape what gets built and what gets refused. Each tenet is a claim about the product, not a commitment to a category of work. Interface-grammar principles (visual systems, interaction patterns) live in [`docs/design/design-system.md`](../design/design-system.md).*

---

## 1. The graph is the hard problem; ops are the easy problem.

The defensible core of MasterMind is the worldbuilding knowledge graph — externalizing, organizing, navigating, and reasoning about a complex fictional world. Scheduling, billing, CRM, attendance, recap delivery are operationally straightforward by comparison. We build the hard core to a strong V1 first, then layer the easier operating-system features around it.

This is the FlexNote analogy: own the difficult workflow that no one else has solved well, then expand into the surrounding ops layer once the core is loved.

## 2. Progressive disclosure.

At every level of zoom, the map shows just enough information to orient the user and invite them deeper — not everything at once. The shape of the world at a glance. The region when you zoom in. The town's people and places when you zoom further. The full character detail when you open a node. Information overload is a form of failure.

## 3. Visible completeness without judgment.

Nodes signal how fully developed they are — visually, at a glance — so the DM can decide what needs attention. Like a waiter scanning a table for glasses that need refilling: the tool makes the state visible, the DM decides what to act on. It informs without nagging. No progress bars, no badges, no scolding.

## 4. Two layers of truth.

The map holds two simultaneous states: what exists in the world (the DM's full picture) and what the players have discovered (the subset their characters know). These layers are visually distinct. The DM sees everything; the player view reflects only discovered elements. Discovery state is tracked at both the node and connection level. *(Player view ships in V3; the data model already supports the two-layer separation.)*

## 5. The tool accommodates how thinking evolves.

Campaigns grow and change. A DM who starts thinking in locations may later want to view the world through factions or characters. The underlying data is always a connected web; the view through which it's navigated should be flexible, not locked in at setup.

## 6. The DM's data is the DM's data.

One-click markdown export. No lock-in. Markdown-compatible where possible. The community that's most likely to adopt this product (Obsidian users, Lazy DM adherents) chose data ownership over polish in their current tools — a product that can't credibly answer "can my stuff leave cleanly?" loses them on contact.

## 7. Earn the integration conversations later, not now.

V1 does not need partnerships, official IP integrations, marketplace relationships, or VTT/DDB/Discord integrations. Introducing those conversations too early weakens partnership leverage — a working, beloved product earns those terms on better footing than a roadmap promise does. Build a product that proves value on its own merits first.

## 8. AI is opt-in, pinned to context, never free-floating.

When AI features ship in V2, every AI action is anchored to a specific node, view, or action — never a general-purpose chat box floating in the corner. AI is always opt-in. The defensibility of MasterMind's AI is that it knows *this DM's campaign* — a moat no general-purpose tool has. AI off by default; on per surface where the user invokes it.

## 9. Multi-system from the start, not 5e-only.

The schema and feature design assume Pathfinder 2e, Daggerheart, Shadowdark, and other systems are first-class users. 5e-only is a strategic concentration risk given OGL trauma and Hasbro execution risk. No feature decision should bake in 5e-specific assumptions when system-agnostic alternatives are available at similar cost.

---

*See [`docs/design/design-system.md`](../design/design-system.md) for interface-grammar principles (the graph is the model; one signifier, one meaning; content is the signal; skinnable by design).*
