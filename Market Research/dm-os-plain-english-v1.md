# DM Tool Idea — Explained simply

---

## What you're thinking about building

You want to build **one app that does everything a Dungeon Master needs** — like a Swiss Army knife for running D&D games.

Think about your phone. You probably have separate apps for: texting, calendar, photos, music, games, and so on. That's fine because they all live on one phone and they kind of talk to each other.

Now imagine if you were running a D&D game and you needed:

- One app to roll dice
- A different app to look up the rules
- A third app for the battle map
- A fourth app to keep track of who the wizard is in love with this week
- A fifth app to remember what happened three sessions ago
- A sixth app to schedule next week's game
- A seventh app to charge people money (if you're a paid DM)

That's basically what DMs do today. They have 5–8 apps open and none of them talk to each other. **Your idea is to build one thing that does it all** — kind of like how Instagram, Messenger, and Stories all rolled into one big Facebook app.

You compared it to fancy doctor's office software (NextGen, ClinicMind). Doctors used to have one program for appointments, another for medical notes, another for billing insurance, another for sending text reminders. Now there are big "all-in-one" platforms that do everything. You want to do that — but for DMs.

**That's a great instinct.** But "doing it for DMs" is harder than "doing it for doctors" for reasons we'll get to. Let's walk through what's out there, what's broken, and whether your idea is actually good.

---

## The map of what already exists

There are basically **eight kinds of D&D tools** in the world. None of them does everything. Here's the lay of the land:

**1. Battle map apps (called "VTTs" — Virtual Tabletops).**
These are where you put pictures of dungeons and move little tokens around for combat. The big ones are **Roll20** (browser-based, super popular, kind of old-feeling), **Foundry VTT** (more powerful but harder to set up), **Fantasy Grounds** (very old-school, looks like Windows 95), **Owlbear Rodeo** (super simple, fast, beautiful), and **Alchemy RPG** (focuses on cinematic vibes instead of grids).

**2. The official D&D app — D&D Beyond.**
Owned by Hasbro (the company that owns D&D itself). This is where almost everyone keeps their character sheet and looks up the rules. It's the closest thing to "official." It's also kind of poorly run lately — Hasbro tried to launch their own all-in-one called **Project Sigil** in early 2025, fired 90% of the team a few weeks later, and shut the whole thing down by October 2025. Yes, really.

**3. Worldbuilding wikis** — places to write down your made-up world. **World Anvil** is the biggest and most powerful but people complain it's bloated. **Kanka** is the cheaper, simpler one. **LegendKeeper** is the prettier, premium one. They all do basically the same thing: be a fancy notebook.

**4. Note apps that DMs hijack.** A LOT of DMs use **Obsidian** (a free notes app where you own your files) or **Notion** (think Google Docs but with databases). They're not made for D&D, but DMs use them anyway because the actual D&D tools have problems.

**5. Discord.** Universal. Everyone uses it for talking, scheduling, dice bots, and chat. There's basically no replacing it.

**6. Map makers.** **Inkarnate** (paint maps in your browser) and **Dungeon Alchemist** (auto-generate 3D dungeon maps and export to Foundry). DMs usually own both.

**7. The pro DM marketplace — StartPlaying.games.** This is where adults who DM for money find players willing to pay $15–$40 per session. They take roughly 10–15% of every booking and handle payments. Pretty much the only game in town.

**8. The content stores — DMsGuild and DriveThruRPG.** These are where homebrew creators sell their adventures. Same company owns both.

**The big takeaway from this map:** No one app does more than maybe 30% of the full DM job. The closest one (D&D Beyond) is run by a company (Hasbro) that just publicly fumbled their own attempt to expand. Everything is split apart, and it's been that way for 10+ years.

---

## How DMs actually use this stuff (the messy reality)

Imagine you're a paid DM running a weekly D&D game for $20 per player. Here's the typical Wednesday night:

- Your tab list looks like: **D&D Beyond** (rulebook), **Foundry** (maps), **StartPlaying** (to remind yourself who paid), **Discord** (voice chat), **Obsidian** (notes), **Spotify** (music), **Google Calendar** (next session), and **Inkarnate** in case you need to fix a map mid-game.
- A player asks "what was the name of the elf priest we met in chapter 2?" You alt-tab to your notes app. You can't find it. You panic-search for "elf." Six results. None right. You make up a name. Now your notes are wrong forever.
- Someone no-shows. You don't know if you should charge them. There's no rule built into anything. You feel awkward asking for $20.
- The character sheet on D&D Beyond says the wizard has 28 HP. The character on Foundry says 32 HP. They drifted apart over the last three sessions because the bridge between them is buggy. You make a guess.
- A new player wants to join. You send them: a Discord invite, a D&D Beyond invite, a Foundry link, a "please read these house rules" Google Doc, and your scheduling preferences. They get overwhelmed and ghost.

**This is the real, daily pain.** Not "we need cooler features." It's "I'm using too many tools and they don't share information."

---

## What's broken in the most painful way

If you ranked every complaint DMs make on Reddit, this is the order:

1. **"Prep takes forever."** Pretty much every DM spends 3–4 hours preparing for every 1 hour of game. There's a whole celebrity DM (Sly Flourish) whose entire brand is "stop over-prepping."

2. **"I can never find my notes when I need them."** This is the single most fixable problem. Your campaign has hundreds of NPCs, locations, and plot threads, and they're all somewhere — but not where you can grab them in 5 seconds when a player surprises you.

3. **"Scheduling kills campaigns."** People say roughly 60% of D&D groups die because they can't agree on a time to meet. That stat isn't from a real study, but every DM nods their head when they hear it.

4. **"It's hard to onboard new players."** Getting a friend to install the right apps, make accounts, sync their character, and find your notes — that's the #1 reason new players bounce.

5. **"Pro DMs are running their entire business on duct tape."** StartPlaying handles the payment, but the rest — tracking who showed up, who owes a make-up session, what your refund policy is — is all manual.

6. **"AI is here and we don't know what to do with it."** Half of DMs love using ChatGPT for NPC names; the other half are mad about "AI slop" worldbuilding flooding subreddits.

---

## Who's getting screwed the most

Some types of DM are way more underserved than others. If you build for one of these groups specifically, you have a better chance:

- **Brand-new DMs.** They have 140 tools to choose from and no idea where to start. They default to "whatever Reddit said first" which is usually Roll20 + D&D Beyond + Discord. **Nobody is making a thoughtful onboarding experience for new DMs.**
- **DMs running long campaigns.** After 80 sessions, your notes are a graveyard. Continuity is the killer. **Nobody is solving "what did we decide three months ago?"**
- **Paid professional DMs.** Their tools work for finding players (StartPlaying) and getting paid (StartPlaying), but their actual *business* (CRM, scheduling, billing for no-shows, tracking content they reuse across campaigns) is held together with spreadsheets. **Nobody is making the equivalent of "DM business software."**
- **Players trying to find a game.** There are way more players who want games than DMs willing to run them. **But this is a trap** — players don't have much money to spend, so building a tool just for them is hard to make money from.

---

## The graveyard of failed attempts (please read this carefully)

Other people have tried to do what you're thinking about. They lost.

- **Astral Tabletop:** Tried to be a slick all-in-one VTT. Got bought, then shut down in 2023.
- **Project Sigil (Hasbro/WotC's own attempt):** Spent millions of dollars and 30 employees trying to build a premium 3D D&D platform. Launched in February 2025. Fired 90% of the team in March 2025. Officially dead by October 2025. Servers shut down October 2026. **The company that literally owns D&D could not make this work.** That should make you nervous.
- **Mythic Table:** Tried the same thing as a startup. Couldn't raise money. Pivoted to open source (which is a polite way of saying "we gave up on making money").

**The lesson:** Big, premium, "we replace everything" plays die in this space. The winners (Foundry, Owlbear, Obsidian) succeeded by being *one really good thing* that other tools could plug into. They didn't try to be the whole world.

---

## So... is your idea actually good?

**Yes, but you have to be careful about which version you build.**

The good news:

- The fragmentation is real. DMs really are juggling 5–8 tools.
- No one owns the most painful problems (prep time, finding the right note at the right moment, professional DM business operations).
- The market is big. Millions of people play D&D, and it's growing. D&D itself made an estimated $460 million in 2025.
- AI is a genuine new lever. None of the existing tools have figured it out. There's an opening.

The scary news:

- DMs are *opinionated*. They don't just use one tool — they pick favorites and defend them. Telling a Foundry diehard "stop using Foundry, use my thing instead" will not work.
- Hasbro just lit $30+ million on fire trying exactly this. They had the brand, the money, the IP rights, and they still failed.
- Building a battle map app from scratch is *very* expensive. Foundry has a 5-year lead. You won't beat them at being Foundry.
- The community gets mad about big corporate stuff. They've been burned (Wizards' OGL fiasco in 2023, Roll20 data breach, etc.). You'll need to act like a friend, not a corporation.

---

## What you should actually build (the smart version of your idea)

Don't try to replace everything. Instead, build **the one thing nobody else owns: the DM's brain.**

Here's the simple version:

**Your app is the home for everything *about* a campaign** — the NPCs, the lore, the players, the past sessions, what each player knows, what's still secret. It's the canonical "this is my campaign" place.

On top of that, you put two killer features:

1. **An AI co-pilot that knows your campaign.** Not "ChatGPT for D&D" — a hundred of those exist and none have caught on. Yours is special because it knows *your* NPCs, *your* plot threads, *your* past sessions. When a player asks about that elf priest from chapter 2, you ask the AI and it knows. When you need a quick name for a tavern keeper, it suggests one that fits the region's culture you already wrote down.

2. **A "running the session" mode.** When you press the "I'm running tonight's game" button, the app surfaces the right notes at the right moment. It tracks initiative, has the right statblocks ready, and remembers what the players asked about so you can update your notes after.

Then for **paid DMs specifically** (your easiest first paying customers), you add:

- Track who showed up and who didn't
- Auto-bill people based on attendance
- Send recap emails after each session
- Reuse your campaigns across multiple groups
- Manage your "client list" (which players are in which campaign)

And you **integrate with everything else** instead of replacing it:

- Pull character data from D&D Beyond (don't reinvent the rulebook)
- Push to Foundry / Roll20 (don't build a battle map)
- Talk to Discord (don't try to replace voice chat)
- Show up on StartPlaying (don't try to be a player marketplace from day one)

That's the play.

---

## What you should NOT build first

This is the part where I save you from yourself.

- **Do not build a battle map app.** Foundry already won. Owlbear already won simplicity. You will spend two years catching up to where they were five years ago. Just integrate.
- **Do not try to be the digital rulebook.** Hasbro owns that legally. You can't compete with D&D Beyond's content library.
- **Do not build a marketplace where players find DMs.** StartPlaying owns it. Players have low budgets. Two-sided marketplaces are brutally hard to bootstrap. You can add this later as a feature, not as the main product.
- **Do not build "AI Dungeon Master" — an AI that runs games for you.** A bunch of startups (Friends & Fables, RoleForge) are doing this. None have broken through. It's a crowded fight.
- **Do not try to do all of this on day one.** Pick one thing. Be the best at it. Earn the right to expand. Sigil's death was about trying to do everything at once.

---

## The first three things to build, in order

1. **The campaign brain.** Notes, NPCs, locations, factions, sessions — all stored properly so an AI can search them. Free or cheap.
2. **The AI co-pilot built on top of that brain.** "Find me an NPC," "draft a recap," "what did the players learn last session?" This is the hook that makes people care.
3. **Pro DM operations.** Attendance, billing, scheduling, recaps — sold as a paid upgrade to people who DM for money. This is how you make actual revenue early.

After that, you can add a content marketplace, deeper VTT integrations, player-facing features, etc. But not before.

---

## The risks you should be honest about

- **Trust risk.** D&D players don't trust big tech companies. Be a real human. Don't overpromise. Be transparent about your AI usage. Let people export their data easily.
- **Money risk.** The total spend in this market is real but the per-person spend is small. People will pay $5–$10/month happily. Some will pay $30. Almost none will pay $100. Pro DMs will pay more, but there are only a few thousand of them. Plan accordingly.
- **Sequencing risk.** If you try to build everything at once, you'll build none of it well. Be ruthless about saying no to features.
- **AI backlash risk.** Half the community hates AI. Make AI features opt-in, not on-by-default. Don't generate AI art. Be careful with tone.
- **Hasbro risk.** D&D Beyond could finally ship a good Campaign Console (they've been trying for years). If they do, they could squeeze your space. Hedge by supporting other game systems early — Pathfinder 2e, Daggerheart, Shadowdark, etc. Don't be a 5e-only product.

---

## The one-line summary

**Build the home for the DM's campaign brain, put an AI co-pilot on top, sell pro-DM operations to paid GMs, and integrate with everything else instead of trying to replace it.**

That's the version of your idea that has a real chance.

---

## What to do next (concretely)

If I were you, in this order:

1. **Talk to 20 paid DMs.** Find them on StartPlaying. Offer them $50 each for a 30-minute call. Ask them what they hate. Ask them what they'd pay for. Don't pitch them — just listen.
2. **Talk to 20 hobbyist DMs running long campaigns.** Same thing. Find them on r/DMAcademy. Ask them about the "I can't find my notes" moment. See if it lands.
3. **Build a tiny prototype.** Just the campaign brain + a chat interface. Six weeks of work for one engineer. Show it to those 40 people. If their eyes light up, you have something.
4. **Don't talk to investors yet.** You don't need money for the prototype, and you'll get better terms once you have user love to point at.

You don't need to be a "business guy" to do this. You need to be obsessed with one user's pain — pick a paid DM or a long-campaign DM — and build for them like your life depends on it. The business stuff comes later, and it's not as hard as people pretend.

Have fun. This is a fun problem.

---

*If you want a deeper version with citations, real product names, sentiment data, and the boring strategic stuff, see [the full report](computer:///sessions/stoic-cool-pasteur/mnt/outputs/dm-os-competitive-analysis.md).*
