# An All-in-One Operating System for Dungeon Masters: Market Analysis & Strategic Assessment

*Prepared April 2026 · Audience: founder + potential co-founders / advisors · Focus: real user sentiment through early 2026*

**Legend:** Throughout, claims are tagged **[F]** (verifiable fact), **[S]** (pattern in user sentiment), **[I]** (my interpretation), and **[U]** (uncertain / thin evidence). The goal is for you to trust the synthesis without having to re-verify every line.

---

## A. Executive Summary

**The market in one paragraph.** The DM/GM tooling ecosystem in 2026 is large, noisy, and genuinely fragmented — a modal paid campaign touches 5–8 distinct products that do not share state — but it is *not* fragmented in the same way healthcare is. Medical practices are forced into suites by payer and regulatory pressure; DMs are pulled apart by *preference*. Most DMs self-assemble their stack because the creative product (a home-brewed campaign) is itself idiosyncratic. Every serious attempt at a vertically-integrated suite has struggled or failed: Astral Tabletop was sunset in August 2023 after acquisition; Hasbro/WotC's Project Sigil had ~90% of its team laid off weeks after its February 2025 launch and will be fully sunset by October 2026; Mythic Table converted from for-profit to open source after its fundraising path collapsed. The incumbents that won — Foundry VTT, Owlbear Rodeo, D&D Beyond, Obsidian — won by being extensible kernels or narrow-but-excellent specialists, not suites.

**The clearest gaps.** Five workflows are underserved by every incumbent:
1. **Prep-to-table retrieval** — "I can never find the right note at the right moment." Obsidian is the current workaround; it is powerful but high-friction.
2. **Player knowledge state** — tracking what players *know* vs. what is *true* is essentially unsolved anywhere.
3. **Attendance-linked billing and operations for professional DMs** — StartPlaying handles discovery + payments at a 10% take, but the GM's operating business (CRM, recurring scheduling, no-show policy, session recaps, content reuse) is held together with spreadsheets and Discord.
4. **Player onboarding** — the top driver of bad StartPlaying reviews per their own blog; no tool owns the "session zero to session one" flow.
5. **Cross-system character/campaign continuity** — D&D Beyond owns character data, the VTT owns the map, notes live somewhere else, and the stitching is third-party and brittle (DDB-Importer, Beyond20).

**The most promising opportunities.** In order of conviction:
- **"Campaign operating system" centered on an AI co-pilot pinned to the DM's canonical campaign state.** The unique moat is the vector index of *your* NPCs, lore, and session history — general AI-GM products (Friends & Fables, RoleForge) do not have this. [I]
- **A pro-DM operations layer** (billing, attendance, scheduling, CRM, reputation portability) that partners with StartPlaying on discovery rather than competing on it. Small TAM — StartPlaying has reportedly cleared ~$13M cumulative GM earnings across its platform lifetime [company-reported] — but high ARPU and excellent beachhead for trust and testimonials.
- **Neutral character/campaign data spine** that treats D&D Beyond as the rules layer and Foundry/Roll20 as commoditized runtimes, but owns the continuity layer no one else does.

**The all-in-one hypothesis: qualified yes.** There is real, repeatable user pain from fragmentation, and no incumbent is positioned to unify. But the naive all-in-one play — replace everything, subscribe monthly, trust us — is exactly what Hasbro tried with Sigil and what burned $30M+ and a team of 30. The defensible play is a **kernel-plus-ecosystem** approach: own the DM's campaign state and the prep/run loop, integrate (don't replace) the VTT and rules layer, and extend into pro-DM ops and optional discovery later. A single platform beats a bundle; a bundle beats a marketplace-first play. Building the marketplace first (copying StartPlaying) is the weakest version of this opportunity.

---

## B. Product Category Map

Eight product categories map onto the product vision. The first column explains how each one relates to the all-in-one concept.

| Category | Role in the vision | Representative tools |
|---|---|---|
| **Virtual Tabletops (VTTs)** | Run the session: maps, tokens, combat, dice. The "OR" in the operating room. | Roll20, Foundry VTT, Fantasy Grounds Unity, Owlbear Rodeo, Alchemy RPG, D&D Beyond Maps |
| **Rules / content / character managers** | The compendium and character-sheet layer — adjacent to VTTs but usually separate. | D&D Beyond, Demiplane Nexus, Pathbuilder |
| **Worldbuilding & campaign wikis** | Lore, factions, locations, history — the pre-play knowledge base. | World Anvil, Kanka, LegendKeeper, Campfire, Scabard |
| **Note / knowledge-base tools (general-purpose, pressed into service)** | Session notes, prep, player journals — where DMs actually live during prep. | Obsidian (+ TTRPG plugin ecosystem), Notion, OneNote, Google Docs |
| **Scheduling / group coordination** | Getting four adults in one virtual room once per week. Universally painful. | Sesh (Discord bot), When2Meet, Doodle, Google Calendar, Calendly |
| **LFG / player-discovery** | Matching players and DMs. Massively oversupplied on the player side, undersupplied on the DM side. | Roll20 LFG, Reddit r/lfg, Discord servers, StartPlaying.games |
| **Payment / booking for professional DMs** | The pro-DM business layer: take payments, schedule recurring sessions, manage cancellations. | StartPlaying.games (dominant), Stripe/PayPal + calendar (DIY), Camp Dragon Online, Patreon |
| **Content marketplaces** | Creators sell adventures, maps, tokens, modules. Winner-take-most dynamics, discoverability is the complaint. | DMsGuild (WotC-licensed), DriveThruRPG, itch.io, Patreon, StartPlaying (bundled) |
| **Map creation** | Usually a third-party image generator; its output goes into the VTT manually. | Inkarnate, Dungeon Alchemist, Dungeondraft, Czepeku (Patreon), 2-Minute Tabletop |
| **Audio / ambience** | Live-session mood. Mostly solved but outside any platform. | Syrinscape, Tabletop Audio, Spotify |
| **Encounter / NPC / treasure generators** | Prep accelerators. Many free, some bundled in VTTs. | Kobold Fight Club, Donjon, Perchance, Watabou, Tetra Cube |
| **Community platforms** | Where DMs *talk* about tools and campaigns. Distribution channel, not a tool. | Reddit (r/DMAcademy, r/rpg, r/DnD), Discord, YouTube, Twitch |

**Observation.** The founder's product vision spans at least seven of these categories. No single incumbent spans more than three without being conspicuously weak in most of them. The gravitational center of the ecosystem is *not* the VTT — it's the DM's campaign state, which has no canonical home.

---

## C. Competitive Landscape Table

Thirteen products, covering the most relevant incumbents. Combined micro-categories (maps; content marketplaces) are treated as one row for brevity.

