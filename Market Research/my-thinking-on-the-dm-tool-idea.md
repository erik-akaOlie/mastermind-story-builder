# My thinking on the DM tool idea

*A note to myself, after spending some time actually looking at what exists.*

---

## What I've been thinking about

I've been kicking around the idea of building one app that a DM could use for basically everything — worldbuilding, session prep, running the game, tracking players, scheduling, billing if they're a paid DM, all of it. Kind of the way the big healthcare practice management platforms pull appointments, notes, and billing into one place. I'm not a business guy, so I had to go look at what's already out there before I could tell if this idea is any good.

This is me writing down what I found and what I think I should actually do about it.

---

## The short version

The idea is directionally right. DMs really are juggling too many tools. But the obvious version of my idea — "one app that replaces everything" — has a graveyard of failures behind it, including one from Hasbro themselves that died earlier this year. So I don't want to build *that* version. I want to build a smaller, smarter version that earns the right to grow into something bigger.

---

## What's actually out there right now

There are basically eight kinds of tools DMs use, and they don't talk to each other:

- **Battle map apps (VTTs)** — Roll20, Foundry VTT, Fantasy Grounds, Owlbear Rodeo, Alchemy RPG. This is where you move tokens around on maps.
- **D&D Beyond** — Hasbro-owned, the official rulebook + character sheet app. Basically every 5e player has an account.
- **Worldbuilding wikis** — World Anvil, Kanka, LegendKeeper. Fancy notebooks for your made-up world.
- **Note apps that DMs hijack** — Obsidian and Notion. Not made for D&D, but a *lot* of DMs use them anyway because the real D&D tools have problems.
- **Discord** — universal for chat, voice, dice bots.
- **Map makers** — Inkarnate, Dungeon Alchemist.
- **StartPlaying.games** — the marketplace where paid DMs find players.
- **DMsGuild / DriveThruRPG** — content stores where people sell homebrew.

I went in thinking one of these would already be kind of an all-in-one. None of them are. The broadest one (D&D Beyond) covers maybe 30% of the full DM job, and the rest is scattered. A typical paid DM has 5–8 apps open on a game night. That's not a theoretical problem — that's just how it works right now.

---

## The part that spooked me

I was feeling pretty confident about this until I read about what happened to Project Sigil.

Sigil was Hasbro and Wizards of the Coast's own attempt at a premium all-in-one D&D platform. They announced it years ago. They finally launched it in February 2025. They fired ~90% of the team in March 2025. They officially killed it in October 2025. Servers shut down October 2026.

The company that literally owns D&D couldn't make a big all-in-one platform work.

A couple of other attempts (Astral Tabletop, Mythic Table) also died. Astral got shut down after an acquisition; Mythic Table pivoted to open source after their funding fell through.

The ones that *worked* — Foundry, Owlbear Rodeo, Obsidian — all succeeded by being really good at *one* thing and letting other tools plug in. Not by trying to be the whole world.

So I think the lesson is pretty clear: **I should not try to replace everything.** I should own one layer that nobody else owns, integrate with the rest, and only expand once I've earned the right.

---

## What's actually broken for DMs

When I look at the most common complaints across Reddit, forums, and blogs from actual DMs, these are the repeat offenders:

1. **Prep takes forever.** Most DMs spend 3–4 hours preparing for every 1 hour of game. There's a whole celebrity DM (Sly Flourish) whose entire brand is "stop over-prepping."
2. **"I can never find my notes when I need them."** A player asks about some NPC from three months ago, and the DM is fumbling through a wiki or doc trying to find it. This is the single thing I keep coming back to because I think it's very fixable.
3. **Scheduling kills campaigns.** Everyone says roughly 60% of groups die because they can't agree on a time. That number isn't from a real study, but every DM I've ever known nods when they hear it.
4. **Player onboarding is painful.** Getting a new player to install the right apps, make accounts, sync their character — it's a five-step process and a lot of people bounce.
5. **Paid DMs are running their business on duct tape.** StartPlaying handles the "find players and take payment" part, but the rest — tracking attendance, handling no-shows, sending recaps, reusing content across campaigns — is spreadsheets and Discord DMs.
6. **Everyone is weird about AI.** Half the community is already using ChatGPT for NPC names; the other half is mad about "AI slop" in worldbuilding. I'll have to be careful here.

The one I keep coming back to is #2. "I can never find the right note at the right moment." That feels like the thing that AI is specifically good at — searching your own stuff and bringing it up when you need it. And I don't think anyone has really cracked it yet.

---

## Who I think I should build for

The market has a few different kinds of DM, and they all have different needs. I think I need to pick one to start.

- **New DMs** — poorly served, but they don't really know what they want and they don't pay much.
- **Long-campaign hobbyists** — the "we've been playing every other Thursday for two years" crowd. They have the worst continuity problem. They *would* pay for a good solution.
- **Lore-heavy worldbuilders** — served by a lot of tools already. Crowded space.
- **Paid pro DMs** — small in number (probably low thousands of them who make real money), but they have real problems, real money to spend, and they're vocal. Best early beachhead.
- **Players looking for games** — tempting, but they're the lowest-paying segment and the problem is really a supply problem (not enough DMs), not a tool problem.

