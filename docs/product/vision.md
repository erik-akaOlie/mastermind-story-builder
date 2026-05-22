# MasterMind: Story Builder — Vision

*The product's reason to exist: the problem it solves, who it's for, what success looks like, and how we'll know if it's failing. Source of truth for product narrative. Tenets, scope (V1 / V2 / V3+), and open questions live in sibling docs (`tenets.md`, `roadmap.md`).*

---

## The Problem

When someone builds something out of many interconnected parts — people, places, factions, events, and the relationships among them — the relationships matter as much as the parts. But the parts accumulate faster than anyone can hold in mind, and existing tools — notes apps, spreadsheets, wikis — store the information linearly, one item at a time. That makes it hard to see how things connect, spot what's missing, and find the opportunities hiding in the web. People miss connections and insights they could have used — not for lack of information, but because they can never see enough of it at once.

MasterMind's V1 takes this on for **game masters building narrative-rich campaigns**. A campaign is exactly this kind of web — a large, interconnected set of people, places, items, factions, and events that grows across months of play. GMs need a visual, interactive worldbuilding tool — inspired by the investigator's case board — where they can see the whole world at a glance, trace connections between elements, navigate quickly from the macro to the micro, and edit on the fly. It needs to work across three distinct contexts:

- **Campaign building** — initial world construction, adding and connecting narrative elements
- **Session preparation** — reviewing, completing, and updating the world before each session
- **Live play** — quick reference and light editing during active sessions with players at the table

---

## Who It's For

The product serves people whose work is **building an invented fictional world and developing a story within it** — inventing and growing an interconnected set of characters, places, factions, and events over time, and shaping a narrative through them.

**V1 target user:** game masters building tabletop-RPG campaigns. GMs are the concrete, currently-evidenced instance of that broader user — a *target user with initial evidence and planned validation*, not a validated one. Initial evidence is the founder plus two outside testers (one DM, one game designer/writer); broader guerrilla testing with GMs is planned. See [ADR-0013](../decisions/0013-product-positioning.md) for the full positioning, assumptions, and open questions.

**V1 real-world use:** Erik, a UX designer, building a D&D campaign for his family — daily evening worldbuilding, tight feedback loop, real data.

A durable label for this user is not yet settled; this doc describes the user by behavior. Whether the same underlying problem extends well beyond game mastering is a real but unvalidated hypothesis — see `roadmap.md`.

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