| # | Product | Category | Target audience | Major workflows supported | Notable limitations |
|---|---|---|---|---|---|
| 1 | **Roll20** | VTT | Casual hobbyist DMs + players; the default first VTT | Maps, combat, dice, audio, compendium, LFG, licensed content store | Dated UX, weak automation vs. Foundry, post-acquisition feature drift, content locked to platform |
| 2 | **Foundry VTT** | VTT | Power-user DMs willing to self-host or pay hosting | Deep automation, module ecosystem, conditions/active effects, multi-system | Learning curve is the #1 complaint; self-hosting barrier; no native LFG or marketplace liquidity |
| 3 | **Fantasy Grounds Unity** | VTT | Rules-heavy DMs, older-edition/obscure-system players | Best-in-class rules automation for many systems; deepest licensed-system breadth | "Windows 95" UX, steepest learning curve, declining mindshare |
| 4 | **Owlbear Rodeo** | VTT (minimalist) | DMs who want theatre-of-mind + light visuals; tablet/phone players | Maps, tokens, fog, measurement, initiative, extensions (v2) | Intentionally limited; no character sheets; small-team velocity |
| 5 | **Alchemy RPG** | VTT (cinematic) | Narrative/story-first DMs; new DMs intimidated by Foundry; mobile-friendly tables | Scene/ambience presentation, mobile apps, publisher-content partnerships | Small user base; weak tactical combat; pricing at upper end |
| 6 | **D&D Beyond** | Rules/content + emerging VTT (Maps) | 5e DMs + players; hobbyist and pro; de facto for 5e character sheets | Rulebooks, character builder, encounter builder (beta), Maps VTT, homebrew | Incomplete campaign tooling, Sigil collapse eroded trust, 2024 rules bleed-through, Hasbro roadmap slippage |
| 7 | **Demiplane Nexus** | Rules/content (multi-system) | Multi-system DMs (5e '24, PF2e, Daggerheart, VtM, etc.) | Digital reader, multi-system character sheets, Roll20 integration beta | Smaller content library than DDB; strategic ambiguity post-Roll20 acquisition |
| 8 | **World Anvil** | Worldbuilding wiki | DM-writers, lore maximalists, novelists | Deep wiki, timelines, family trees, secrets, manuscript tools, Foundry integration | Bloated UI, steep onboarding, billing friction (auto-renew, refund complaints), mobile weak |
| 9 | **Kanka** | Worldbuilding wiki | Pragmatic GMs who bounced off World Anvil | TTRPG-shaped entities, family trees, calendars, most generous free tier, self-hostable | Rigid taxonomy, weaker search/cross-linking, clunky vs. Obsidian, offline unsupported |
| 10 | **LegendKeeper** | Worldbuilding wiki (premium) | West Marches / multi-DM / GM-first buyers who want polish | Multiplayer cursors, nested interactive maps, whiteboards, clean pricing | No free tier, small community, narrower feature set than WA |
| 11 | **Obsidian (+ TTRPG plugin ecosystem)** | Notes / knowledge base | Long-campaign DMs, data-ownership-focused, Lazy DM adherents | Markdown vault, graph view, Initiative Tracker + Fantasy Statblocks + Dice Roller + Leaflet + Dataview plugins | Steep setup, plugin fragility across versions, no native collaboration, mobile weaker |
| 12 | **Notion** | Notes / knowledge base | DMs already using Notion at work; template buyers | Relational DBs, templates (Lorekeeper, DM Dashboard, etc.), real-time collaboration | Scale performance issues; weak offline; data lock-in; organizational drag mid-campaign |
| 13 | **StartPlaying.games** | Pro-DM marketplace | Professional/semi-pro paid DMs + their players | Listings, booking, Stripe-like payments (90/10 split), reviews, GM Discord | Review policy grievances; only solves discovery + payment; no prep/ops tooling |
| (+) | **DMsGuild + DriveThruRPG** | Content marketplace | Creator economy: homebrew authors, small studios | Digital storefront, payouts (50% / 70% respectively), WotC-IP licensing | Discoverability "metadata crisis"; winner-take-most sales; rev share felt high vs. DriveThru |
| (+) | **Inkarnate + Dungeon Alchemist** | Map creation | Every DM who needs bespoke maps | Region/city/battlemap creation; AI-assisted interiors (DA) with VTT-ready export | Output is usually an image, not a VTT-ready scene; bespoke-map skill curve |

**The stark observation.** No row in this table spans more than ~30% of the full DM lifecycle. The broadest, D&D Beyond, has four product surfaces (content, character, encounters, Maps) but none of them is the category leader. Every other product is a specialist.

---

## D. Individual Product Analyses

Each section follows the requested framework: overview → core capabilities → strengths → weaknesses → user sentiment → SWOT.

---

### D.1 Roll20

**Overview.** Browser-based VTT launched in 2012, the default first-VTT for most new 5e DMs. Roll20 is now under the **OneBookShelf / "Wolves of Freeport" joint venture** umbrella alongside DriveThruRPG, DMsGuild, and (post-2024) Demiplane [F]. Freemium model with Plus (~$5/mo) and Pro (~$10/mo) tiers; also sells licensed content as one-time marketplace purchases.

**Core capabilities.** 2D grid maps, dynamic lighting, character sheets with macros, dice, Jukebox audio, handouts, compendium integration, native Looking-For-Group marketplace. Charactermancer wizards for 5e creation.

**Strengths.** Browser, zero-install, share-a-link onboarding is the canonical reason DMs stay. Largest library of officially-licensed adventures (D&D, Pathfinder, Call of Cthulhu, etc.). Native LFG is a genuine network-effect moat; many paid-DM games originate there. Lowest friction for one-shots and casual tables.

**Weaknesses.** Persistent performance complaints (lag with dense maps, many tokens, dynamic lighting). UI "stuck in 2015." Automation is weak — macros are possible but esoteric; not comparable to Foundry's active-effects system. Purchased adventures are platform-locked. Post-acquisition sentiment has soured on r/Roll20 and r/rpg — users report feature velocity has slowed [S].

**User sentiment (patterns).** Consistent positive on accessibility and licensed content; consistent negative on performance, dated feel, and the gap between what you pay and what you get vs. Foundry's one-time $50. The 2018 data-breach scar tissue still surfaces in comparison threads [S].

**SWOT.**
- **S:** Brand ubiquity, LFG liquidity, licensed content breadth, browser-first onboarding.
- **W:** UX debt, weak automation, platform lock-in for content, uncertain post-acquisition direction.
- **O:** The new corporate family (Demiplane + DriveThru + DMsGuild) could enable cross-platform flows no independent competitor can match.
- **T:** Foundry eating the power-user tier; D&D Beyond Maps eating the casual-5e tier; community trust continues to erode.

---

### D.2 Foundry VTT

**Overview.** Independently developed by Atropos, funded by a **one-time ~$50 GM license** [F]; players free. Self-hosted or via third-party hosting (Forge, Molten Hosting — ~$4–10/mo). No VC, no acquisition, no subscription — itself a marketing point. Paizo has an official Pathfinder 2e relationship.

**Core capabilities.** Dynamic lighting/vision/fog, deep module/API ecosystem (thousands of community modules), system-level automation for D&D 5e, PF2e, and dozens of others. Combat tracker with automation hooks. PF2e on Foundry is widely regarded as the gold-standard digital implementation.

**Strengths.** "Pay once, own forever" is the #1 cited reason DMs switch from Roll20. Automation depth: conditions, damage application, saves, active effects are handled for you. Module ecosystem is a genuine moat — Dice So Nice, Monk's, DF Scene Enhancers, DDB-Importer are quasi-required for 5e. Self-hosting means full data ownership.

**Weaknesses.** Learning curve is the dominant complaint (r/FoundryVTT threads are full of "broken after update" posts). Self-hosting is a non-starter for non-technical DMs; Forge re-introduces recurring cost. Module sprawl: breaking changes on major version updates (v10→v11→v12) cause periodic community pain. Mobile/tablet experience lags. No native LFG or marketplace liquidity.

**User sentiment.** "Foundry is better but I had to bribe my friend to come set it up." Almost every "which VTT should I pick?" thread ends with "Foundry if you're technical, Roll20 if you're not" [S].

**SWOT.**
- **S:** Best-in-class automation; one-time pricing; independent; community ecosystem is quasi-app-store-scale.
- **W:** Onboarding cliff; self-hosting overhead; update fragility; no discovery layer.
- **O:** Layer a managed/simplified experience on top of Foundry (Forge is the proof point); become the "Shopify of VTTs."
- **T:** A competitor that keeps the module ecosystem but removes the onboarding cliff — exactly the opportunity the founder is considering.

---

### D.3 Fantasy Grounds Unity

**Overview.** Developed by SmiteWorks. Multi-tier pricing is famously confusing: Standard (~$39 one-time) lets you join; Ultimate (~$149 one-time) lets players join free; subscription options (~$4–10/mo) also exist. Deepest licensed content across obscure systems (Rolemaster, CoC, Traveller, older D&D editions).

**Core capabilities.** Deepest rules automation of any VTT for specific systems — FG parses official statblocks and auto-applies mechanics, often more completely than Foundry for older editions. Combat tracker is best-in-class for crunchy play.

**Strengths.** Rules depth. System breadth — if you play Rolemaster or CoC, FG is the VTT. One-time purchase appeals to anti-subscription users.

**Weaknesses.** UI/UX is a full generation behind — users literally call it "Windows 95." Steepest learning curve of the five major VTTs. Aesthetics lag. Pricing tier confusion. Declining mindshare: increasingly framed as "the old guard" in comparison threads [S].

**User sentiment.** Respectful but dated. Hard-core older-system players are loyal. New DMs are not discovering it.

**SWOT.**
- **S:** Rules automation depth; licensed system breadth.
- **W:** UX debt; steep learning curve; aging user base.
- **O:** A modernized version of the same rules engine could re-acquire the power user.
- **T:** Vulnerable to any competitor that matches its automation with modern UX — and that's most competitors.

---

### D.4 Owlbear Rodeo

**Overview.** Developed by a very small independent team (husband-wife duo Nicola and Mitchell). **v1** was free, minimal, no account; **v2** rebuilt with accounts, persistent rooms, extensions, subscription (~$6–8/mo Plus tier, free tier available). The v1→v2 transition caused genuine community friction (v1 sunset was postponed due to backlash) [S].

**Core capabilities.** Grid maps, tokens, fog of war, measurement, initiative. v2's extension system is growing — HP trackers, statblocks, weather effects, dice. Deliberately lightweight: no character sheets natively.

**Strengths.** Lowest learning curve of any serious VTT. A new group can play in five minutes. Performance is fast and responsive even on tablets. Extension system is increasingly praised as "Foundry-lite" without complexity.

**Weaknesses.** Intentionally limited — not suited for crunchy combat. No native character sheets. Small-team velocity. v1→v2 subscription friction.

**User sentiment.** Beloved within its niche. "The VTT that gets out of the way" is the canonical phrase. Frequently used *alongside* D&D Beyond and paper sheets rather than as a standalone stack [S].

**SWOT.**
- **S:** Philosophical clarity; onboarding velocity; tablet friendliness; growing extension ecosystem.
- **W:** Deliberately narrow; no character/rules layer; small team.
- **O:** Default VTT for "theatre-of-mind-plus-visuals" tables — a growing segment as DMs rebel against crunch.
- **T:** If Roll20 or D&D Beyond ever ship a genuinely simple VTT, Owlbear is squeezed.

**Why this matters for the founder.** Owlbear is not a competitor — it's a signal of what DMs *reject* about heavy VTTs. An all-in-one platform that feels like Foundry-minus will lose to one that feels like Owlbear-plus.

---

### D.5 Alchemy RPG

**Overview.** Alchemy Labs raised ~$740k on Kickstarter in 2023 for a "reimagined VTT experience" [F]. Positioned as narrative-first and cinematic, not grid-focused. Subscription ~$10–15/mo for DMs; free player tier. Has pursued publisher partnerships (Kobold Press, etc.) for official content.

**Core capabilities.** Cinematic scene presentation (background art + ambient audio + atmospheric effects rather than grid combat), character sheets, theatre-of-mind-oriented combat, iOS/Android apps — notable because most VTTs are desktop-only.

**Strengths.** Presentation is the standout: "it feels like running a published adventure, not a spreadsheet." Mobile apps are genuinely differentiated. Content partnerships give a pipeline.

**Weaknesses.** Small user base — "I love it but can't get my players to try yet another tool" is the recurring sentiment [S]. Weak grid/tactical combat (explicitly not for crunchy play). Subscription at the upper end of the market for a smaller feature set. The Numtini's Corner review ("Changing Gold Into Lead," Jan 2025) is emblematic of mixed post-launch reception.

**User sentiment.** Thin overall discourse relative to Roll20/Foundry — itself a signal of limited mindshare. Polarized between "finally a narrative VTT" enthusiasts and "it can't do D&D combat" critics.

**SWOT.**
- **S:** Presentation quality; mobile support; publisher partnerships.
- **W:** Small base; weak tactical support; pricing-feature mismatch.
- **O:** Narrative/fiction-first TTRPG space (Daggerheart, Kids on Bikes, Wildsea) is growing.
- **T:** Deprioritizes the biggest spending segment (5e tactical combat). Most likely to be displaced of the five VTTs [I].

---

### D.6 D&D Beyond

**Overview.** The official Wizards of the Coast digital companion for D&D 5e and the 2024 rules refresh. Hasbro acquired it in 2022 for **$146M** [F, widely reported]. Tiered subscription (Hero / Master). The single most strategically important asset in the entire ecosystem because it holds the content license.

**Core capabilities.** Digital rulebooks (2014 + 2024), character builder and sheets, homebrew tools, Encounter Builder (still in beta — years in), and the **Maps VTT** (2D — native initiative tracker, fog-of-war, Reveals for sharing images).

**Strengths.** Deepest and only canonical 5e content library. Character sheet is the de facto standard — your players already have accounts. Master-tier sharing lets a DM license their books to their whole table. Tight integration (Maps) is starting to narrow window-switching.

**Weaknesses (the most important section in this entire report).**
- **Sigil collapse [F].** Project Sigil, the flagship 3D VTT, shut in October 2025 after ~90% of its ~30-person team was laid off in March 2025, weeks after launch. Servers sunset October 31, 2026. Per PC Gamer reporting, Hasbro described its "distinct monetization path" as never materializing; Gizmodo framed it as Hasbro confusing a VTT with a video game.
- **Maps roadmap slippage [F].** Per their own 2026 roadmap, three of six planned 2025 features slipped; Campaign Console was redesigned mid-year because it "didn't solve enough DM pain points."
- **Encounter Builder has been in beta for years** [F, per forum threads].
- **2024 rules bleed-through [S].** 2024 content appears in 2014 campaigns, forcing DMs to audit every level-up.
- **Trust debt [S].** OGL fallout (Jan 2023) permanently damaged community trust. Sigil collapse reinforced skepticism. Paid users describe themselves as "tapping out."

**User sentiment.** Loyal because locked in on content; exhausted by execution. Many DMs run D&D Beyond *in a browser tab next to* their actual VTT rather than in it.

**SWOT.**
- **S:** Content license is legally inimitable; character sheet is the industry standard; ~4% Hasbro WotC revenue growth in 2024 suggests business is fine overall.
- **W:** Execution velocity; trust; feature completeness on DM-facing surfaces; cancellation/reorg thrash (Sigil).
- **O:** If they ship a great Campaign Console, they could eat adjacent tooling.
- **T:** They've been trying to ship a great Campaign Console for years. Every month they don't, the opportunity for a third-party to own that layer grows.

**Strategic implication.** Partner, don't compete. Do not reproduce the compendium (legally fraught and a commodity). Treat D&D Beyond as the rules/content API and own the workflow layer above it.

---

### D.7 Demiplane (Nexus)

**Overview.** Acquired by Roll20/OneBookShelf in 2024 [F]. Now positioned as the "Official Digital Toolset for D&D" on Demiplane — licensed by WotC for 2014+2024 core content, creating the unusual situation where two WotC-licensed products (DDB and Demiplane) coexist under different corporate parents.

**Core capabilities.** Digital reader with tooltips/cross-links (consistently praised UX [S]), character sheets for 5e (both editions), plus PF2e, Vampire: The Masquerade, Avatar Legends, Daggerheart, and others. 2025 beta integration pushes sheets into Roll20's VTT; Pro "Condition Sync" propagates 5e conditions to Roll20 tokens.

**Strengths.** Multi-system breadth is meaningfully broader than D&D Beyond. Reader UX is commonly called the best in category. The Roll20 integration is one of the only credible attempts at closing the sheet↔VTT gap [I].

**Weaknesses.** Perceived as the underdog. 5e-specific feature parity with DDB not yet there. Post-acquisition strategic ambiguity — is Nexus the future or a Roll20 bolt-on? Library is smaller; depends on license continuity.

**User sentiment.** Quietly positive among power users who've discovered it; low awareness among casual players [S].

**SWOT.**
- **S:** Multi-system license; clean UX; Roll20 integration pathway.
- **W:** Smaller library; brand recognition; strategic ambiguity.
- **O:** Could become the de facto character layer *across* systems if Hasbro missteps further.
- **T:** Roll20 deprioritizing it in favor of Roll20-native features.

---

### D.8 World Anvil

**Overview.** Worldbuilding wiki + RPG campaign manager, launched 2017 by Janet Forbes and "Dimitris." Claimed community varies across their own copy (1.5M / 2M / 3M) — treat as marketing [U]. Tiers: Freeman (free) / Master (~$6.50/mo) / Grandmaster (~$12/mo) / Sage (~$25–30/mo). Foundry VTT integration exists.

**Core capabilities.** Article-based wiki with heavy templating (characters, locations, orgs, items), interactive maps with clickable pins, timelines, family trees, secrets/reveals gating, per-player handouts via Campaign Manager, manuscript tools for novelists, custom HTML/TWIG/CSS on higher tiers.

**Strengths.** The deepest feature set in the category. Strong for writers *and* GMs. Active community, prompt challenges, visible roadmap. Templates enforce consistency across very large worlds. Secrets system with per-player visibility is a unique differentiator.

**Weaknesses.** The dominant and consistent complaint pattern: UI is **"bloated," "overly complicated and slow," "too many pop-ups,"** steep learning curve, "hundreds of buttons" [S, recurring across EN World, comparison blogs, Kanka/LegendKeeper's own marketing pages]. Free tier was tightened from ~100+ articles to ~42, which users describe as holding existing work "hostage" until they pay [S]. Billing complaints on Trustpilot form a pattern: auto-renewal without notice, refund refusal citing "waived rights" or coupon usage — partial refunds have been granted after escalation, so it's friction, not universal denial [S]. Mobile experience sluggish.

**User sentiment.** Love it when it clicks, bounce off it when it doesn't. Self-identify as "I'm a World Anvil person" users are vocal defenders; a lot of DMs try it and leave.

**SWOT.**
- **S:** Feature depth; manuscript workflow (unique); publisher-site quality on higher tiers; Foundry integration.
- **W:** UX debt; onboarding friction; billing reputation; performance.
- **O:** Publisher/IP licensing of worldbuilding content; AI-assisted generation at scale.
- **T:** Users choosing Obsidian for ownership and Kanka for simplicity. LegendKeeper eating the collaborative premium tier.

---

### D.9 Kanka

**Overview.** Open-source core (GitHub: owlchester/kanka) SaaS-hosted at kanka.io. ~3-person team. Free Kobold tier; paid Owlbear/Wyvern/Elemental from ~$4.99/mo. **v3.5 (November 2025)** added whiteboards and raised limits [F].

**Core capabilities.** Entity types tailored to TTRPGs — characters, locations, organizations, journals, quests, items, notes, calendars, timelines, family trees, races, abilities, image-pin maps, dice roller, campaign dashboard, attribute templates, entity permissions for players, now whiteboards.

**Strengths.** Consistently praised as the approachable World Anvil alternative. Direct quotes across RPGnet/EN World: "UI agrees more with my brain," "smoother," "straightforward." Most generous free tier among purpose-built tools (no campaign cap). Developer is notably responsive in the Discord. Wins specifically on family trees, org charts, calendars. Self-hostable — meaningful for data-ownership DMs.

**Weaknesses.** Rigid taxonomy — entities have a fixed shape, so DMs wanting idiosyncratic structure feel the tool is "fighting them." Search and cross-linking are weaker than Obsidian, per direct comparison posts [S]. Interface "clunky compared to Obsidian." Offline essentially unsupported. Fewer polished layout/publishing options than WA.

**User sentiment.** The tool mentioned when someone has tried WA, bounced off, and still wants a structured wiki (rather than assembling Obsidian themselves).

**SWOT.**
- **S:** Free tier generosity; TTRPG-shaped out of the box; self-hostable; responsive developer.
- **W:** Taxonomy rigidity; discovery weaker than Obsidian graph; small team velocity.
- **O:** Default "purpose-built wiki" for DMs who don't want to build in Obsidian.
- **T:** Obsidian + plugins replicating ~70% of its value at $0.

---

### D.10 LegendKeeper

**Overview.** GM-first, web-based. **$9/month or $90/year** [F]. 14-day trial, no refunds policy. Unlimited users and sites included — single clear price.

**Core capabilities.** Wiki with auto-interlinking, nested interactive maps (continent → dungeon), collaborative Boards (whiteboards) added 2024, reusable templates, granular per-user/per-page permissions, real-time multiplayer cursors, rebuilt map tool 2025 (regions, paths, labels, measuring), Meter Block for trackable numeric fields, polished visual editor.

**Strengths.** Consistent praise for polish, speed, and "purpose-built for RPGs without the bloat." Multiplayer collaboration is the standout — considered best-in-class for shared/West Marches campaigns. Map experience is widely called the best in category. Single clear price.

**Weaknesses.** Smallest community of the worldbuilding three [I]. No free tier blocks casual evaluation. Less literary/prose tooling than WA. Some reviewers note the feature set is "relatively simple" compared to WA's depth [S]. No refund policy is friction.

**User sentiment.** Strongly positive within its user base; the sample of critics is small — ambiguous whether that's satisfaction or just small sample [U].

**SWOT.**
- **S:** Polish, multiplayer, nested maps, clear pricing.
- **W:** No free tier, smaller community, narrower features.
- **O:** The default "premium GM wiki" once DMs are willing to pay.
- **T:** "Why pay when Obsidian is free?" Price-sensitive DMs.

---

### D.11 Obsidian (for TTRPG/DM use)

**Overview.** Local-first Markdown note app, free for personal use, paid add-ons Sync ($5/mo) and Publish ($10/mo). Files live on local disk. Not a TTRPG product per se — but the TTRPG plugin ecosystem has become a genuine substitute for purpose-built tools.

**DM-specific plugin stack (mostly by "javalent" / Jeremy Valentine).** Fantasy Statblocks (renderable 5e statblocks, data source), Initiative Tracker (combat side-panel, consumes Fantasy Statblocks), Dice Roller (inline dice codeblocks), Leaflet (interactive maps with note-linked markers), Dataview (notes-as-database queries), Calendarium (in-world calendars). Templates from Sly Flourish (Lazy DM Campaign Template) and Josh Plunkett have community authority.

**Strengths.** **Data ownership** — plain Markdown, no lock-in. Backlinks and graph view map naturally onto the web of NPCs/factions/locations. **Organizational freedom** — "doesn't fight you" when your world doesn't fit prescribed categories. Free core. Plugin mix-and-match scales from a simple binder to a full encounter-running console. Sly Flourish's public migration from Notion to Obsidian carries community weight.

**Weaknesses.** Steep setup curve is the #1 repeated complaint — "you can dive into the deep end and quickly become overwhelmed." Requires Markdown literacy. No native real-time collaboration (Sync is personal device sync, not co-editing). Plugin maintenance overhead: breakage risk on major updates. Mobile weaker than desktop. Sharing with players is awkward — Publish is per-site and doesn't render all plugins.

**User sentiment.** Adoption is strongly ideologically motivated — data ownership + Lazy-DM methodology. Once users convert, they almost never leave. But onboarding is the cliff.

**SWOT.**
- **S:** Data ownership; graph-based retrieval; plugin ecosystem; Lazy DM brand gravity.
- **W:** Setup cliff; collaboration weak; mobile weak; DM is their own sysadmin.
- **O:** A managed/guided Obsidian-like experience could onboard the "I want ownership but not IT work" segment.
- **T:** A competitor that nails retrieval and collaboration without requiring plugin assembly.

**Why this matters.** Obsidian's popularity is the strongest existing signal that DMs will choose data ownership and flexibility over polish when forced to. Any SaaS all-in-one must address "my stuff can leave cleanly" to win this cohort.

---

### D.12 Notion

**Overview.** SaaS workspace, free personal plan, paid ~$10–15/user/mo. Massive third-party D&D template ecosystem (Lorekeeper by Minva, GM Coblin's DM Dashboard, Nebula-DnD, many on Etsy/Gumroad).

**Core DM workflows.** Templates structure campaign binders around linked databases: NPCs, locations, factions, quests, sessions, items, PCs, lore. Relations connect DBs (NPC → Faction → Location). Filtered views drive dashboards like "NPCs in this city" or "unresolved hooks."

**Strengths.** Fastest path to a working binder with a template — "works in 30 minutes." Real-time collaboration and permissions are strong, including read-only player access. Best cross-device consistency. Notion AI helps draft NPC bios / recaps. Deep template marketplace.

**Weaknesses.** Performance degrades with scale (large DBs, many rollups). Mobile is the weakest. Offline is heavily constrained. Reorganizing mid-campaign is painful. Data lives on Notion's servers with no round-trip export. Sly Flourish's public move *away* from Notion to Obsidian (citing ownership and sync friction) is a high-signal departure [S].

**User sentiment.** Accidental adoption — DMs bring the tool they use at work. Power users love relations/rollups; long-term campaign DMs eventually hit friction and migrate.

**SWOT.**
- **S:** Relational databases (unique in this lineup); collaboration; templates.
- **W:** Performance at scale; lock-in; offline weak; reorganization drag.
- **O:** Notion AI integrated with campaign state could be strong — but Notion is unlikely to build TTRPG-specific features.
- **T:** TTRPG-specific competitors with AI and real relational modeling.

---

### D.13 StartPlaying.games

**Overview.** Dominant marketplace for paid professional GMs. Founded 2020, raised $6.5M seed from a16z in May 2022 [F]. Self-reports 80k+ players and $13M+ cumulative GM earnings (treat as company-reported [U]). **Take rate: ambiguous in their own copy** — help center currently shows 15%, other pages / recent blog copy show 10% (90/10 split). Likely undergoing transition [U]; founder should verify directly before relying on a specific number. Plus Stripe fees.

**Core capabilities.** GM listings, system/price filtering, booking + calendar, integrated Stripe payments, automatic recurring session charges, reviews, GM Discord community. GMs bring their own VTT (Roll20, Foundry, Owlbear, Discord, Zoom).

**Pricing behavior of the market.** Typical $15–$20/seat; $30+ is premium; some charge $120+ for full-table flat rates. Players charged one hour after session's listed start. Free cancellation up to 24 hours before start; refunds outside that require support intervention.

**Strengths.** Category-defining brand — "StartPlaying" is almost synonymous with paid D&D. Light onboarding for GMs (free to list). Handles the scariest parts of running a paid game: payments, recurring charges, reminders. Active GM Discord for peer support.

**Weaknesses.** Trustpilot/EN World pattern: GMs complain about the **review policy** — a negative review from a player who never surfaced issues mid-campaign cannot be contested [S]. Players complain about unprepared GMs, ghosting, disorganized onboarding (StartPlaying's own blog identifies this as the #1 cause of bad reviews [F]). The platform **ends at the session door** — no prep, lore, encounter design, character management, or game-running support [I]. Some GMs resent the 10% cut given the limited tooling.

**User sentiment.** GMs view it as a necessary evil: the only place with liquidity, but not a home.

**SWOT.**
- **S:** Two-sided liquidity; payment infrastructure; brand.
- **W:** No workflow tooling; review-policy grievances; only solves discovery + payments.
- **O:** Extend into GM operations (CRM, prep, recaps) — but they've been at it 5+ years without doing so.
- **T:** A tools-first competitor that bundles discovery as a feature (the Shopify-vs-Amazon playbook applied here). This is the founder's most direct strategic wedge [I].

---

### D.14 DMsGuild + DriveThruRPG (OneBookShelf)

**Overview.** Sister content marketplaces, both under OneBookShelf, now in the Roll20 corporate family post-2024. **DMsGuild** is WotC-licensed — you can legally sell content using WotC IP (Forgotten Realms, Ravenloft, Eberron). **DriveThruRPG** is the broader TTRPG marketplace.

**Revenue share.** DMsGuild: **50% creator / 50% split between WotC and OneBookShelf** [F]. $2 withdrawal fee. DriveThruRPG: **70% exclusive / 65% non-exclusive** for independent publishers; 50% for community-content imprints (e.g., Pathfinder Infinite). $1 withdrawal fee.

**Strengths.** DMsGuild is the *only* place you can legally monetize WotC IP names. DriveThru's 70% is genuinely generous for original content. Reliable long-running payout infrastructure.

**Weaknesses.** **Discoverability is the top creator complaint** [S]. Geek Native's 2025 "Metadata Crisis" analysis argues the storefront's search/filters are inadequate; bestseller charts favor incumbents; new creators are buried. Case studies (Wyatt Trull's "$40k" retrospective, Gallant Goblin retrospective) note real money requires Kickstarter or pre-existing audience — the marketplace alone rarely sustains creators. DMsGuild's 50% rev share feels high vs. DriveThru's 70% or Apple's 70/30.

**User sentiment.** Indispensable for IP access; frustrating for discoverability. Community retrospectives frequently describe the marketplace as "in tatters" for new creators [S].

**SWOT.**
- **S:** DMsGuild's WotC IP moat; DriveThru's scale.
- **W:** Discoverability; rev share (DMsGuild); winner-take-most sales curves.
- **O:** A curated/tool-integrated marketplace (content that auto-imports into your campaign) could flank them without fighting on SEO.
- **T:** Itch.io and Patreon siphoning creators who don't need WotC IP.

---

### D.15 Inkarnate + Dungeon Alchemist (maps)

Treated together because every DM who needs bespoke maps uses both.

**Inkarnate.** Browser-based painting-style map editor. World → region → city → battlemap range. Subscription ~$25/year Pro [F]. Strengths: stylistic range, browser accessibility, asset library. Weaknesses: subscription friction, results depend on artistic skill, *no automatic VTT wall/lighting export — DMs must rebuild walls in the target VTT* [F].

**Dungeon Alchemist.** AI-assisted interior/battlemap generator. One-time Steam purchase. 3D perspective, automatic walls/doors/lighting, **export to Foundry/Roll20 with lighting and walls preserved** [F] — the rare tool that nails the VTT handoff. Weaknesses: higher price, modern-interior-oriented, less range for overland maps.

**Pattern.** DMs commonly own both: Inkarnate for worldbuilding/region, Dungeon Alchemist for weekly battlemaps. Neither integrates with sheets, initiative, or scheduling.

**SWOT (combined).**
- **S:** Category leadership in their slices; strong community content.
- **W:** Still exports images, not fully-integrated scenes (Inkarnate especially).
- **O:** AI-driven scene generation with live VTT state is an obvious frontier.
- **T:** An integrated prep tool that includes usable map generation would pull the category inward.

---

## E. Cross-Market Synthesis

### E.1 Fragmentation patterns

**Five representative DM stacks** (synthesized from tool-list posts, comparison blogs, and pro-DM profiles):

1. **Casual 5e hobbyist (modal DM).** D&D Beyond + Discord + Roll20 or Owlbear + Avrae bot (5M+ users, now WotC-owned) + Google Docs or a physical notebook + occasionally Inkarnate.
2. **Foundry power user.** Foundry VTT (self-hosted or Forge) + DDB-Importer (fragile, Patreon-gated for bidirectional) + Beyond20 + Discord + Obsidian + Syrinscape + Inkarnate / Dungeondraft.
3. **Worldbuilding-obsessed DM.** LegendKeeper or World Anvil or Kanka as wiki spine + Obsidian as private scratchpad + Roll20/Foundry as runtime + Campfire or Scrivener for arcs.
4. **Professional paid DM (StartPlaying-based).** StartPlaying (discovery + payment) + Roll20 or Foundry + Czepeku/2-Minute Tabletop Patreon maps + Syrinscape + World Anvil public brochure + Discord + OBS for the streamers.
5. **Lazy GM (Sly Flourish school).** Obsidian + "Lazy DM" template + theatre of mind or Owlbear only + index cards + single session doc. A large, underestimated segment.

**Minimum of 5 tools per campaign; 8+ for pro DMs.** None share state. The most painful handoffs:
- **DDB ↔ VTT character sync** — DDB-Importer is third-party, fragile by its maintainer's own admission; HP/XP drifts between systems after sessions.
- **Notes ↔ runtime** — DMs in Obsidian/Notion during prep, alt-tab to Roll20/Foundry mid-session. No tool surfaces the right note at the right moment.
- **Discord ↔ campaign state** — Sesh, Avrae, Bard Bot, group chat coexist with no shared memory.
- **Map creation ↔ VTT** — most tools export images; walls, lighting, tokens must be rebuilt in the VTT.
- **Character data portability** — DDB owns it, VTT has a copy, Demiplane stores yet another; exports are patchy.

**Workflows not supported anywhere single.** "What do the players actually know?" is effectively unsolved. Session-to-session continuity with NPC voice/name recall for the DM mid-scene is unsupported. True combined prep-and-run loops (where running the session updates your notes) don't exist. Billing + attendance + session notes + player comms for paid DMs is split across StartPlaying + Discord + spreadsheets + Stripe.

### E.2 Repeated pain points (ranked by frequency)

1. **Prep time.** Universal. Sly Flourish built an entire brand ("Lazy DM") on this. New DMs over-prep and burn out; experienced DMs constantly ask "how do I prep less without the session feeling thin?" Single largest addressable pain.
2. **Information retrieval mid-session.** "I can never find my notes at the right moment." Obsidian is the current workaround; even Obsidian users concede it doesn't save them when a player asks about an NPC from six months ago. **This is essentially an unsolved retrieval problem that LLMs are now well-positioned to address.** [I]
3. **Scheduling and attendance.** The widely-cited "60% of campaigns die due to scheduling" stat traces to an informal r/DnD poll [U] — treat as folk wisdom, but directionally agreed on by every GM advice column.
4. **Player onboarding.** Getting players to install the VTT, make DDB accounts, sync characters, find notes, is a recurring bottleneck. Roll20's ease-of-onboarding is the single biggest reason it retains share vs. Foundry's superior features.
5. **Monetization/payment for paid DMs.** StartPlaying is the dominant marketplace but solves only discovery + payments. Off-platform DMs cobble Stripe + calendar + Discord + informal no-show rules. Attendance-tied billing is the sharpest operational gap.
6. **Discovery.** Demand is wildly one-sided: *players* desperately want games; *DMs* don't need discovery help. From a product-strategy view, **discovery is a honeypot** — hard to monetize because players have low ARPU.
7. **Data portability.** Less frequently complained about but structurally important. Roll20's acquisition of Demiplane plus the Wolves of Freeport JV concentrates character data, marketplace content, and VTT in one commercial entity. Foundry and Obsidian are the anti-lock-in refuges.
8. **AI integration.** Bimodal community — enthusiasts share prompts on r/DMAcademy; opponents are vocal about "AI slop" worldbuilding and have enacted subreddit bans. Adoption is inevitable; the battleground is tone and integration quality.

### E.3 Underserved segments

- **New DMs (1st campaign).** **Poorly served.** Decision paralysis ("140 tools in this compendium"). Default to Roll20 + DDB + Discord because those names come up first. Biggest gap: a guided, opinionated onboarding path. Strong founder wedge.
- **Hobbyist long-running campaign DMs.** Reasonably served for the *running* part. **Poorly served for continuity** — remembering what was established 80 sessions ago. Obsidian is the current high-friction workaround.
- **Lore-heavy / worldbuilding-obsessed.** **Over-served in tools but underserved in interoperability.** WA, LK, Kanka, Campfire, Obsidian each own the space at different price/structure points. None bridge well to session runtime. Worldbuilt content rarely makes it into the VTT in queryable form.
- **Professional paid DMs.** **Served** for discovery + payments (StartPlaying). **Unserved** for operations: client CRM, campaign-level billing, recurring scheduling with reminders, session recap delivery, content reuse, IP protection for resellable homebrew. Closest analog to the healthcare-practice-management suite your vision invokes. Caveat: TAM is genuinely small — StartPlaying's ~$13M cumulative GMV implies single-digit thousands of meaningfully-active pro DMs.
- **Players discovering games.** **Severely underserved.** Demand exceeds supply. LFG subreddits, Roll20 LFG, and StartPlaying are the channels; all feel low-quality per users. Gap: matchmaking by play style, schedule overlap, tone, safety tools. But monetizing players directly is hard.
- **Creators selling reusable content.** DMsGuild/DriveThru are dominant but widely complained about — 50% split, winner-take-most, "in tatters" community sentiment. Gap: a distribution + format layer that makes reusable content *play-ready* inside any VTT.

### E.4 Failed / shutdown products — the lessons

- **Astral Tabletop.** Halted active development October 2021; OneBookShelf fully closed it August 2023. Its sunset coincided with the rumored/anticipated WotC VTT — a classic "wait to see if the category gets absorbed" dynamic.
- **Project Sigil.** Announced ~2022; early access February 2025; ~90% of ~30-person team laid off March 2025; formally sunset October 2025; servers shutdown October 31, 2026. Per PC Gamer citing sources: Hasbro's expected "distinct monetization path" never materialized; management was "uninterested" and "constantly moving goalposts." **This is the single most important data point in the entire analysis.** The best-resourced, most IP-advantaged, most distribution-advantaged attempt at an all-in-one D&D platform in history failed inside 8 months.
- **Mythic Table.** Converted from for-profit to open source after the fundraising path failed. Founder documented: a couple of evening developers couldn't scale an infrastructure product. Post-mortem lesson: **VTTs are expensive infrastructure products masquerading as hobby software.**

**Carry-forward lessons for the founder:**
1. **The VTT is not the wedge.** It's been commoditized by Foundry (self-hosted $50 one-time) and Owlbear (free minimal). Competing on runtime is a losing move.
2. **Big bets fail against community trust.** Roll20's 2018 data breach, WotC's OGL fallout (Jan 2023), Sigil's collapse, and Alchemy RPG's mixed post-Kickstarter reception all show the community punishes corporate overreach. A new all-in-one cannot win by being "the official platform" — it must win by being the *best* platform.
3. **Suite-before-integration loses.** Sigil tried to be vertically integrated at launch and died. Foundry's module ecosystem is a kernel that accrued features. Your architecture should be kernel + integrations from day one.

### E.5 AI and the frontier

**Community sentiment is bimodal.** Enthusiasts use LLMs for NPC generation, name lists, random encounters, statblocks, dungeon drafts, session recaps, lore iteration. Skeptics point to hallucinations, loss of creative friction, and LLM-detectable "checklist voice." Moderation has tightened: r/DnD and r/worldbuilding have enacted AI-generated post restrictions; WotC's 2024 DMG had an AI-art controversy.

**AI-native entrants.** Friends & Fables (fables.gg — full AI-GM platform, $20–$40/mo premium), RoleForge (F&F-like), CharGen (15+ generators in a unified prep dashboard), Dungeon Alchemist (semi-AI map gen, accepted). None has broken through to mainstream.

**Where AI is winning.** Prep (one-off asset generation), voice (ElevenLabs for NPC voices in solo prep), recap generation, long-tail "generate me X."

**Where it's not winning.** Live game running, rules adjudication, player-facing content.

**The founder-relevant insight.** The frontier is not "AI GM" but **"AI co-pilot pinned to your campaign state."** The defensibility is the *campaign-specific vector index* — your NPCs, lore, past sessions, unresolved plots. No F&F-style general tool has this tied to the DM's actual notes. This is the closest thing to a genuine AI moat in the category. [I]

### E.6 Market size signals

- Hasbro WotC full-year 2024: ~4% revenue growth [F]. 2025 commentary indicates strong tabletop growth; D&D ~$460M in 2025 [journalist estimates, treat as directional].
- Third-party estimates: TTRPG market ~$1.8–$2.4B globally 2025, projected to $5–$7B by 2033–2035 at ~11–13% CAGR [syndicated reports; methodology not transparent; treat as trendline].
- D&D ≈ 50%+ of RPG spend; Pathfinder is a distant second.
- Community scale: r/DnD ~3M+, r/DMAcademy ~500k+, r/rpg ~2M+. Avrae claims 5M+ users across 500k+ Discord servers — the single most install-rich tool in the DM stack.

**Interpretation.** The addressable user base is very large, but willingness-to-pay is extremely long-tailed: millions of casuals at $0–$10/mo, a committed middle class at $10–$30, and a tiny pro tier that would pay $50+. **Any all-in-one must pick a segment before building the suite.**

### E.7 White space summary

In order of conviction:

1. **Campaign state + prep-to-run loop with AI co-pilot.** Own the DM's canonical campaign data; integrate with VTTs; layer a pinned LLM. Defensibility: the index.
2. **Pro-DM operations.** Attendance-linked billing, CRM, scheduling, recaps, content reuse. Complements StartPlaying discovery rather than fighting it.
3. **Opinionated onboarding for new DMs.** A guided first-campaign experience that answers "which tools?" by giving you one. This is a distribution play more than a tech play.
4. **Tool-integrated content marketplace** (long-term, after platform traction). Content that auto-imports into the platform — bypasses the DMsGuild discoverability crisis.
5. **Neutral character/continuity spine.** Holds state across VTTs, DDB, and Demiplane. Adjacent to (1).

---

## F. Strategic Recommendation

### F.1 The all-in-one hypothesis — my honest read

**Qualified yes, with strong caveats.** The fragmentation is real; the unmet needs are real; no incumbent is positioned to unify. But the naive version — "we replace your whole stack" — is what Hasbro tried with Sigil, with better resources and better IP than any startup will have, and it failed publicly and quickly. The defensible version is **kernel-plus-ecosystem**: own the one layer no one else does (campaign state / prep-to-run loop), be the best possible citizen of the other layers (DDB, Foundry/Roll20, Discord, StartPlaying), and extend only when you've earned the right.

**Where the NextGen/ClinicMind analogy breaks.** Medical practices are *forced* into suites by payer and regulatory pressure. DMs have no such pressure. They stay fragmented by preference. A suite that is merely unified will not win; a suite that is demonstrably better at the moments that hurt most (prep, mid-session retrieval, onboarding, scheduling, pro-DM ops) will.

### F.2 The strongest opportunity

**"Campaign Operating System" — a state-owning platform for the DM, centered on a prep/run loop and an AI co-pilot pinned to that state, with a pro-DM business layer as the monetization wedge.**

Concretely:
- **Core product:** the DM's canonical campaign — NPCs, factions, locations, lore, session history, player knowledge state — with structured data and a vector index.
- **Prep mode:** AI co-pilot that drafts NPCs/encounters/recaps grounded in *your* campaign, not a generic world.
- **Run mode:** session-time retrieval, initiative/statblock surface, "what did the player already know?" query.
- **Integrations:** DDB for rules/sheets; Foundry/Roll20/Owlbear for maps; Discord for comms; StartPlaying for discovery initially.
- **Pro-DM layer (sellable first):** attendance-linked billing, recurring scheduling, client CRM, recap delivery, contract/policy templates.
- **Player touch (later):** lightweight player-facing site with recaps, what-you-know, calendar.

### F.3 Three to five strategic bets

1. **Build the campaign-state vector index as the core primitive.** Everything else is a surface on top. This is your moat.
2. **Ship pro-DM operations as the first paid product.** High ARPU, narrow segment, vocal testimonials, fastest path to paid usage. Even if pro-DM never becomes the whole business, it funds the platform and creates brand.
3. **Integrate aggressively with D&D Beyond and Foundry from day one.** Do not clone the compendium. Do not clone the VTT. Both are traps that kill startups.
4. **Bet on AI co-pilot as the retention hook, not the novelty.** The lock-in is your campaign being indexed; the utility is retrieval and drafting grounded in *that* campaign. This is genuinely defensible if done well.
5. **Pick 5e *and* PF2e from the start; add Daggerheart/Shadowdark as fast followers.** Demiplane's multi-system breadth is a hedge against WotC risk and captures the growing alt-system audience. 5e-only is a strategic concentration risk given OGL scar tissue.

### F.4 What not to build first

- **Do not build a VTT.** It's commoditized (Foundry, Owlbear) and incumbents that tried (Astral, Sigil, Mythic Table) failed. Foundry's module ecosystem is a ~5-year head start. Integrate, don't rebuild.
- **Do not build a content marketplace first.** Two-sided liquidity is brutal. Earn platform traction with DMs, then add a tool-integrated marketplace as an extension.
- **Do not compete with StartPlaying on discovery first.** Players have low ARPU; matching GMs and players is expensive; StartPlaying owns the brand. Serve *GMs* first; discovery becomes a feature later.
- **Do not reproduce D&D Beyond's compendium.** WotC licensing, legal risk, and commoditized core. Treat DDB as an integration partner.
- **Do not build a generic AI GM.** Friends & Fables et al. are already there. Your wedge is AI *grounded in the DM's canonical campaign*, not a generic text adventure.
- **Do not build a Notion competitor.** The flexibility-vs-TTRPG-specificity tradeoff is already solved by Notion (generic) vs. Kanka/LK/WA (specific). Winning a fight on either axis means re-fighting years of incumbents.

### F.5 Risk register

- **Community trust.** Every "official" / "big-money" entrant has had a rough reception. Launch under a real community brand and be a good citizen (OSS some parts, be transparent about AI usage, honor data portability). Foundry's one-time price is a cultural norm — a subscription-only product will meet resistance unless the pro-DM angle is clear.
- **TAM concentration.** Pro-DM alone is a small market (low thousands of meaningful users). The bet is that pro-DM ops is the beachhead and the hobbyist prep/run loop is the expansion. Validate expansion hypothesis early.
- **Hasbro/WotC moves.** D&D Beyond could finally ship a competent Campaign Console (they've missed this for years but might not forever). Multi-system from day one hedges this.
- **AI skepticism.** Be opinionated about where AI is on, opt-in, or off. "AI on by default" will attract enemies; "AI off by default, opt-in per surface" builds trust.
- **Sequencing risk.** Vertical integration beats bundling beats marketplace. If you try to do all three at once, you will execute none of them well.

### F.6 The one-sentence summary

**Own the DM's canonical campaign state; layer an AI co-pilot and pro-DM operations on top; integrate with the rest of the ecosystem rather than replace it.**

---

## Methodology & Caveats

**What this report is.** Synthesis of (a) targeted web research performed April 2026 across EN World, RPG PUB, RPGnet, Trustpilot, D&D Beyond forums, Sly Flourish, phD20, Nicole van der Hoeven, Geek Native, StartPlaying's own blog and help center, Bell of Lost Souls, PC Gamer, Gizmodo, Engadget, TechRaptor, Wargamer, and each product's official site; (b) creator blogs and tool-list retrospectives from 2024–2026; (c) analyst inference clearly labeled.

**What this report is not.** It is not primary behavioral data. It is not independently audited — market-size numbers, StartPlaying GMV, WotC D&D revenue estimates, and user-count claims are all company-reported or journalist-estimated. Reddit sentiment was surfaced mostly through creator posts and SERP snippets; a founder considering meaningful investment should commission a proper survey of r/DMAcademy, r/rpg, and r/DnD DMs, plus 10–20 qualitative interviews with paid DMs.

**Key uncertainties flagged.** Alchemy RPG's current corporate traction; Owlbear v1 sunset status; **StartPlaying's current take rate is inconsistent in their own public copy (10% vs. 15%)** — verify directly before citing; Demiplane's post-Roll20 roadmap; the "60% of campaigns die due to scheduling" figure (folk wisdom, not a study); all TTRPG market-size numbers; VTT research in this report relies more on training knowledge than live web verification for the five VTT profiles — treat those sections as directionally sound but verify pricing and ownership specifics before a board deck.

---

## Sources (selected)

**Product sites:** worldanvil.com, kanka.io, legendkeeper.com, obsidian.md, notion.com, dndbeyond.com, demiplane.com, foundryvtt.com, app.roll20.net, fantasygrounds.com, owlbear.rodeo, alchemyrpg.com, startplaying.games, dmsguild.com, drivethrurpg.com, inkarnate.com, dungeonalchemist.com, fables.gg.

**Industry / community:**
- [StartPlaying Help Center — GM fees (90/10 split)](https://intercom.help/startplaying/en/articles/8719032-how-much-does-startplaying-charge-gms)
- [StartPlaying — The #1 Reason Pro GMs Get A Bad Review](https://startplaying.games/blog/posts/pro-game-master-bad-review-why)
- [StartPlaying $6.5M Seed (PRNewswire)](https://www.prnewswire.com/news-releases/startplaying-announces-6-5m-seed-round-funding-from-andreessen-horowitz-301546624.html)
- [D&D Beyond — 2026 Development Roadmap](https://www.dndbeyond.com/posts/2132-d-d-beyonds-2026-development-roadmap)
- [D&D Beyond — Closing the Chapter on Sigil](https://www.dndbeyond.com/posts/2086-closing-the-chapter-on-sigil-and-thanking-the)
- [PC Gamer — Hasbro pushed Sigil out of the nest](https://www.pcgamer.com/games/hasbro-pushed-sigil-out-of-the-nest-d-and-ds-latest-layoffs-happened-because-the-distinct-monetization-path-for-its-virtual-tabletop-sigil-never-materialized/)
- [Gizmodo — D&D Sigil VTT canceled](https://gizmodo.com/dnd-sigil-vtt-canceled-hasbro-wizards-of-the-coast-2000578128)
- [Engadget — Hasbro laid off Sigil team](https://www.engadget.com/gaming/hasbro-laid-off-the-team-behind-its-virtual-tabletop-app-only-weeks-after-it-was-released-214024876.html)
- [Geek Native — DMsGuild Metadata Crisis (2025)](https://www.geeknative.com/219892/the-unofficial-best-selling-2025-dmsguild-analysis-the-metadata-crisis/)
- [Demiplane — Roll20 Acquires Demiplane](https://www.demiplane.com/blog/roll20-acquires-demiplane)
- [Roll20 & OneBookShelf joint venture](https://blog.roll20.net/posts/roll20-onebookshelf-are-uniting-the-party/)
- [Arkenforge — Farewell to Astral Tabletop](https://arkenforge.com/farewell-to-astral-tabletop/)
- [Mythic Table — Absence and Update](https://www.mythictable.com/blog/announcement-2024/)
- [Numtini — Alchemy VTT: Changing Gold Into Lead (Jan 2025)](https://www.numtini.com/2025/01/14/alchemy-vtt-changing-gold-into-lead/)
- [Wargamer — The meteoric rise of the professional DM](https://www.wargamer.com/dnd/professional-dungeon-master)

**Creator / DM-community blogs:**
- [Sly Flourish — Using Obsidian for Lazy RPG Prep](https://slyflourish.com/obsidian.html)
- [Sly Flourish — Using Notion for Lazy RPG Planning](https://slyflourish.com/lazy_dnd_with_notion.html)
- [Nicole van der Hoeven — Non-Lazy DMs use Obsidian](https://nicolevanderhoeven.com/blog/20210930-non-lazy-dms-use-obsidian-for-dnd/)
- [phD20 — Ultimate Guide to TTRPG Campaign Managers 2025](https://phd20.com/blog/ultimate-guide-ttrpg-campaign-managers/)
- [CharGen — 2025 DM & Player Tool Compendium](https://char-gen.com/blogs/ultimate-2025-dm-player-tool-compendium)
- [LegendKeeper — The best DM tools of 2025](https://www.legendkeeper.com/the-dm-tools-of-2024-finding-the-tools-for-your-table/)
- [Blog of Holding — Dungeon Alchemist, #1 Map Software](https://blog-of-holding.ca/2025/05/25/dungeon-alchemist-1-map-making-software/)

**Forums / community discussion:**
- [EN World — The best campaign management software](https://www.enworld.org/threads/the-best-campaign-management-software-for-tabletop-rpgs.667228/)
- [EN World — My 3+ years with paid D&D tools](https://www.enworld.org/threads/my-experience-with-paid-d-d-tools-after-3-years-as-a-dm-player.714161/)
- [RPG PUB — Great VTT Poll of 2025](https://www.rpgpub.com/threads/great-vtt-poll-of-2025.11515/)
- [RPGnet — Kanka campaign manager](https://forum.rpg.net/threads/kanka-the-best-rpg-campaign-manager-ive-ever-seen.858418/)
- [D&D Beyond Forums — Maps Roadmap 2025 off track?](https://www.dndbeyond.com/forums/d-d-beyond-general/d-d-beyond-feedback/232269-maps-roadmap-2025-off-track)
- [D&D Beyond Forums — Professional DM Tapping Out](https://www.dndbeyond.com/forums/d-d-beyond-general/d-d-beyond-feedback/218816-professional-dm-tapping-out-i-cant-take-it-anymore)

*Full source list available in the research agents' outputs used to compile this report.*
