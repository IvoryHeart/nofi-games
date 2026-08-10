# Market brief: first research-selected game

## Research frame

- **Status:** opportunity research only. No audience, game, concept, genre, premise,
  mechanic, or implementation has been selected.
- **Research question:** What player needs and original game-opportunity spaces should
  Nofi investigate first for one cross-platform web/desktop/Android/iOS app,
  maximizing player value, cross-platform fit, measurable learning, and continuous
  agent improvement—without using monetization as the selection signal?
- **Evidence cutoff:** 2026-08-10 (Europe/London). Web sources were collected through
  2026-08-10T10:52+01:00. Living documents and live catalog counts are snapshots at
  that cutoff.
- **Permitted conclusion:** rank opportunity spaces and state questions that could
  discriminate among later concepts. Selection and design remain unresolved.
- **Excluded signals:** revenue, spending, valuation, downloads without a player-value
  measure, fixture archetypes, legacy Nofi games, store charts with opaque methods,
  uncited recollection, and familiarity with existing mechanics.
- **Run provenance:** source commit `5346194243da1dde03cac8b51025ef08724395a1`;
  branch `agent/codex/first-research-selected-game/opportunity-research`; native Codex
  CLI `0.147.0`; task class `high-judgment`; configured model `gpt-5.6-sol` with
  `xhigh` reasoning. The resolved model was not exposed separately by the harness.
  Raw native transcript: `/var/tmp/nofi-first-game-research-sol.jsonl` (retained
  outside Git).

### How to read claims

- **Observation** reports what a cited source measured, documented, or required.
- **Inference** connects multiple observations to Nofi's constraints. It is a claim to
  test, not a fact about players.
- **Speculation** is a plausible but weakly evidenced whitespace hypothesis. It is
  included only when paired with a falsification question.
- Evidence strength is contextual: **strong** means fit for the stated observation,
  not proof of a market. Official policy and engine documentation are authoritative
  for constraints but provide no demand evidence. Large self-report surveys describe
  reported attitudes, not causal wellbeing effects.

## Executive finding

The most defensible starting point is not a genre. Across differently sponsored and
independent evidence, recurring player jobs are: experience positive affect or relief,
exercise agency and competence, fill or reclaim a bounded interval, and—depending on
audience—connect, express, explore, or keep the mind active. Mobile is the broadest
single access route, but players commonly use several device classes. That combination
supports investigating experiences whose value survives touch, pointer, keyboard,
small screens, interruptions, and imperfect networks.

The strongest first investigation is the intersection of **reclaimable sessions** and
**restorative mastery**: an experience that can produce agency, positive affect, and a
felt endpoint without coercing continuation. The second is **cross-context continuity**:
preserving a meaningful player relationship across short mobile moments and more
deliberate web/desktop sessions. These are opportunity spaces, not game concepts; many
genres and systems could satisfy or fail them.

Two reserves deserve concept-stage probes: **private expressive agency** (creative or
identity value without public-performance and moderation costs) and **age-flexible
cognitive confidence** (legible challenge and accomplishment without therapeutic or
“brain training” claims). Generic “relaxing,” “puzzle,” “casual,” “short,” or “cozy”
positioning is not whitespace: live Steam catalog metadata shows crowded adjacent
labels, while current release volume makes attention scarce. A later concept must
distinguish itself by a testable player promise and original expressive/systemic
identity, not a label or art reskin.

This recommendation is deliberately tempered. Industry surveys report perceived
stress relief and stimulation, while a large independent study using objective play
time found little evidence that more or less play causes average wellbeing changes.
Social play is important to many younger players, yet single-player value also matters,
online harassment is common among US teens, and public social systems create a much
larger safety and operating burden. Those contradictions make “positive value during a
chosen session” a better first claim to test than health improvement, maximum
engagement, or community scale.

## Evidence register

All links below are direct publisher, paper, policy, documentation, or live-data URLs.
“Collected” means collected by this research run, not the source's field date.

