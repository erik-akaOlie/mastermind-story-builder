# Weekly Update Prompt — Copy / Paste Into a Fresh Claude Task

This is the reusable prompt Erik uses to generate weekly progress updates for **MasterMind: Story Builder**. The prompt works in either a Claude Cowork task (with access to session transcripts) or a Claude Code project (with access to git + files).

Paste everything below the `--- PROMPT STARTS BELOW ---` line into a fresh Claude session. For a milestone week, uncomment the milestone instruction near the end.

---

## How to use

1. **Pick the week.** The prompt auto-detects the current week by reading the existing `weekly-updates/` folder, the git log, and the latest CHANGELOG entries. You can override by specifying a week number or date range if needed.
2. **Paste the prompt.** Copy everything below the `--- PROMPT STARTS BELOW ---` line into the new session.
3. **Review + edit.** Claude saves the draft to `weekly-updates/YYYY-MM-DD-week-N.md`. Read it, cut what doesn't land, post it wherever.

## Milestone weeks

For weeks 2, 4, 8, 12, 14 (100-day), 17, 21 (150-day), 28 (200-day), and 52 (1-year), uncomment the "Milestone mode" section at the end of the prompt. Those posts add a **Trajectory Check** section that compares present Erik to past Erik and projects a reasonable near-future shape.

## Special case: Week 0 (baseline post)

The very first time you use this prompt, run it once with `WEEK_OVERRIDE = 0` in the variables block. That produces a "baseline" post capturing where you started — foundation for every post after. After that, normal weekly usage takes over.

---

## --- PROMPT STARTS BELOW ---

You are helping Erik (a UX designer + UI artist, not a trained engineer) write his weekly progress update for his project **MasterMind: Story Builder** — a visual worldbuilding tool for Dungeon Masters, built with React + React Flow + Supabase, with heavy use of AI-assisted development (primarily Claude).

This is a running series of public-facing updates Erik posts to document his journey from "UX designer who can read a bit of code" toward "person who ships real products with AI collaboration." The updates are candid, lessons-forward, and written in his voice. They're for other non-engineers curious about building in the AI era, and for Erik himself as a record of his own growth.

---

## Your task

Write this week's update as a publishable markdown draft. Save it to `weekly-updates/YYYY-MM-DD-week-N.md` where `YYYY-MM-DD` is the Monday of the week being covered and `N` is the week number (counted from the project's first post, which was the baseline / Week 0).

---

## Before you write — read these inputs

**Always:**

1. **`CHANGELOG.md`** — the append-only log of what changed. The most recent entries since the previous weekly post are the meat of this week's content.
2. **`CLAUDE.md`** — the current implementation state, tech stack, conventions.
3. **`README.md`** — current feature list + roadmap framing.
4. **`weekly-updates/`** folder — the previous week's post (if any). Critical for continuity: reference it, don't repeat it, pick up where it left off.
5. **Git log from the past 7 days** — `git log --since="7 days ago" --pretty=format:"%ad %s" --date=short` — for the day-by-day texture. Also `git diff --stat HEAD@{7.days.ago}` for a sense of how much code actually changed.
6. **`docs/decisions/`** — any new ADRs written this week are worth calling out.
7. **`Market Research/`** — if any strategic documents were created or updated, skim them for context on why this week's work was prioritized the way it was.

**If you're running in Claude Cowork (not Claude Code):**

8. Use the `mcp__session_info__list_sessions` and `mcp__session_info__read_transcript` tools to surface transcripts from the past 7 days. These hold the texture of what Erik actually tried, how decisions were made, and where he got stuck. Mine them for stories — especially the moments where something failed before it worked.

**For voice anchoring:**

9. Read `Market Research/my-thinking-on-the-dm-tool-idea.md` once. This is Erik's voice when he's thinking out loud: first person, grounded, willing to say "I was wrong," not overselling, occasionally self-deprecating, genuinely curious about what works. Match this voice in the post. Do not write in a corporate-blog-post voice. Do not lead with triumphant hook-sentences. Do not use the word "journey" unironically.

---

## Structure

Use these section headings exactly (it helps build a series the reader recognizes). If a section has nothing meaningful to say that week, keep it and write one honest sentence about why ("This week was pure polish; nothing got dropped.").

### Header block

```
# Week N: [short thematic title]
*Week of [Monday date] – [Sunday date]*

One-sentence summary of the week.
```

### Where I was at the start of the week

Two to four sentences. Reference the previous post's "Where I am now" section if it exists, so weeks chain cleanly. For Week 0 / baseline, describe the starting state: Erik's technical baseline (UX designer, not an engineer, has shipped React Flow + canvas UI work, learning AI-era development tooling), and the project's state at kickoff.

### What I shipped

A day-by-day log of concrete accomplishments. Use the git log and CHANGELOG entries as your backbone. Format as a sub-list per day — short bullets, not paragraphs. Name the files changed when it's meaningful. Use plain English for technical things ("wired up login" not "refactored auth boundary"). Example shape:

```
**Monday**
- Did X
- Hit a wall on Y
- Ended the day with Z working

**Tuesday**
- ...
```