My gut says I should start with the **long-campaign hobbyist + paid pro DM** combination. The hobbyist is the passion user who'll tell everyone about it. The pro DM is the paying user who'll fund the early product. They actually want a lot of the same things — good notes, good retrieval, good session-running — the pro DM just also wants billing and attendance stuff on top.

---

## What I think the product actually is

Not an all-in-one. Not yet.

What I think it is: **the home for a DM's campaign brain.**

The app owns the stuff *about* your campaign — NPCs, locations, factions, past sessions, plot threads, what each player knows, what's still secret. All structured in a way that an AI can search it. That's the foundation.

Then on top of that, two things that make it worth caring about:

**1. An AI co-pilot that actually knows your campaign.**

Not generic ChatGPT. Not an "AI DM" that replaces me. An AI that has read my campaign notes and can answer questions about them, draft recaps that sound like my campaign, suggest names for NPCs that fit my world's culture, tell me which plot threads I've left dangling. The reason this is defensible is because the AI is only useful if it knows *my* campaign. Any competitor would have to get the user to re-enter everything.

**2. A "running the session tonight" mode.**

When I click "start session," the app pulls up the right notes. Initiative tracker. Statblocks for the NPCs the party is about to fight. Quick search for anything anyone asks about. Whatever gets said or decided, I can jot it down and it updates my notes.

And then — this is the part where I actually make money — a **pro DM upgrade** that handles the business side: attendance-linked billing, recurring scheduling, session recap delivery, a client/player list I can manage across campaigns.

Integrations, not replacements, for everything else:
- Pull character data from D&D Beyond instead of building a rulebook
- Push stuff to Foundry / Roll20 instead of building a battle map
- Work with Discord instead of trying to replace voice chat
- Eventually plug into StartPlaying instead of trying to be a marketplace

That's the product I think I should build. It's smaller than the original "all-in-one" version, but it's the version that actually has a shot.

---

## What I'm explicitly NOT going to build first

Writing these down because I know I'll be tempted:

- **No battle map app / VTT.** Foundry has a 5+ year lead on modules and automation. Owlbear has won "simple and pretty." I'd spend two years catching up to where they were five years ago. I just need to integrate.
- **No digital rulebook / content library.** D&D Beyond legally owns that and I can't replicate it. I'd rather treat them as an API.
- **No player-facing marketplace.** StartPlaying owns it. Players don't spend much. Two-sided marketplaces are brutal to bootstrap. I could add something like this *later* as a feature, not as the core product.
- **No "AI Dungeon Master" that runs games by itself.** A handful of startups (Friends & Fables, RoleForge) are trying this and nobody's broken through. It's not what I want to build anyway.
- **No everything-at-once launch.** That's what killed Sigil.

---

## The risks I want to be honest about

- **Community trust.** D&D players get burned a lot (OGL fiasco, data breaches, Sigil). I need to act like a normal human, not a VC-backed disruptor. Let people export their data. Be transparent about AI. Don't try to lock anyone in.
- **Per-user spend is low.** Millions of DMs, but most will pay $5–$10/month at most. Pro DMs might pay $30–$50. I need to design pricing around that reality, not around SaaS-maximalist numbers.
- **AI backlash.** Half the community is anti-AI. I need to make every AI feature opt-in. No AI-generated art. Frame the AI as "an assistant you can ignore," not "the way the future works."
- **D&D Beyond could finally ship something good.** They've been promising a real campaign management tool for years and kind of never ship it. But they *could*. I'll hedge by supporting Pathfinder 2e and some of the newer systems (Daggerheart, Shadowdark) early so I'm not all-in on 5e.
- **Sequencing.** If I try to build all the features at once, I'll build none of them well. I have to be ruthless about saying no.

---

## What I'm doing next

In order:

1. **Talk to 20 paid DMs.** Find them on StartPlaying. Offer $50 for a half-hour call. Listen to what they hate. Don't pitch them anything.
2. **Talk to 20 hobbyist DMs running long campaigns.** Find them on r/DMAcademy. Ask about the "I can't find my notes" moment. See if it actually lands or if I'm making it up in my head.
3. **Build a tiny prototype.** Just the campaign brain plus a chat interface that can search it. See if the AI co-pilot experience feels magical or gimmicky when it's pointed at a real, populated campaign.
4. **Show that to the 40 people from step 1 and 2.** If their eyes light up, I know I've got something. If they shrug, I need to rethink.
5. **Don't talk to investors yet.** I don't need money for the prototype, and I'd rather get better terms later with users I can point at.

I'm not trying to make this into a big business overnight. I'm just trying to figure out if the thing I care about building is the thing people actually need.

---

## The one line I keep coming back to

Own the DM's campaign brain, put an AI co-pilot on top that knows it, sell a pro-DM business layer to make money, integrate with everything else instead of fighting it.

I think that's the version of the idea that has a real chance.

---

*Related: [the deeper market analysis](computer:///sessions/stoic-cool-pasteur/mnt/DnD Campaign Mind Map/Market Research/dm-os-competitive-analysis.md) if I want to dig back into specifics later.*