| ID  | Source, publisher, publication date; collection date                                                                                                                                                                                                                                                                                                                                              | Geography and population/sample                                                                                                                                                                                                                                                                                                              | Method and relevant observation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Strength                                                                                                                 | Limitation                                                                                                                                                                                                                                           |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E01 | [2026 Essential Facts About the U.S. Video Game Industry](https://www.theesa.com/resources/essential-facts-about-the-us-video-game-industry/2026-data/), Entertainment Software Association, 2026-06-03 ([direct PDF](https://www.theesa.com/wp-content/uploads/2026/06/2026-Essential-Facts-Booklet-05-27-26.pdf)); collected 2026-08-10                                                         | United States; 13,545 people age 5–90: 9,932 players (1,961 age 8–17 and 7,971 adults) and 3,613 nonplayers. Players used phone/tablet, PC, console, or VR at least one hour/week.                                                                                                                                                           | YouGov 20-minute online panel survey, 2026-02-11–25; weighted to US population and player distributions. Reports 67% play, average player age 37, broad gender balance; adults most often cite fun and relaxation (66% each), then mental sharpness (32%). New-game considerations excluding price include gameplay quality (47%), story/premise (41%), genre (41%), single-player play (37%), known series (30%), existing IP (16%), and online multiplayer (15%).                                                            | **Moderate–strong** descriptive US evidence: large sample, disclosed fieldwork and weighting.                            | Trade-association sponsored; self-report and parent-assisted youth responses; one country; perceived benefits are not causal outcomes. “Importance” is stated consideration, not observed choice.                                                    |
| E02 | [Power of Play: 2025 Global Report](https://www.theesa.com/resources/the-global-power-of-play-report/), ESA and partner trade associations, 2025-10-08 ([direct PDF](https://www.theesa.com/wp-content/uploads/2025/09/PoP-2025-v10-web-spreads.pdf)); collected 2026-08-10                                                                                                                       | 24,216 active weekly players age 16+ in Australia, Brazil, Canada, China, Egypt, France, Germany, India, Italy, Japan, Mexico, Nigeria, Poland, Saudi Arabia, South Africa, South Korea, Spain, Sweden, UAE, UK, and US; at least 1,000/country.                                                                                             | AudienceNet survey using accredited panels and nationally representative active-player samples. Favorite device: mobile 55%, PC/laptop 21%, console/handheld 21%, VR 2%. Fun, stress relief/relaxation, and mental stimulation recur; perceived connection benefits are much more common below age 35 than above 55.                                                                                                                                                                                                           | **Moderate** cross-geography attitudinal evidence with unusually broad reach and disclosed country bases.                | Industry sponsored; weekly-player sampling excludes nonplayers/lapsed players; self-reported perceived benefit; field dates and country-weighted global aggregation are not disclosed, so “global” percentages are not population estimates.         |
| E03 | [Australia Plays 2025](https://research.bond.edu.au/en/publications/australia-plays-2025/), Bond University and Interactive Games & Entertainment Association, 2025-09-08 ([direct PDF](https://igea.net/wp-content/uploads/2025/08/AP25-Report-28_08-WITH-LINKS.pdf)); fielded May 2025; collected 2026-08-10                                                                                    | Australia; 1,241 adult household respondents, including 394 parents. Player-behavior base 1,309 adults and nominated household members; household demographic/player-status base 2,549.                                                                                                                                                      | Random Qualtrics XM panel; over 80 questions; stated maximum margin of error 2.7%. Reports broad play through older age, multi-device households, and recurring jobs of fun, relaxation, passing time, taking a break, challenge, accomplishment, building/exploring, and story. Solo play rises with age; challenge and mental-health-maintenance are relatively salient among players 65+.                                                                                                                                   | **Moderate–strong** national descriptive evidence with clear bases, field date, and age comparisons.                     | University/industry collaboration; self-report and nominated-household proxy; one country; benefits are perceptions. Some findings use different denominators.                                                                                       |
| E04 | [Key Facts 2024](https://www.videogameseurope.eu/wp-content/uploads/2025/10/VGE-2024-Key-Facts-Report_102025.pdf), Video Games Europe, October 2025; data year 2024; collected 2026-08-10                                                                                                                                                                                                         | France, Germany, Italy, Spain, UK; people age 6–64. GameTrack runs 1,000 online interviews/country/month (60,000/year) and a 1,000-person/country annual face-to-face calibration sample age 18+.                                                                                                                                            | Ipsos GameTrack plus GSD/EGDF-VGE sources. Reports 54% of ages 6–64 play, average player age 31, average 9.4 hours/week, and device reach among players of mobile/tablet 71%, console 59%, PC 43%.                                                                                                                                                                                                                                                                                                                             | **Moderate–strong** for five-market reach/platform mix; sustained polling and calibration are disclosed.                 | Trade-association sponsored; publication lags measurement; five markets are not all Europe; platform percentages are multi-select and not preference; no unmet-need measure.                                                                         |
| E05 | [CESA Game Industry Report 2025 summary](https://www.cesa.or.jp/action/industry-research/2025/), Computer Entertainment Supplier's Association, 2025-12-15; reports 2024; collected 2026-08-10                                                                                                                                                                                                    | Japan; estimated player populations: mobile 42.78 million, console 29.51 million, PC 14.52 million.                                                                                                                                                                                                                                          | Public summary of CESA's annual market/player research; reports mobile and console player estimates declined slightly from the preceding year while PC rose slightly.                                                                                                                                                                                                                                                                                                                                                          | **Contextual** regional triangulation: primary industry body and current Japan-specific figures.                         | Full 462-page method/report is paywalled; sample, recruitment, weighting, uncertainty, and overlap among platform estimates are unavailable. It cannot rank needs.                                                                                   |
| E06 | [Teens and Video Games Today](https://www.pewresearch.org/internet/2024/05/09/teens-and-video-games-today/), Pew Research Center, 2024-05-09; fielded 2023-09-26–10-23; collected 2026-08-10                                                                                                                                                                                                      | United States; 1,423 teens age 13–17 recruited through parents in Ipsos KnowledgePanel and weighted nationally. The page's introductory metadata elsewhere says 1,453, an internal discrepancy retained as a limitation.                                                                                                                     | Probability address-based online panel. Among teen players, 87% say fun is a major reason, 72% cite spending time with others at least sometimes, and 50% cite learning something at least sometimes (13% major). Devices span console 73%, smartphone 70%, desktop/laptop 49%, tablet 33%; 76% use at least two device classes. Negative evidence: 41% say gaming hurt sleep and 43% have experienced harassment or bullying while playing.                                                                                   | **Strong** independent, probability-based evidence for US teens, including benefits and harms.                           | One country and age band; self-report; parent recruitment; subgroup uncertainty; the sample-count inconsistency reduces reproducibility unless clarified by Pew.                                                                                     |
| E07 | [Responsible Innovation in Technology for Children: Digital Technology, Play and Child Well-being](https://www.unicef.org/innocenti/reports/responsible-innovation-technology-children), UNICEF Innocenti, 2024-04-29 ([method summary](https://www.unicef.org/innocenti/press-releases/video-games-can-have-positive-impact-children-if-they-are-designed-right-says-new)); collected 2026-08-10 | Children/families in Australia, Chile, Cyprus, South Africa, UK, and US. Intervention: 255 children age 8–12; longitudinal home observation: 50 families with children age 6–12; lab study: 69 children age 7–13.                                                                                                                            | Mixed methods: multiweek intervention, 14-month home observations, and lab play with physiological/attention measures. Finds that outcomes depend on design; autonomy/choice, competence/mastery, relatedness, emotional regulation, creativity, and identity can support child wellbeing, while safety is foundational.                                                                                                                                                                                                       | **Strong for mechanism discovery**, with multiple methods and geographies rather than a single questionnaire.            | Narrow selected games and age ranges; small qualitative/lab bases; LEGO Foundation funding may align incentives; not prevalence evidence and not generalizable to adults or every game.                                                              |
| E08 | [Time spent playing video games is unlikely to impact well-being](https://ora.ox.ac.uk/objects/uuid%3A681f8e3b-6ccc-4549-ad0e-64f4e561937a), Oxford Internet Institute, published in _Royal Society Open Science_ 2022-07; collected 2026-08-10                                                                                                                                                   | Approximately 38,935 adult players across seven participating games; countries were not reported as a representative geographic frame.                                                                                                                                                                                                       | Six-week longitudinal study combining repeated wellbeing surveys with objective play data donated by game/platform companies. Finds little evidence that average play time causes positive or negative wellbeing changes; any average effects are likely small.                                                                                                                                                                                                                                                                | **Strong contradictory evidence** because behavior is objective and longitudinal rather than recall alone.               | Opt-in participants, seven selected titles, short window, attrition and industry data partnerships; average effects may hide subgroups; time played does not measure experience quality.                                                             |
| E09 | [Affective Uplift During Video Game Play: A Naturalistic Case Study](https://ora.ox.ac.uk/objects/uuid%3A399a3c8f-711f-4168-9008-5d762d8a4570/files/rf1881n11m), Oxford Internet Institute/Tilburg University, August 2024 ([metadata](https://nickballou.com/publication/2024-vuorre-et-al-affective/)); data collected through March 2023; collected 2026-08-10                                 | 8,695 opted-in PC owners in 39 countries; 67,328 sessions and 162,325 in-game mood reports, all within one commercial game.                                                                                                                                                                                                                  | Naturalistic repeated in-session measurement. Average reported mood rose 0.034 on a 0–1 scale from session start; modeled uplift occurred in 72.1% of sessions and was concentrated in the first 15 minutes.                                                                                                                                                                                                                                                                                                                   | **Strong feasibility evidence** for high-frequency, in-session evaluation using a large behavioral panel.                | One title and self-selected PC owners; repeated self-report; observational design cannot establish the game caused uplift; effect is small and cannot be generalized to other experiences.                                                           |
| E10 | [Validating Motives of Autonomous Players (MAP) inventory](https://link.springer.com/article/10.1007/s11257-025-09431-7), _User Modeling and User-Adapted Interaction_, 2025-03-30; collected 2026-08-10                                                                                                                                                                                          | UK open-ended sample: 402 adults age 18–70 yielding 1,648 motive statements; UK exploratory-factor sample: 600; US confirmatory sample: 600 (582 complete), recruited through Prolific.                                                                                                                                                      | Bottom-up content analysis, expert review, exploratory then confirmatory factor analysis. The validated 34-item, nine-factor model distinguishes underlying motives—affective engagement, escapism, boredom, immersive agency, competitive mastery, social, utility, nostalgia, addiction—from genre, activity, and aesthetic preferences. CFA fit was acceptable/good (RMSEA .046, CFI .941, TLI .933, SRMR .051). Mobile-heavy players differed from PC/console-heavy players, including relatively greater boredom motives. | **Strong conceptual/measurement evidence**: peer reviewed, bottom-up, cross-sample validation, explicitly genre-neutral. | Convenience panel of interested occasional players; only UK/US; motives do not directly measure unmet need, actual choice, or satisfaction; authors call for further cross-cultural validation.                                                      |
| E11 | [Disengagement from Games: Characterizing the Experience and Process of Exiting Play](https://research.tue.nl/en/publications/disengagement-from-games-characterizing-the-experience-and-proces-2/), ACM CHI PLAY 2024, 2024-10 ([full paper](https://pure.tue.nl/ws/portalfiles/portal/353473653/3677066.pdf)); collected 2026-08-10                                                             | Online, geography not established as representative; interviews with 16 players followed by survey of 111 players.                                                                                                                                                                                                                           | Exploratory qualitative themes followed by a survey. Positive, self-determined endings and practical exit support such as saving are associated with a better exit experience; multiplayer contexts make stopping harder.                                                                                                                                                                                                                                                                                                      | **Moderate mechanism evidence** for a neglected part of a session and a concrete evaluation construct.                   | Small, self-selected samples; geography and population representativeness are weak; exploratory associations, not causal demand.                                                                                                                     |
| E12 | [Gaming disorder FAQ](https://www.who.int/standards/classifications/frequently-asked-questions/gaming-disorder), World Health Organization, living ICD-11 guidance (date not stated); collected 2026-08-10                                                                                                                                                                                        | Global clinical/public-health scope; no survey sample.                                                                                                                                                                                                                                                                                       | Expert evidence review underlying ICD-11. Gaming disorder requires impaired control, increasing priority over other activities, continuation despite negative consequences, significant impairment, and normally at least 12 months.                                                                                                                                                                                                                                                                                           | **Authoritative safety definition**, not an opportunity signal.                                                          | No prevalence or ordinary-player behavior estimate; diagnostic scope should not be used to pathologize normal play or infer a specific design effect.                                                                                                |
| E13 | [Online Nation 2024](https://www.ofcom.org.uk/siteassets/resources/documents/research-and-data/online-research/online-nation/2024/online-nation-2024-report.pdf), Ofcom, 2024-11; collected 2026-08-10                                                                                                                                                                                            | United Kingdom; combines Adult Media Literacy 2023 (3,643 adults), Children and Parents 2023 (2,949 families), and Ampere Q2 2024 gamers age 16–64, among other panels.                                                                                                                                                                      | Regulator synthesis of survey and commercial measurement. Reports 52% of people 16+ played in 2023, 90% of children 3–15 played, and substantial multi-device behavior: only 23% of smartphone gamers were smartphone-only, 19% console-only, and 8% PC-only.                                                                                                                                                                                                                                                                  | **Moderate** independent UK triangulation, especially for device overlap.                                                | Mixed sources, dates, denominators, and method changes; Ampere base details are not fully public; cannot compare trend points cleanly or establish unmet need.                                                                                       |
| E14 | [Steam releases](https://steamdb.info/stats/releases/) and [Steam tag catalog](https://steamdb.info/tags/), SteamDB, live independent tracker; collected 2026-08-10                                                                                                                                                                                                                               | Worldwide Steam PC catalog; products and community/developer tags rather than a player sample. Snapshot: 15,163 releases in 2026 to date, 21,358 in 2025, 18,482 in 2024; tag catalog includes 39,326 “Puzzle,” 29,531 “Relaxing,” 28,654 “Arcade,” 22,293 “Family Friendly,” 5,933 “Replay Value,” 3,679 “Short,” and 2,734 “Word” entries. | Aggregates public Steam metadata and historical app records. Used only as a directional density and discoverability signal.                                                                                                                                                                                                                                                                                                                                                                                                    | **Moderate for live Steam catalog counts; contextual for competition.**                                                  | Unofficial and volatile; PC/Steam only; tags overlap, drift, may be user- or developer-applied, and can include products outside the comparable game set. Tag counts are not demand, quality, discoverability, or an addressable market.             |
| E15 | [More than 19,000 games launched on Steam this year, but almost half have fewer than 10 reviews](https://www.pcgamer.com/gaming-industry/more-than-19-000-games-launched-on-steam-this-year-but-almost-half-have-fewer-than-10-reviews/), _PC Gamer_, 2025-12-12; SteamDB snapshot; collected 2026-08-10                                                                                          | Worldwide Steam releases in 2025: 19,112 at the article's cutoff; 9,327 had fewer than ten reviews and 2,229 had none.                                                                                                                                                                                                                       | Secondary analysis of a SteamDB snapshot. Used as evidence of attention concentration, not player value.                                                                                                                                                                                                                                                                                                                                                                                                                       | **Contextual** independent corroboration of catalog crowding.                                                            | Secondary, one store, point-in-time; review count is affected by age, access, marketing, price, free distribution, and review behavior. Counts differ from later SteamDB totals because cutoffs differ.                                              |
| E16 | [2025 Gaming Report survey release](https://www.prnewswire.com/news-releases/platform-style-games-direct-to-consumer-distribution-drive-far-reaching-shake-up-of-global-gaming-marketbain--company-annual-gaming-report-302527791.html), Bain & Company, 2025-08-12; collected 2026-08-10                                                                                                         | More than 5,000 players in Brazil, Indonesia, Japan, UAE, UK, and US.                                                                                                                                                                                                                                                                        | Commercial survey release. Reports younger players assign relatively more importance to customization, social features, and creativity than to visual fidelity, and often discover games through creators/social channels. Only these nonfinancial observations are used.                                                                                                                                                                                                                                                      | **Contextual–moderate** cross-market counterweight to an exclusively solitary opportunity frame.                         | Questionnaire, field dates, recruitment, bases, weighting, and uncertainty are not public in the release; consultancy framing includes commercial interests. It cannot prove value or whitespace.                                                    |
| E17 | [Exporting for the Web](https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_web.html), Godot Engine stable documentation, living; collected 2026-08-10                                                                                                                                                                                                                          | Global developer documentation; no player sample.                                                                                                                                                                                                                                                                                            | Documents WebAssembly/WebGL 2 Compatibility rendering, lower web performance than native mobile, background-tab pause, audio gesture and feature limits, cookie/private-mode effects on IndexedDB persistence, and unreliable browser gamepad mappings.                                                                                                                                                                                                                                                                        | **Authoritative for current engine constraints.**                                                                        | Documentation can change and may not match the project's future pinned Godot version; browser/device testing is still required. No player-demand evidence.                                                                                           |
| E18 | [Support multiple form factors and input methods](https://developer.android.com/games/develop/all-screens), Android Developers, living; collected 2026-08-10                                                                                                                                                                                                                                      | Android phones, tablets, foldables, ChromeOS, and PC environments; no player sample.                                                                                                                                                                                                                                                         | Platform guidance requires layouts that adapt to aspect ratios/windowing and encourages touch, mouse, touchpad, keyboard, and controller support, including keyboard alternatives for accessibility.                                                                                                                                                                                                                                                                                                                           | **Authoritative Android design constraint.**                                                                             | Guidance is not certification or observed usability, and says nothing about web/iOS equivalence or audience demand.                                                                                                                                  |
| E19 | [Xbox Accessibility Guidelines](https://learn.microsoft.com/en-us/gaming/accessibility/guidelines), Microsoft, updated 2026-03-04; collected 2026-08-10                                                                                                                                                                                                                                           | Cross-disability design and testing guidance developed with disability communities and industry; no prevalence sample.                                                                                                                                                                                                                       | Prescriptive checks cover text, contrast, redundant cues, subtitles, input remapping, difficulty, navigation, time limits, motion, photosensitivity, and mental-health-sensitive design.                                                                                                                                                                                                                                                                                                                                       | **Strong practice standard** for accessibility risk discovery and test design.                                           | Xbox-branded and nonbinding outside its ecosystem; conformance does not prove usability or enjoyment and must be tested with players with disabilities.                                                                                              |
| E20 | [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/), Apple, updated 2026-06-08; collected 2026-08-10                                                                                                                                                                                                                                                                | Apple App Store submissions worldwide; policy, no sample.                                                                                                                                                                                                                                                                                    | Sections 4.1/4.2/4.3 reject copycats, thin experiences, and spam; 4.7 governs software not embedded in the binary, including game-like software, metadata, age-rating, consent, and content-governance duties; 5.2 requires rights.                                                                                                                                                                                                                                                                                            | **Authoritative current iOS distribution constraint.**                                                                   | Review involves interpretation and discretion. The fit of Nofi's downloadable Godot PCK pack model is not resolved by desk research; 4.7's examples emphasize HTML5/JavaScript and mini-apps. Formal review is a prerequisite, not assumed approval. |
| E21 | [Device and Network Abuse policy](https://support.google.com/googleplay/android-developer/answer/16559646), Google Play, living; collected 2026-08-10                                                                                                                                                                                                                                             | Google Play-distributed Android apps worldwide; policy, no sample.                                                                                                                                                                                                                                                                           | Prohibits downloading executable code such as dex/JAR/.so outside Play while describing limited treatment of interpreted code and indirect Android API access.                                                                                                                                                                                                                                                                                                                                                                 | **Authoritative current Android distribution constraint.**                                                               | Application to a Godot app that downloads PCK content requires documented policy/legal review; this brief does not declare compliance. Policies and enforcement can change.                                                                          |
| E22 | [TestFlight overview](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview), Apple, living; collected 2026-08-10                                                                                                                                                                                                                                            | iOS beta distribution: up to 100 internal and 10,000 external testers; builds last 90 days.                                                                                                                                                                                                                                                  | Official beta workflow exposes feedback, sessions, and crashes; the first external build requires review.                                                                                                                                                                                                                                                                                                                                                                                                                      | **Authoritative evaluation-channel capacity.**                                                                           | Opt-in beta cohorts are not representative; review, device coverage, consent, recruitment, and cross-platform identity still require operations.                                                                                                     |
| E23 | [Set up an open, closed, or internal test](https://support.google.com/googleplay/android-developer/answer/9845334), Google Play, living; collected 2026-08-10                                                                                                                                                                                                                                     | Android beta tracks worldwide; no research sample.                                                                                                                                                                                                                                                                                           | Official internal, closed, and open tracks support staged tests and private feedback; eligibility rules vary by account type.                                                                                                                                                                                                                                                                                                                                                                                                  | **Authoritative evaluation-channel capacity.**                                                                           | Track analytics do not establish player value; new personal accounts can face separate tester-duration requirements; cohorts can self-select.                                                                                                        |
| E24 | [Steam Playtest](https://partner.steamgames.com/doc/store/testing), Valve, living; collected 2026-08-10                                                                                                                                                                                                                                                                                           | Steam desktop beta participants; no research sample.                                                                                                                                                                                                                                                                                         | Official low-risk, gated testing via a separate associated app ID without store reviews or wishlist impact.                                                                                                                                                                                                                                                                                                                                                                                                                    | **Authoritative desktop evaluation option.**                                                                             | Nofi ships one player app with packs, not separate public game apps; using this channel must preserve that model. Steam users do not represent web/mobile audiences.                                                                                 |
| E25 | [Facts and Figures 2025](https://www.itu.int/itu-d/reports/statistics/facts-figures-2025/), International Telecommunication Union, 2025-11-17 ([release](https://www.itu.int/en/mediacentre/Pages/PR-2025-11-17-Facts-and-Figures.aspx)); collected 2026-08-10                                                                                                                                    | Global telecom estimates built from national statistical, administrative, and operator data; six billion people online and 2.2 billion offline in 2025.                                                                                                                                                                                      | Harmonized ICT indicators. Reports near-universal mobile-broadband coverage alongside persistent quality and affordability gaps; a data-only mobile-broadband basket is unaffordable in roughly 60% of low- and middle-income countries.                                                                                                                                                                                                                                                                                       | **Strong contextual evidence** for connectivity constraints across geographies.                                          | Not game-player research; national source quality varies; coverage is not affordable/reliable service; no direct evidence that offline play causes preference.                                                                                       |
| E26 | [Copyright and Artificial Intelligence, Part 2 release](https://www.copyright.gov/newsnet/2025/1060.html), US Copyright Office, 2025-01-29, and [Games registration guidance](https://www.copyright.gov/register/tx-games.html), living; collected 2026-08-10                                                                                                                                     | United States legal/policy scope; public-record analysis rather than a population sample.                                                                                                                                                                                                                                                    | Official guidance: game ideas, titles, and methods of play are not themselves copyrightable, while expressive text/art may be; generative-AI output is protected only where a human author determines sufficient expressive elements, such as selection, arrangement, or modification—not from prompting alone.                                                                                                                                                                                                                | **Authoritative US copyright-administration context.**                                                                   | Not legal advice; copyright is only one risk alongside trademark, patent, contract, publicity, and other jurisdictions. Legal protectability is not player-perceived originality.                                                                    |
| E27 | [FTC finalizes changes to the Children's Online Privacy Protection Rule](https://www.ftc.gov/news-events/news/press-releases/2025/01/ftc-finalizes-changes-childrens-privacy-rule-limiting-companies-ability-monetize-kids-data), US Federal Trade Commission, 2025-01-16; collected 2026-08-10                                                                                                   | US online services directed to children under 13 or with actual knowledge; regulatory rulemaking, no sample.                                                                                                                                                                                                                                 | Updated COPPA requirements strengthen parental consent around third-party disclosure, data minimization/retention, and coverage of biometric identifiers. Used only to assess research telemetry and audience-operating burden.                                                                                                                                                                                                                                                                                                | **Authoritative US child-privacy constraint.**                                                                           | Jurisdiction-specific and legally technical; applicability depends on audience, knowledge, data flow, and release details. Counsel review is required. It is not evidence against children valuing play.                                             |

## Observations

### O1 — Reach is broad; context and device are not interchangeable

- [E01](https://www.theesa.com/resources/essential-facts-about-the-us-video-game-industry/2026-data/),
  [E03](https://research.bond.edu.au/en/publications/australia-plays-2025/), and
  [E04](https://www.videogameseurope.eu/wp-content/uploads/2025/10/VGE-2024-Key-Facts-Report_102025.pdf)
  all find play across ages rather than a youth-only population.
- Mobile is the largest single favorite/reach category in the 21-country and five-EU-
  market evidence, but PC and console remain material. US teens commonly use several
  device classes, and UK smartphone gamers are more often multi-device than
  smartphone-only ([E02](https://www.theesa.com/resources/the-global-power-of-play-report/),
  [E06](https://www.pewresearch.org/internet/2024/05/09/teens-and-video-games-today/),
  [E13](https://www.ofcom.org.uk/siteassets/resources/documents/research-and-data/online-research/online-nation/2024/online-nation-2024-report.pdf)).
- **Observation boundary:** device reach does not prove that players want the same
  experience on every device or will transfer play between them.

### O2 — Jobs repeat more reliably than genre preferences

- Fun/positive affect, relaxation or mood management, boredom relief/diversion,
  challenge or competence, and mental stimulation recur in the US, global, and
  Australian surveys ([E01](https://www.theesa.com/resources/essential-facts-about-the-us-video-game-industry/2026-data/),
  [E02](https://www.theesa.com/resources/the-global-power-of-play-report/),
  [E03](https://research.bond.edu.au/en/publications/australia-plays-2025/)).
- The independent MAP work supports treating affective engagement, escapism, boredom,
  immersive agency, mastery, social motives, utility, and nostalgia as general reasons
  for play distinct from genres or mechanics
  ([E10](https://link.springer.com/article/10.1007/s11257-025-09431-7)).
- **Observation boundary:** a frequently reported motive is not necessarily unmet, and
  broad labels can conceal very different desired intensity, session length, and
  difficulty.

### O3 — Audience differences are consequential

- Younger active players report connection benefits more often than older players in
  the 21-country survey; Australian solo play rises with age, while challenge,
  accomplishment, and mental activity remain relevant in older groups. MAP finds
  different relative motives among mobile-heavy versus PC/console-heavy players
  ([E02](https://www.theesa.com/resources/the-global-power-of-play-report/),
  [E03](https://research.bond.edu.au/en/publications/australia-plays-2025/),
  [E10](https://link.springer.com/article/10.1007/s11257-025-09431-7)).
- For US teens, social connection is a common reason to play, but harassment and sleep
  disruption are also common reports
  ([E06](https://www.pewresearch.org/internet/2024/05/09/teens-and-video-games-today/)).
- **Observation boundary:** “all ages” is reach, not a useful first audience definition.
  A later concept must name whose job it prioritizes and which audiences it knowingly
  serves less well.

### O4 — Perceived wellbeing value is credible as a job, weak as a causal promise

- Trade surveys consistently report perceived relaxation, mental stimulation, and
  positive affect. UNICEF's mixed-method research supports autonomy, competence,
  relatedness, emotional regulation, and creativity as plausible child-wellbeing
  mechanisms when design and safety are right
  ([E07](https://www.unicef.org/innocenti/reports/responsible-innovation-technology-children)).
- The independent 38,935-person objective-telemetry study found little evidence that
  time played causes average wellbeing changes
  ([E08](https://ora.ox.ac.uk/objects/uuid%3A681f8e3b-6ccc-4549-ad0e-64f4e561937a)).
  A separate naturalistic study found a small within-session mood uplift in one title,
  mostly early in play, but explicitly could not establish causality or generalize
  ([E09](https://ora.ox.ac.uk/objects/uuid%3A399a3c8f-711f-4168-9008-5d762d8a4570/files/rf1881n11m)).
- **Observation boundary:** Nofi may test immediate player-reported and behavioral value;
  it should not claim treatment, cognitive enhancement, stress reduction, or long-term
  wellbeing from this evidence.

### O5 — Starting and stopping are parts of player value

- Disengagement research finds that voluntary, positive endings and practical exit
  support matter, and that social contexts can make exit harder
  ([E11](https://research.tue.nl/en/publications/disengagement-from-games-characterizing-the-experience-and-proces-2/)).
- WHO's diagnostic boundary focuses on impaired control, displacement of other
  activities, continuation despite harm, and impairment—not ordinary enthusiasm
  ([E12](https://www.who.int/standards/classifications/frequently-asked-questions/gaming-disorder)).
- **Observation boundary:** no representative study in this corpus measures demand for
  “clean exits.” It is a welfare and differentiation hypothesis, not a market-size fact.

### O6 — Broad familiar labels are dense; density is not demand

- At the cutoff SteamDB records a very high annual release flow and tens of thousands of
  entries under “Puzzle,” “Relaxing,” “Arcade,” and “Family Friendly.” A contemporaneous
  2025 snapshot found nearly half of that year's launches had fewer than ten reviews
  ([E14](https://steamdb.info/stats/releases/),
  [E15](https://www.pcgamer.com/gaming-industry/more-than-19-000-games-launched-on-steam-this-year-but-almost-half-have-fewer-than-10-reviews/)).
- **Observation boundary:** Steam tags overlap and Steam is not the whole market. The
  evidence rejects “use a popular label” as an originality or discoverability strategy;
  it does not prove a specific underserved genre.

### O7 — Original premise and single-player value do not require a known IP or public social layer

- In the US survey, gameplay quality and story/premise were more often important to a
  new-game decision than familiarity with a series, existing IP, or online multiplayer;
  single-player play was also material
  ([E01](https://www.theesa.com/resources/essential-facts-about-the-us-video-game-industry/2026-data/)).
- Younger cross-market players also report social, customization, and creativity needs
  ([E16](https://www.prnewswire.com/news-releases/platform-style-games-direct-to-consumer-distribution-drive-far-reaching-shake-up-of-global-gaming-marketbain--company-annual-gaming-report-302527791.html)).
- **Observation boundary:** these sources ask different questions and cannot be reduced
  to “single-player beats social.” They support keeping private and indirect forms of
  expression/connection in the concept set while avoiding the inference that a live
  social platform is mandatory.

## Inferences for Nofi

### Audience jobs and unmet-need hypotheses

| Player job (inference)                                                                | Evidence behind it                                                                                                                                   | Plausible unmet need                                                                                                                       | What is not yet known                                                                                                                                      |
| ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Move into a better-feeling state without surrendering the rest of the day.**        | Affect, fun, relief, boredom/diversion, and early-session uplift recur in E01–E03, E09, E10; exit quality appears in E11.                            | Experiences that combine felt progress with a player-chosen, satisfying stopping point, rather than treating duration as success.          | Whether clean exit materially affects choice, return, or recommendation; which audience and context value it most.                                         |
| **Feel capable and self-directed, with enough challenge to make success meaningful.** | Challenge/accomplishment in E03; agency, competence, and mastery mechanisms in E07 and E10; mental stimulation in E01–E02.                           | Legible challenge that preserves autonomy across ability, age, input method, and available time.                                           | Desired challenge shape and intensity; how to avoid a generic puzzle/brain-training position; transfer across devices.                                     |
| **Continue a valued relationship through changing contexts.**                         | Multi-device use in E04, E06, E13; mobile reach in E02–E05; connectivity and engine constraints in E17, E25.                                         | Continuity that respects interruptions, offline periods, small screens, and later deliberate sessions instead of forcing one session norm. | Direct evidence of unmet cross-device demand; whether continuity is worth account/login friction; acceptable download/storage budget.                      |
| **Express curiosity or identity without public performance.**                         | Creativity/identity/autonomy in E07, immersive agency in E10, and younger-player customization/creativity in E16; harassment counterevidence in E06. | Private or safely shareable expressive value that does not require chat, public UGC hosting, or an always-on community.                    | Adult and older-audience demand; replay value without high authored-content burden; whether private expression feels socially meaningful.                  |
| **Use play as accessible mental activity without a medical claim.**                   | Mental sharpness/stimulation in E01–E03, especially older Australian players; broad-age reach in E01–E04.                                            | Cognitive confidence and accomplishment that remain readable, controllable, and non-stigmatizing across ages and disabilities.             | Evidence from players with disabilities and older players outside wealthy markets; whether crowded cognitive/puzzle alternatives already satisfy the need. |

These jobs can coexist within one person. They are not demographic personas, genre
assignments, or a fixed catalog portfolio.

## Competitive clusters, density, and possible whitespace

| Adjacent cluster                                                                             | Demand evidence                                                                                           | Density and contradiction                                                                                                                                                      | Possible whitespace to test, not assume                                                                                                                          | Burden/risk                                                                                                                                                       |
| -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Broad “relaxing,” “casual,” “cozy,” “short,” puzzle, arcade, and family-friendly positioning | Strong reported affect, relief, boredom, stimulation, and challenge jobs (E01–E03, E10).                  | Steam tags and release volume are dense (E14–E15). A label says little about outcome, agency, or originality.                                                                  | A precise promise linking restorative affect, competence, and self-determined exit; differentiated by an original premise/system rather than surface tone.       | Moderate originality/discovery risk; health-claim risk if “relaxing” becomes therapeutic; easy to optimize shallow engagement instead of value.                   |
| Cognitive challenge, puzzle, word, board, and “brain” experiences                            | Mental stimulation, challenge, and older-player relevance (E01–E03).                                      | Puzzle/word tags are crowded (E14); objective evidence does not justify cognitive-health claims (E08).                                                                         | Age-flexible cognitive confidence measured as comprehension, mastery, and satisfaction rather than claimed cognitive improvement.                                | High sameness risk; accessibility and localization can be difficult; any health or educational claim raises evidence burden.                                      |
| Social, competitive, creator, UGC, and platform-style experiences                            | Teen connection and younger-player creativity/social evidence (E02, E06, E16).                            | Harassment is common among teen players (E06); public social systems make exit harder (E11) and require moderation, reporting, privacy, abuse response, and network operation. | Private expression, indirect/asynchronous social meaning, or artifacts that do not require public interaction—only if later evidence shows they satisfy the job. | Very high safety and ongoing operational burden; youth privacy; network dependency; outside the best first-pack learning surface if public UGC/chat is essential. |
| Narrative, exploration, premise-led, and authored-content experiences                        | Story/premise matters in E01; immersive agency and affective engagement in E10; exploration/story in E03. | Not quantified with a transparent comparable catalog in this corpus. Familiar IP is not required, but attention remains scarce.                                                | An original premise that creates repeatable agency rather than relying solely on authored volume.                                                                | High writing, localization, QA, and content-refresh burden if value depends on continual authored material; replay evaluation can be slow.                        |
| Engagement-loop, idle, streak, and compulsion-oriented experiences                           | Boredom/utility can motivate mobile play (E10), and their behavior is easy to instrument.                 | Easy measurement is not proof of value; impaired control is a safety boundary (E12), and clean exit may itself be valuable (E11).                                              | No affirmative whitespace claim. Treat respectful stopping and voluntary return as countermetrics to engagement.                                                 | High risk of optimizing time/retention against player welfare, especially if later monetization contaminates incentives. Defer as a primary opportunity frame.    |
| Child/family or intergenerational experiences                                                | Very broad child reach (E06, E13); autonomy, competence, creativity, and relatedness mechanisms (E07).    | Children are not one audience; safety outcomes depend on design, and public features compound exposure.                                                                        | Only a later, separately evidenced age-specific hypothesis with child participation and parent/caregiver research.                                               | Highest privacy, consent, age-rating, safeguarding, moderation, and research-governance burden (E20, E27). Do not make it the default audience from reach alone.  |

No transparent, current, public dataset found in this run supports comparable
genre-level supply, satisfaction, or unmet demand across web stores, desktop stores,
Apple, and Google Play. The table therefore identifies crowded clusters and questions;
it does not calculate a market-size or whitespace score.

## Speculations to falsify

These are deliberately separated from the observations and inferences above. None is a
finding about an existing market:

1. **Clean exit could be differentiating, not merely protective.** Players may value an
   experience more when a short visit ends with closure and competence rather than an
   unfinished obligation. E11 makes this plausible but does not establish market demand.
   Falsify it by comparing otherwise equivalent sessions with and without a
   player-chosen resolved ending, measuring ending satisfaction, desired-versus-actual
   duration, recommendation, and unprompted return.
2. **One continuing relationship could be worth cross-device friction.** Multi-device
   reach may translate into desire to continue the same experience across contexts—or
   players may prefer separate games on each device. Falsify it with observed choices
   between context-specific fresh starts, local continuity, and optional synchronized
   continuity; count account/sync abandonment as harm.
3. **Private expression might satisfy part of the social/creative job.** Ownership,
   curiosity, or sharing with a known person may provide meaning without a public feed,
   chat, or creator economy. Falsify it if players seeking connection report isolation,
   do not perceive ownership, or require public response for the activity to matter.
4. **Cognitive confidence could cross age groups without becoming generic.** A legible
   sense of mastery may serve both younger and older adults while avoiding medicalized
   “brain” claims. Falsify it if challenge preferences and access needs diverge so far
   that adaptation erases a coherent promise, or if blind reviewers see only a crowded
   familiar task with new presentation.

## Ranked opportunity spaces to investigate

The ranking uses directional judgments, not pseudo-precise arithmetic. “Learning fit”
means a space can expose repeatable decisions, observable outcomes, controlled variants,
and player-reported value while keeping gameplay state separable from rendering. It is
not a final concept score.

| Investigation order                                     | Opportunity space                                                                                                                                                                | Player-value evidence                                                                                                                     | Cross-platform fit                                                                                                             | Evaluation / agent-learning fit                                                                                                                                                       | Main uncertainty and falsifier                                                                                                                                                                                                                           |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1 — investigate first**                               | **Reclaimable restorative mastery:** the intersection of positive affect, meaningful competence/agency, and a satisfying player-chosen ending.                                   | **Moderate–strong:** recurrent jobs across E01–E03/E10, mechanism support E07, in-session measurement feasibility E09, exit evidence E11. | **Potentially high:** the job is not tied to fidelity, one input, or continuous connectivity, but a concept must prove this.   | **High:** pre/post state, autonomy/competence, time-to-understanding, task recovery, planned-versus-actual exit, voluntary return, and qualitative meaning can be triangulated.       | Generic “relaxing/puzzle” supply is dense. **Falsify** if concepts cannot deliver both competence and clean exit in the first 15–20 minutes, or value collapses on touch/small screens.                                                                  |
| **2 — investigate first**                               | **Cross-context continuity for self-directed challenge:** preserve a meaningful, comprehensible relationship across brief/interrupted mobile use and deliberate web/desktop use. | **Moderate:** multi-device and mobile reach are strong; the continuity need itself is inferred, not directly surveyed.                    | **High if proven:** directly aligned with the required app surfaces, offline constraints, and interruptions.                   | **High:** instrument resume success, context recovery, input parity, save integrity, cross-device continuation, and device-specific abandonment; deterministic state aids regression. | Accounts/sync may cost more than the value. **Falsify** if the same value cannot survive touch/pointer/keyboard and small/large screens, or if testers do not choose cross-context continuation over one-device play.                                    |
| **3 — reserve for discriminating probes**               | **Private expressive agency:** exploration, identity, or creativity without requiring public performance, live chat, or hosted UGC.                                              | **Moderate:** E07, E10, E16 support agency/creativity; E06 supplies a safety reason to test private alternatives.                         | **Potentially high:** private state can be local/offline, but expressive interfaces can be input- and screen-sensitive.        | **Moderate:** artifact diversity, perceived ownership, curiosity, return reasons, and originality can be measured; “good expression” is partly subjective.                            | Private expression may not satisfy social motives, and combinatorial content can inflate QA. **Falsify** if perceived ownership is weak, outputs converge, or authoring/moderation/content costs grow faster than evaluable value.                       |
| **4 — reserve for discriminating probes**               | **Age-flexible cognitive confidence:** understandable challenge and visible mastery without a health, education, or brain-improvement promise.                                   | **Moderate:** stimulation/challenge recur and older-player relevance appears in E01–E03.                                                  | **Potentially high:** abstract cognitive value need not depend on performance, but legibility and input fairness are decisive. | **High for task outcomes**, moderate for player value: learning curves, error recovery, mastery, difficulty fairness, and accessibility can be tested.                                | Crowded puzzle/cognitive adjacency and localization risk. **Falsify** if differentiation reduces to a familiar task with new art, or accessibility adaptations remove the intended sense of mastery.                                                     |
| **Later only, unless new evidence reverses the burden** | **Optional social meaning:** connection or sharing around a fundamentally single-player experience.                                                                              | **Audience-dependent:** strong for many teens/younger players, weaker for older groups (E02, E03, E06, E16).                              | **Moderate–low** when network/account/platform services are required.                                                          | **Moderate:** connection can be reported, but network effects, sparse populations, safety, and moderation confound early tests.                                                       | **Defer** any concept whose core value requires synchronous multiplayer, public chat, an open creator economy, or continuous live operations. A bounded nonpublic hypothesis may return if it beats private-expression alternatives on value and burden. |

### Why these are spaces rather than concepts

They state a player outcome and contextual constraint, not a fictional setting, ruleset,
control scheme, content format, progression model, or mechanic. The later concept agent
must generate multiple structurally distinct ways to address them and may reject every
space if new evidence or platform policy fails its gate.

## Cross-platform and session constraints

| Constraint                                                                      | Direct evidence                                                                                       | Eligibility implication for later concepts                                                                                                                                                                             | Proof required before selection                                                                                                                                                                                                                        |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Touch, pointer, keyboard, controller, aspect ratio, and windowing differ.       | E04/E06/E13 show device overlap; E18 documents Android form factors and inputs.                       | Core value cannot depend exclusively on hover, right-click, fine pointer precision, dense text, rapid typing, one orientation, or a controller. Equivalent actions may differ, but outcomes and fairness must survive. | Usability tasks on small touch phone, tablet, desktop pointer/keyboard, and at least one controller; record completion, error, fatigue, and comprehension by surface.                                                                                  |
| Web is a constrained runtime, not merely another native build.                  | E17 documents WebGL 2, performance, audio gesture, persistence, background pause, and gamepad limits. | The first valuable loop must tolerate lower performance, suspension, refresh, lost focus, and sound-off entry. Save/recovery cannot silently depend on cookies or private-mode persistence.                            | Automated compatibility build plus real-browser matrix; suspend/resume, storage-denial, offline/reconnect, audio-disabled, and low-spec tests.                                                                                                         |
| Mobile reach coexists with network and affordability gaps.                      | E02–E05 and E25.                                                                                      | Core single-player value should not require a continuous connection; download size, update size, thermals, battery, and resume are player-value constraints, not only engineering metrics.                             | Define and test explicit size, cold-start, battery/thermal, offline, update, and recovery budgets on representative low/mid/high devices. Values remain a concept-stage decision.                                                                      |
| The one-app downloadable-pack model has unresolved store-policy interpretation. | Apple 4.7 (E20) and Google Play's dynamic-code policy (E21).                                          | Do not assume a valid game concept can ship unchanged. The player app remains one app; no separate game app is authorized.                                                                                             | Before concept selection becomes expensive, obtain a documented platform-policy analysis of Godot PCK contents, executable/interpreted-code boundaries, review metadata, rating, consent, and update path, with a rollback-compatible delivery option. |
| Sessions are interrupted and ending quality can matter.                         | E11; web pause behavior in E17; WHO safety boundary in E12.                                           | State must remain coherent through pause/quit/resume, and evaluation must not reward prolonging a session after the player wanted to stop.                                                                             | Deterministic interruption tests at every consequential state plus player measures of agency, ending satisfaction, planned-versus-actual duration, and return without reminders.                                                                       |

## Evaluation feasibility and continuous agent improvement

### A minimum evidence design for later concepts

1. **Freeze each concept's player-value claim before play.** State the prioritized job,
   intended audience/context, disconfirming outcome, and countermetric. Retention alone,
   session length alone, and agent-authored prose are not value evidence.
2. **Use independent measures.** Combine behavior, a short validated or transparently
   worded pre/post self-report, blind comparative preference where feasible, and an
   interview prompt that asks what changed and why. Do not infer wellbeing from time
   played.
3. **Test the first bounded session and the exit.** E09 shows dense in-session sampling
   is feasible and that change may occur early; E11 shows exit is separately meaningful.
   Measure time to first understood consequential choice, competence/agency, errors and
   recovery, desired stopping point, exit satisfaction, and voluntary return.
4. **Cross the device matrix early.** The same frozen build/content revision should be
   tried on web, desktop, Android, and iOS with surface-specific usability outcomes.
   TestFlight, Google Play tracks, and Steam Playtest provide channels (E22–E24), but
   recruitment and analysis must keep cohorts distinguishable rather than pooling them
   as if equivalent.
5. **Make agent evaluation reproducible.** Gameplay decisions and state should be
   separable from rendering; randomness seeded; clocks controllable; scenarios and
   expected state transitions serialized; telemetry schemas versioned; raw run and
   failure logs retained. Agents may propose variants, but promotion requires frozen
   criteria, repeated runs, a baseline, and independent evaluation.
6. **Prefer learning-rich concepts.** Favor candidates with observable decisions and
   recoverable state over those whose value depends mainly on one-shot authored content,
   a critical mass of other players, unmoderated generation, or weeks of retention.

### Player-value measures and countermetrics

| Claim                                | Candidate measures                                                                                                                                                          | Required countermetric / interpretation guard                                                                                                         |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Positive affect or restoration       | Brief pre/post valence and activation; session-specific “better/worse/same and why”; observed frustration/recovery; blinded preference against a baseline.                  | Desired versus actual duration, exit agency, sleep/time displacement in longitudinal follow-up. No causal health language.                            |
| Competence and agency                | Player Experience Inventory/need-satisfaction items chosen and licensed at study design; task comprehension; meaningful-choice recall; error recovery; difficulty fairness. | Accessibility task failure, confusion masked as “challenge,” and outcomes determined by input device rather than decision quality.                    |
| Cross-context continuity             | Resume success, time to regain orientation, save integrity, cross-device task equivalence, continuation chosen without prompting.                                           | Login/sync abandonment, offline failure, battery/thermal cost, and players who prefer a single surface.                                               |
| Originality and expressive ownership | Independent similarity review; players' unaided descriptions; diversity of strategies/outputs; perceived ownership and surprise.                                            | Confusion, convergent outputs, recognizable cloning, asset/provenance exceptions, and content/QA growth per additional meaningful possibility.        |
| Voluntary return                     | Return when no streak, push, scarcity, or reward is attached; stated return reason; delayed comparative choice.                                                             | Session extension after desired stop, reminder dependence, habit/confusion, and novelty decay. Return is supportive evidence only, not the objective. |

### Discriminating questions for the concept agent

Every later concept should answer these with evidence or a cheap falsification test:

1. Which one player job is primary, for whom, in what context, and what observation
   would show the concept does not meet it?
2. What is the shortest session in which a new player can understand a consequential
   decision, feel its outcome, and stop satisfied? Does the value also deepen without
   coercing duration?
3. What remains original when setting, art, copy, and genre labels are removed? Which
   adjacent products are structurally closest, and what player-relevant difference can
   an evaluator observe rather than merely read in a pitch?
4. Does the entire primary value survive touch, pointer/keyboard, small/large screens,
   suspension, sound-off use, lower web performance, and offline play? If not, which
   required platform is knowingly second-class?
5. Can a deterministic evaluator distinguish a better decision system from prettier
   rendering or more content? What frozen scenarios and countermetrics prevent agents
   from gaming the score?
6. Can players with relevant visual, auditory, motor, cognitive, and photosensitivity
   access needs perceive information, act, recover, adjust time/difficulty, and exit?
7. What ongoing work is required per week of player value—authored content,
   localization, moderation, servers, policy review, safety response, and QA—and which
   burden grows nonlinearly?
8. What minimum data is necessary to evaluate the claim? Can the same learning be
   obtained without identity, cross-app tracking, minors' data, raw text, or persistent
   behavioral profiles?
9. Does downloadable-pack delivery comply with Apple and Google policy under a written
   interpretation, and what is the rollback target if review rejects it?
10. Which result would cause Nofi to stop, revise, or switch opportunity spaces rather
    than rationalize the concept's failure?

## Safety, accessibility, originality, and operating burden

### Safety and privacy gates

- Do not frame normal play as pathology. Use WHO's boundary only to identify impaired
  control and harm risks, not as a prevalence estimate (E12).
- Do not optimize for maximum time, inability to stop, streak preservation, forced
  return, or notification dependence. Treat clean exit and chosen return as first-class
  outcomes (E11–E12).
- Do not make therapeutic, stress-treatment, education, or cognitive-improvement claims
  without an accepted, appropriately controlled evidence plan. Current evidence
  supports player-reported jobs, not those causal claims (E08–E09).
- Default opportunity evaluation to adults unless a child-specific hypothesis wins a
  separate safeguarding, parental-participation, privacy, rating, and consent review.
  Child reach alone does not justify collecting child data (E06–E07, E20, E27).
- Public chat, public UGC, direct messaging, matchmaking, and live generative content
  each create moderation and abuse-response obligations. They are not justified for a
  first pack by broad “social” demand alone.
- Collect the minimum versioned event data necessary for a frozen hypothesis. No raw
  free text, stable cross-context identity, or production trace enters Git.

### Accessibility gates

Use the Xbox Accessibility Guidelines (E19) as a current discovery checklist, then test
with affected players; checklist conformance is not evidence of access. At minimum, a
later concept must address:

- scalable legible text and UI, adequate contrast, non-color-only and non-audio-only
  information;
- captions/subtitles where speech conveys meaning, motion reduction, and avoidance or
  control of photosensitive patterns;
- remappable/rebindable actions where supported, keyboard alternatives, generous target
  size, configurable hold/repeat/timing, and no unnecessary simultaneous inputs;
- adjustable difficulty or assistance that preserves the intended player job, clear
  recovery, pause, save, and freedom from punitive time pressure;
- screen-reader/assistive-technology review for the surrounding player app even where a
  rendered game surface cannot expose every element semantically.

Accessibility is also an originality test: if a candidate's identity disappears when
fine motor speed, color, hearing, or strict timing is removed, its cross-platform player
promise is fragile.

### Originality and IP gates

- Ideate from the evidenced job and constraints, not from an existing title plus a
  theme change. Apple explicitly rejects copycats and thin/spam variants (E20).
- Before promotion, search direct competitors on every required store and document at
  least the closest structural, expressive, naming, and visual similarities. The
  SteamDB counts in E14 are only the start, not a clearance search.
- Preserve provenance and licenses for code, text, art, audio, fonts, datasets, and
  generated material. Record human selection, arrangement, and modification if AI
  contributes expressive assets; prompting alone is not a reliable US authorship basis
  (E26).
- A method of play being uncopyrightable in US registration practice does not make
  copying safe or original. Trademark, patent, trade dress, contract, publicity,
  platform policy, other jurisdictions, and player perception remain separate risks.
- Reject “original” claims that exist only in prose. Blind players/evaluators should be
  able to describe a distinctive promise or decision experience from the artifact.

### Content and operations burden

The first research-selected pack should maximize learning per unit of irreversible
operation. This favors opportunities that can be evaluated with bounded content,
deterministic state, offline core play, and no critical population threshold. Burden
rises sharply when value requires:

- continuous authored narrative or frequent novelty drops;
- open-ended generated content requiring safety evaluation and provenance tracking;
- public UGC/chat, matchmaking, fraud/abuse response, or a creator economy;
- server authority or continuous connectivity for core single-player value;
- child-directed data, accounts, social graphs, or cross-device identity;
- device-specific high-fidelity rendering, precise inputs, or hard-to-automate content
  validation.

This is not an instruction to choose a small or simple game. It is a requirement that a
later concept justify why each recurring burden produces measurable player value and
agent learning.

## Assumptions and uncertainty

- **A1 — transfer from research samples:** the recurring jobs are assumed relevant
  enough to seed Nofi interviews and concept probes. They are not assumed to describe
  Nofi's eventual users. Industry-panel, active-player, convenience-panel, child,
  single-country, and one-title samples each have different selection effects.
- **A2 — job stability, not trend stability:** affect, agency, mastery, diversion, and
  connection recur across methods and years, so they are treated as more durable than a
  genre chart. The 2022 Oxford study is retained because it is the strongest objective
  causal counterweight in the corpus, not as a current market-size statistic.
- **A3 — one app and four surfaces:** the accepted product/architecture context requires
  one player app for web, desktop, Android, and iOS. This brief assumes parity of the
  primary player job is required while presentation may adapt; it does not assume every
  device must receive identical controls or layout.
- **A4 — downloadable pack feasibility:** the project architecture permits game packs,
  but Apple/Google approval for the exact Godot PCK contents and update path is uncertain.
  Opportunity ranking is conditional on resolving that policy gate.
- **A5 — single-player scope:** social evidence is treated as a challenger and possible
  indirect value, not permission to turn the first pack into multiplayer, public UGC, or
  a separate community product.
- **A6 — measurement validity:** immediate self-report, behavior, and qualitative
  explanation are assumed jointly more informative than any one signal. None alone
  proves durable value; the instruments and meaningful effect thresholds remain to be
  selected and validated in the later evaluation plan.
- **A7 — operational capacity:** no unrecorded team size, content budget, moderation
  service, or acquisition channel is assumed. Burden comparisons are directional until
  a later concept states its recurring work and rollback target.

## Contradictions and how they affect the recommendation

| Tension                                         | Evidence on both sides                                                                                                                                                                                                                | Resolution for later work                                                                                                                                         |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Perceived benefit vs causal wellbeing           | Large industry surveys report relief/stimulation (E01–E03); objective longitudinal evidence finds little average causal relationship between play time and wellbeing (E08); one-title in-session uplift is small and noncausal (E09). | Test bounded session value and player meaning. Do not use time played as benefit or make health claims.                                                           |
| Social value vs single-player fit and safety    | Social matters for many teens/younger players (E02, E06, E16); single-player is a meaningful new-game factor (E01), older solo play is common (E03), harassment is frequent (E06), and social exit is harder (E11).                   | Keep optional/private/indirect social hypotheses; defer public synchronous systems unless their incremental value beats operating and safety costs.               |
| Mobile reach vs “same everywhere”               | Mobile leads reach/favorite device (E02–E05), while multi-device behavior is common (E06, E13); browser/runtime, input, network, and store policies differ (E17–E21, E25).                                                            | Require parity of the primary job, not identical presentation. Falsify concepts that make a required platform materially worse.                                   |
| Familiar demand labels vs whitespace            | Relaxation, challenge, and boredom relief are common jobs (E01–E03/E10); adjacent Steam labels and releases are crowded (E14–E15).                                                                                                    | Differentiate through an observable promise and original system/premise. A tag cannot be the thesis.                                                              |
| Broad-age reach vs a coherent audience          | Play spans ages (E01–E04), but motives, solo/social patterns, safety, privacy, input, and access differ (E02–E07, E27).                                                                                                               | Demand an explicit first audience/context and accessibility boundary for each concept; test transfer instead of declaring “for everyone.”                         |
| Fast agent generation vs defensible originality | Agents can produce abundant variants; platform copycat rules and copyright/provenance constraints still apply (E20, E26).                                                                                                             | Treat generation as exploration. Promotion requires independent similarity review, provenance, reproducible evaluation, and human-responsible expressive choices. |

## Evidence gaps and next research tests

1. **No Nofi first-party need data.** Conduct short problem interviews and diary/context
   sampling before treating any ranked space as selected. Recruit across at least two
   materially different device/use contexts and record nonplayer/lapsed-player reasons.
2. **Cross-context continuity is indirect.** Test whether players actually want to move
   the same relationship between devices, or merely choose different games in different
   contexts. Include account-free/local-first and opt-in-sync comparisons.
3. **No transparent cross-store density dataset.** Reproduce a dated competitor census
   for each concept on Apple, Google Play, web portals, and desktop stores using written
   queries and inclusion rules. Do not use rankings, revenue, or download estimates as
   value.
4. **Self-report dominates jobs evidence.** Pair interviews with observed choice,
   abandonment, recovery, return without prompts, and comparative play. Pre-register
   what would falsify each player-value claim.
5. **Geographic breadth is uneven.** The global source covers 21 countries but is
   industry sponsored and active-player-only; independent motive validation is UK/US;
   Japan's current public method is incomplete. Validate language, connectivity, device,
   and cultural assumptions with direct participants before global claims.
6. **Players with disabilities are missing from the demand samples.** Run participatory
   accessibility research; do not substitute standards compliance or simulated
   personas.
7. **Session need is undermeasured.** Representative sources report weekly use and broad
   motives, not the desired length, interruption pattern, or preferred exit. Instrument
   those directly without rewarding longer sessions.
8. **Pack distribution is not policy-proven.** Obtain documented Apple/Google review of
   the exact PCK content/update model before a concept becomes dependent on downloadable
   behavior. Preserve the one-player-app constraint and define a rollback path.
9. **No durable originality assessment exists yet.** The concept agent must build a
   contemporaneous nearest-neighbor set, record exclusions, and run blind similarity
   review. The current density scan is too coarse for clearance.
10. **Longitudinal value is unknown.** An enjoyable first session can decay, while
    retention can reflect habit rather than value. Later evaluation needs delayed
    follow-up with voluntary-return reasons and time-displacement countermetrics.

## Search limitations and failures

- The raw native transcript is retained at
  `/var/tmp/nofi-first-game-research-sol.jsonl`; it is not copied into Git because it is
  a large native run artifact. The brief records direct URLs and enough method detail
  for a fresh agent to reproduce the evidence trail.
- The web retrieval layer rejected the approximately 20 MB ESA 2026 PDF, so the direct
  publisher PDF was retrieved with `curl` and extracted locally with `pdftotext` in
  `/var/tmp`. The URL, sample, field dates, and observations are recorded in E01.
- The web opener returned an internal error for the Video Games Europe PDF. The direct
  publisher PDF was retrieved and text-extracted locally. The report states October
  2025 but not a day; this brief does not invent one.
- CESA exposes only a summary without purchasing the 462-page report. Its platform
  estimates are retained as contextual evidence and its method is explicitly marked
  unavailable (E05).
- The Power of Play report discloses the research company, sample, countries, minimum
  country bases, and panel quality, but no field dates or defensible population-weighted
  “global” estimator. This brief does not treat its aggregate percentages as global
  population prevalence (E02).
- SteamDB is a volatile, unofficial, multi-tag PC catalog. Snapshot totals differed from
  the earlier PC Gamer article because collection cutoffs differ. Both are dated and
  used directionally; no count is called market demand (E14–E15).
- No current open source with a transparent, comparable method was found for supply,
  unmet need, or satisfaction across Apple, Google Play, web portals, and desktop
  stores. Paywalled commercial intelligence, opaque rankings, revenue charts, and stale
  genre charts were excluded rather than backfilled with estimates.
- Search-result relative dates were sometimes inconsistent with dates on publisher
  pages/PDFs. Publisher dates and report text take precedence. Living Apple, Google,
  Godot, Microsoft, Valve, WHO, and Copyright Office pages have no stable publication
  date where noted, so the collection cutoff is the reproducible date.
- Evidence is weaker for Africa outside the active-player global survey, for South and
  Southeast Asia outside the same survey/Bain release, for Latin America beyond a few
  included countries, for people with disabilities, for lapsed/nonplayers, and for
  low-connectivity contexts. This prevents a universal-audience conclusion.
- This was desk research, not legal advice, store pre-clearance, direct player research,
  or a concept test. Apple/Google pack-policy interpretation, child/privacy
  applicability, and IP clearance remain gates.

## Recommendation and handoff boundary

The later concept agent should first generate multiple structurally different candidates
against **reclaimable restorative mastery** and **cross-context continuity**, while
carrying **private expressive agency** and **age-flexible cognitive confidence** as
challengers. It should use the ten discriminating questions above, conduct a dated
cross-store nearest-neighbor search, and define a cheap falsification test for each
candidate before elaborating it.

Do not promote a candidate because it resembles a successful game, occupies a popular
tag, can generate abundant content, maximizes retention, or appears monetizable. Promote
only after independent evidence shows a specific audience receives the promised value,
the value survives every required platform, the experience is recognizably original,
the evaluation is reproducible, and safety/accessibility/operating burdens are bounded.

**Explicit boundary:** this brief does not select a game, audience, genre, concept,
premise, mechanic, content plan, or implementation. Selection and design remain
unresolved and belong to later OpenSpec artifacts and independent evaluation.

## Checkpoint validation state

- OpenSpec recognizes `market-brief` as **done** and `concepts` as **ready**. All later
  artifacts remain blocked by their declared dependencies; no later artifact was
  created in this claim.
- Strict change validation is expected to fail at this partial research checkpoint with
  “Change must have at least one delta. No deltas found.” The future `specs` artifact is
  blocked on concept selection, so adding a delta or setting `skip_specs: true` here
  would incorrectly pre-empt later work.
- The artifact is formatted with the repository's Prettier installation. The final
  checkpoint also requires a clean whitespace diff and an explicit staged-path audit.
