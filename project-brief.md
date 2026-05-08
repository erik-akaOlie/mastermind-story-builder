# MasterMind: Story Builder — Project Brief

*(Previously titled "DnD Campaign Mind Map." The product vision below is unchanged; only the name has evolved. For current implementation specifics, see [CLAUDE.md](./CLAUDE.md).)*

## The Problem

Game Masters building narrative-rich campaigns manage a large, interconnected web of people, places, items, factions, and events. The relationships between these elements are as important as the elements themselves. Existing tools — notes apps, spreadsheets, wikis — store information linearly, making it difficult to understand how things connect, spot what's missing, and stay oriented across long stretches of time between sessions.

DMs need a visual, interactive continuity database — inspired by the investigator's case board — where they can see their whole world at a glance, trace connections between elements, navigate quickly from the macro to the micro, and edit on the fly. It needs to work across three distinct contexts:

- **Campaign building** — initial world construction, adding and connecting narrative elements
- **Session preparation** — reviewing, completing, and updating the world before each session
- **Live play** — quick reference and light editing during active sessions with players at the table

---

## Who It's For

Game Masters and Dungeon Masters running long-term campaigns with many interconnected narrative elements: locations, characters, NPCs, items, factions, events, plot hooks, and more.

---

## What Success Looks Like

**1. Instant re-immersion.**
No matter how much time has passed since the last session, opening the map pulls the DM back into the world immediately. Context is visible, not buried. Nothing has to be reconstructed from memory.

**2. Consistent roleplay.**
Every NPC sounds and feels the same session to session. The DM has what they need — backstory, motivations, personality references, voice notes, images — to perform each character reliably, even one they haven't touched in weeks.

**3. Narrative continuity.**
No contradictions, no forgotten threads, no continuity errors. The story holds together across sessions and across time because the world's state is always recorded accurately.

**4. Preparation confidence.**
Before every session, the map gives the DM enough signal to know whether they're ready. They can see what's fully developed, what's thin, and what still needs work — and make deliberate choices about what to address before sitting down with players.

**5. Player orientation.**
Players can get back up to speed quickly after a long gap using a dedicated player view — a version of the map that shows only what their characters have discovered. They arrive ready, not lost.

**6. Session prep completeness.**
The DM never goes into a session unprepared for what the players might throw at them. The map is a reliable safety net — not a hope, but a system.

---

## How We'll Know It's Working

- The DM opens the map and immediately feels oriented, not overwhelmed
- NPCs are played consistently without conscious effort to remember details
- No continuity errors surface during or after sessions
- The DM enters each session with confidence, not anxiety about gaps
- Players reference the player view and find it genuinely useful

---

## How We'll Know It's Failing

**Primary failure signal:** Friction in data entry. If adding or updating information ever feels like a chore, the tool is failing. The bar is: as easy as grabbing a notepad, but vastly more powerful. When the maintenance cost exceeds the perceived value, people stop updating the map. An outdated map becomes untrustworthy. An untrustworthy map gets abandoned.

**Secondary failure signal:** Loss of trust. If the DM ever catches the map being wrong — or finds themselves double-checking it against their own memory — trust erodes. A reference tool you don't trust is useless mid-session.

---

## Core Design Principles

**Progressive disclosure.**
At every level of zoom, the map shows just enough information to orient the user and invite them deeper — not everything at once. The shape of the world at a glance. The region when you zoom in. The town's people and places when you zoom further. The full character detail when you open a node. Information overload is a form of failure.

**Visible completeness without judgment.**
Nodes signal how fully developed they are — visually, at a glance — so the DM can decide what needs attention. Like a waiter scanning a table for glasses that need refilling: the tool makes the state visible, the DM decides what to act on. It informs without nagging.

**Two layers of truth.**
The map holds two simultaneous states: what exists in the world (the DM's full picture) and what the players have discovered (the subset their characters know). These layers are visually distinct. The DM sees everything; the player view reflects only discovered elements. Discovery state is tracked at both the node and connection level.

**The tool accommodates how thinking evolves.**
Campaigns grow and change. A DM who starts thinking in locations may later want to view the world through factions or characters. The underlying data is always a connected web; the view through which it's navigated should be flexible, not locked in at setup.

---

## What This Is Not

- A linear notes app or wiki
- A static document
- A tool that makes decisions for the DM
- A tool optimized primarily for players. The primary audience is the DM. Players are served secondarily with a specific, narrower need: getting oriented and caught up between sessions.

---

## Open Questions

- **Node completeness:** Is completeness user-defined (manually marked) or inferred from filled fields? Likely a combination — to be resolved during design.
- **Flexible views:** Organizing by location vs. character vs. faction — is this a view toggle, a filter, or something else? Direction is clear; implementation is not yet decided.
- **Player view:** Scope and access model to be defined. Likely the same map through a different lens, not a separate tool.
