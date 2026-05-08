# MasterMind: Story Builder — Vision

*The product's reason to exist: the problem it solves, who it's for, what success looks like, and how we'll know if it's failing. Source of truth for product narrative. Tenets, scope (V1 / V2 / V3+), and open questions live in sibling docs (`tenets.md`, `roadmap.md`).*

---

## The Problem

Game Masters building narrative-rich campaigns manage a large, interconnected web of people, places, items, factions, and events. The relationships between these elements are as important as the elements themselves. Existing tools — notes apps, spreadsheets, wikis — store information linearly, making it difficult to understand how things connect, spot what's missing, and stay oriented across long stretches of time between sessions.

DMs need a visual, interactive continuity database — inspired by the investigator's case board — where they can see their whole world at a glance, trace connections between elements, navigate quickly from the macro to the micro, and edit on the fly. It needs to work across three distinct contexts:

- **Campaign building** — initial world construction, adding and connecting narrative elements
- **Session preparation** — reviewing, completing, and updating the world before each session
- **Live play** — quick reference and light editing during active sessions with players at the table

---

## Who It's For

Game Masters and Dungeon Masters running long-term campaigns with many interconnected narrative elements: locations, characters, NPCs, items, factions, events, plot hooks, and more.

**V1 user (current):** Erik, a UX designer building a D&D campaign for his family. The product is being built for daily evening worldbuilding use — tight feedback loop, real campaign data, family-scale collaboration.

**Audience expansion:** the product is intended to serve other long-campaign hobbyist DMs and, eventually, professional paid DMs. The transition from "Erik's tool" to "broader audience" is itself an open question — see `roadmap.md`.

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
Players can get back up to speed quickly after a long gap using a dedicated player view — a version of the map that shows only what their characters have discovered. They arrive ready, not lost. *(Player view ships in V3 alongside wiki view; see `roadmap.md`.)*

**6. Session prep completeness.**
The DM never goes into a session unprepared for what the players might throw at them. The map is a reliable safety net — not a hope, but a system.

---

## How We'll Know It's Working

- The DM opens the map and immediately feels oriented, not overwhelmed
- NPCs are played consistently without conscious effort to remember details
- No continuity errors surface during or after sessions
- The DM enters each session with confidence, not anxiety about gaps
- Players reference the player view and find it genuinely useful *(V3)*

---

## How We'll Know It's Failing

**Primary failure signal: friction in data entry.** If adding or updating information ever feels like a chore, the tool is failing. The bar is: as easy as grabbing a notepad, but vastly more powerful. When the maintenance cost exceeds the perceived value, people stop updating the map. An outdated map becomes untrustworthy. An untrustworthy map gets abandoned.

**Secondary failure signal: loss of trust.** If the DM ever catches the map being wrong — or finds themselves double-checking it against their own memory — trust erodes. A reference tool you don't trust is useless mid-session.

---

## The Long-Term Vision

The eventual product is a **Game Master Operating System** — a state-owning platform that holds the DM's canonical campaign and surrounds it with the operational tools paid and hobbyist DMs need (live session co-pilot, attendance, billing, scheduling, recap delivery, content reuse).

The order is deliberate: the **knowledge graph experience is the hard problem** (worldbuilding, navigation, retrieval, semantic relationships), and getting it right earns the right to layer the easier ops features around it. Trying to do everything at once is what kills products in this space — see `docs/strategy/competitive-analysis.md` for the graveyard.

V1 stays narrowly focused on the knowledge graph. V2 introduces AI features grounded in that graph. V3 adds wiki view, player view, and the first wave of ops features. See `roadmap.md`.
