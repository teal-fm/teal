---
version: 1
slug: "app-tabs-index-tsx"
primary_target: "app/(tabs)/index.tsx"
related_targets: []
---

---
version: 1
slug: "app-tabs-index-tsx"
primary_target: "app/(tabs)/index.tsx"
related_targets: []
---

# Today (home)

Scope: the Today tab on phone (iOS, Android) and the home column on desktop web. Mode: Operate.

Audience and job: people checking in on their circle. They flick through what friends are playing and posting, react instantly, then read the calmer feed.
Constraints: real data only, with honest empty and error states; WCAG 2.2 AA including art-derived colour; native tabs on phone and a sidebar on desktop; no ratings or reviews; manual logging is secondary.
Quality bar: Airbuds' intimacy without its slowness, Are.na calm, Letterboxd's sense of ritual.

## Direction contract

THESIS: Today opens on a fast, swipeable deck of your friends' songs. The focused cover's colour floods the screen, and beneath the deck sits a feed of song posts woven with listens, floating on a backdrop that blends the blurred covers of whatever is on screen. It refuses both the generic social feed and Airbuds' one-at-a-time story crawl.

OWN-WORLD: A calm base: system type, plain grounds, hairlines, and Are.na spacing, with teal as the only tint. The playful layer lives only where people are: a full-bleed flood of cover colour with ink solved per colour for contrast, and sticker reactions that stamp onto covers.

STORY: Open the app and the screen is already the colour of what ana is playing. Flick and it becomes jo's, then rhea's. Tap a sticker or double-tap a cover to react. Scroll down to read what people said.

FIRST VIEWPORT: On phone, the top region is flooded in the focused card's colour. It carries the large title "Today" and the date in solved ink, then a deck of cards (cover at about 78% of the width, neighbours peeking). Each card has a friend chip with a live pulse, the song, a listening fact (plays, album run, repeats), and one-tap stickers. The deck shows listening only; posts never appear in it. The calm feed begins below. On desktop, the same deck sits in the centre column with the flood across the page top, plus a right rail.

FORM: Canon structure plus a signature flood deck, chosen after user feedback that the plain canon read as generic. Seed key 203c716b. Signature interaction: swipe the deck and the flood crossfades to the focused cover; tap a sticker or double-tap the cover to react instantly; there are no timers.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