Don't invent days where nothing shipped. If Wednesday was a rest day, say so. If a day's work all landed as one commit with a flat message, expand it with context from session transcripts.

### What I tried and dropped

Real failures, pivots, and cut scope. This is the most valuable section of the post — it's where the learning lives. Examples:

- A feature that didn't work and got cut (e.g. the lock/unlock feature)
- An approach that oscillated or broke (e.g. the first icon-hiding implementation)
- A tool or technique considered and rejected (e.g. Firebase → Supabase)
- A design direction that shifted mid-week

For each, describe the original idea in one sentence, what went wrong in one sentence, and what replaced it in one sentence. If nothing was dropped this week, don't pad — just say so and why (e.g. "a polish week; nothing pivoted").

### What I learned

Three to six specific, transferable lessons from the week. These can be:

- **Technical** ("scrollWidth is only meaningful when the element has overflow: hidden set")
- **Product** ("hiding the icon dynamically beats clipping the text, because the title reclaims the space")
- **AI-collaboration** ("I kept assuming Claude understood my intent instead of stating the constraint — the clearer I was about the actual UX goal, the better the solution was")
- **Process** ("shipping a broken version and refreshing the page is often faster than debugging from the chair")

Keep each lesson short and concrete. No generic wisdom. If the lesson is specific to one piece of code, name the file.

### Where I am now

A snapshot of the current state: what MasterMind can do, what it can't, what the next sprint is aimed at. Mirrors the "Where I was" section so next week's post can chain off it cleanly.

### What's next

A brief, honest roadmap look at the next 1–2 weeks of work. Not an aspirational list — what's actually going to happen.

### (Milestone weeks only) Trajectory Check

*Include this section only on weeks 2, 4, 8, 12, 14 (100-day), 17, 21 (150-day), 28 (200-day), 52 (1-year).*

Three short subsections:

- **Then.** Where Erik was at the start of the project (tech skills, AI-collaboration instincts, product clarity). Pull from the Week 0 baseline post.
- **Now.** Where he is today.
- **Forward.** What a reasonable version of Erik looks like at the next major milestone (30 days ahead if now at 14; 60 if at 30; 90 if at 60; etc.). Not hype — a grounded projection given current pace and commitments.

---

## Voice rules (important)

- **First person throughout.** "I shipped X" not "Erik shipped X." The post IS Erik.
- **Grounded, specific, honest.** Say "three hours of that was me not understanding how `useMemo` actually reruns" instead of "learned a lot about React this week." Specificity signals legibility.
- **Don't oversell.** If a feature is ugly but functional, say so. If a decision might be wrong, acknowledge it.
- **Failure is a feature of the narrative, not an embarrassment.** When something broke three times before it worked, tell that story. The reader learns more from the broken-twice-working-third-try arc than from a polished "here's what I shipped" list.
- **Don't use journey / disrupt / game-changer / synergy / level up.** Plain words.
- **Reference specific files and functions** where possible. "In `CampaignNode.jsx` the `useMemo` for `iconHidden` used to depend on `avatarSize`, which turned out to be the exact feedback loop I was trying to avoid." Specificity is credibility.
- **Include the AI-collaboration lens** — not "I asked Claude and it worked," but HOW the collaboration worked. Where you steered. Where you let Claude drive. Where you had to push back. When Claude missed the point. This is the most interesting novel angle of the series.

---

## Length

~1,000 words for a normal week. ~1,500–2,000 words for a milestone week (the Trajectory Check adds real length).

If a week genuinely had less to report (slow week, travel, whatever), a shorter post is fine — 500–700 words. Don't pad.

---

## Format + save

- Markdown file
- Path: `weekly-updates/YYYY-MM-DD-week-N.md` where the date is the Monday of the week being covered
- First line is the `# Week N:` header
- Use the section headings exactly as listed above (makes the series visually consistent)
- Use code blocks and inline code for any filenames or function names you reference

After saving, output a short summary in chat (2–3 sentences) of what the post covers and what you noticed while writing it that might be worth adding in a future week.

---

## Variables (adjust if needed at the start of the session)

```
WEEK_OVERRIDE        = auto-detect   # or a number to force (e.g. 0 for baseline)
DATE_RANGE_OVERRIDE  = auto-detect   # or "YYYY-MM-DD to YYYY-MM-DD" to force
LENGTH_OVERRIDE      = auto          # or "short" / "normal" / "milestone"
INCLUDE_MILESTONE    = auto          # auto = include on weeks 2/4/8/12/14/17/21/28/52; "yes" or "no" to override
```

By default everything auto-detects from context. Override only when you have a reason.

---

## --- PROMPT ENDS ABOVE ---

## Notes for Erik (not part of the prompt)

- **The first time you run this, set `WEEK_OVERRIDE = 0`** to get the baseline post. That becomes the anchor every future post chains off.
- **Review the first post carefully.** Voice calibration is the hardest part; early iteration of the prompt pays compound interest.
- **Keep this file updated.** If a pattern emerges that the prompt should include (e.g. "always link to the previous week's post"), edit the prompt. Future weeks will inherit the improvement.
- **If you want to fork the series** — e.g. a public version AND a private learning-log version — duplicate this file with a different `weekly-updates-private/` path and a slightly different voice instruction.
