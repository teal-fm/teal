---
name: teal.fm (Amethyst)
description: Social music tracking on AT Protocol; system-native calm, with album art supplying the colour.
colors:
  tint: "#0b7a73"
  tint-dark: "#3fc9bd"
  on-tint: "#ffffff"
  on-tint-dark: "#002b28"
  tint-soft: "rgba(11, 122, 115, 0.12)"
  tint-soft-dark: "rgba(63, 201, 189, 0.16)"
  now: "#0f8f84"
  now-dark: "#3fc9bd"
  ground: "#ffffff"
  ground-dark: "#000000"
  ground-2: "#f2f2f7"
  ground-2-dark: "#1c1c1e"
  ink: "#000000"
  ink-dark: "#ffffff"
  ink-2: "rgba(0, 0, 0, 0.66)"
  ink-2-dark: "rgba(235, 235, 245, 0.8)"
  ink-3: "rgba(60, 60, 67, 0.4)"
  ink-3-dark: "rgba(235, 235, 245, 0.36)"
  hair: "rgba(60, 60, 67, 0.18)"
  hair-dark: "rgba(84, 84, 88, 0.6)"
  fill: "rgba(120, 120, 128, 0.12)"
  fill-dark: "rgba(120, 120, 128, 0.24)"
  glass: "rgba(255, 255, 255, 0.58)"
  glass-dark: "rgba(30, 30, 32, 0.46)"
  glass-strong: "rgba(255, 255, 255, 0.72)"
  glass-strong-dark: "rgba(0, 0, 0, 0.64)"
  glass-edge: "rgba(255, 255, 255, 0.7)"
  glass-edge-dark: "rgba(255, 255, 255, 0.08)"
  chip-scrim: "rgba(0, 0, 0, 0.45)"
  on-scrim: "#ffffff"
typography:
  hero:
    fontFamily: "system-ui, -apple-system, Roboto, sans-serif"
    fontSize: "40px"
    fontWeight: 700
    letterSpacing: "-0.025em"
  large-title:
    fontFamily: "system-ui, -apple-system, Roboto, sans-serif"
    fontSize: "34px"
    fontWeight: 700
  headline:
    fontFamily: "system-ui, -apple-system, Roboto, sans-serif"
    fontSize: "22px"
    fontWeight: 700
  title:
    fontFamily: "system-ui, -apple-system, Roboto, sans-serif"
    fontSize: "20px"
    fontWeight: 700
  post-text:
    fontFamily: "system-ui, -apple-system, Roboto, sans-serif"
    fontSize: "20px"
    fontWeight: 500
    lineHeight: "26px"
    letterSpacing: "-0.025em"
  card-title:
    fontFamily: "system-ui, -apple-system, Roboto, sans-serif"
    fontSize: "19px"
    fontWeight: 700
  row-title:
    fontFamily: "system-ui, -apple-system, Roboto, sans-serif"
    fontSize: "17px"
    fontWeight: 600
  body:
    fontFamily: "system-ui, -apple-system, Roboto, sans-serif"
    fontSize: "15px"
    fontWeight: 400
  meta:
    fontFamily: "system-ui, -apple-system, Roboto, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    fontFeature: "\"tnum\""
  label:
    fontFamily: "system-ui, -apple-system, Roboto, sans-serif"
    fontSize: "11.5px"
    fontWeight: 600
  tab-label:
    fontFamily: "system-ui, -apple-system, Roboto, sans-serif"
    fontSize: "10.5px"
    fontWeight: 600
rounded:
  hairline-cell: "3px"
  cover-sm: "10px"
  cover: "12px"
  cover-md: "14px"
  nav-item: "15px"
  cover-lg: "18px"
  panel: "26px"
  sidebar: "30px"
  pill: "9999px"
spacing:
  xs: "6px"
  sm: "10px"
  md: "14px"
  lg: "16px"
  xl: "20px"
  page-gutter-phone: "10px"
  page-gutter-wide: "20px"
components:
  glass-panel:
    backgroundColor: "{colors.glass}"
    rounded: "{rounded.panel}"
    padding: "16px"
  glass-panel-strong:
    backgroundColor: "{colors.glass-strong}"
    rounded: "{rounded.panel}"
    padding: "16px"
  button-tint:
    backgroundColor: "{colors.tint}"
    textColor: "{colors.on-tint}"
    rounded: "{rounded.pill}"
    padding: "8px 16px"
  button-fill:
    backgroundColor: "{colors.fill}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "8px 16px"
  icon-button-glass:
    backgroundColor: "{colors.glass}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    size: "36px"
  reaction-pill:
    backgroundColor: "{colors.fill}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    height: "32px"
    padding: "0 10px"
  reaction-pill-mine:
    backgroundColor: "{colors.tint-soft}"
    textColor: "{colors.tint}"
    rounded: "{rounded.pill}"
    height: "32px"
    padding: "0 10px"
  quick-reaction:
    rounded: "{rounded.pill}"
    size: "40px"
  friend-chip:
    backgroundColor: "{colors.chip-scrim}"
    textColor: "{colors.on-scrim}"
    rounded: "{rounded.pill}"
    height: "34px"
    padding: "0 12px 0 3px"
  nav-item:
    textColor: "{colors.ink-2}"
    rounded: "{rounded.nav-item}"
    height: "46px"
    padding: "0 12px"
  nav-item-active:
    backgroundColor: "{colors.tint-soft}"
    textColor: "{colors.tint}"
    rounded: "{rounded.nav-item}"
    height: "46px"
    padding: "0 12px"
  weave-note:
    backgroundColor: "{colors.glass}"
    rounded: "{rounded.pill}"
    padding: "8px"
  deck-cover:
    rounded: "{rounded.cover-lg}"
    width: "78vw"
  post-cover:
    rounded: "{rounded.cover-md}"
    size: "112px"
---

# Design System: teal.fm (Amethyst)

## Overview

**Creative North Star: "The Glass Over the Record Shelf"**

Amethyst looks like the platform it runs on. It uses system type, Apple-style grounds and inks, hairlines, and one teal tint. Colour doesn't come from the palette. It comes from the music: every screen sits on a backdrop that blends the blurred covers nearest the middle of the viewport, and content floats above it on frosted panels. The base stays calm and Are.na-quiet. The energy belongs to album art, people's faces, and the playful moments where people meet: the listening deck, emoji stickers stamped onto covers, and the teal "listening now" ring.

The density is that of a native list app, not an editorial page. Large system titles anchor each screen. Under them are panels with 26px corners, covers with soft shadows, and pill-shaped controls. Light and dark get equal design attention. Every surface token has a deliberate value for each theme, and the backdrop veil, the glass, and the text halo all switch with the scheme. Each platform gets its own idioms. iOS gets system blur materials and native tabs, Android gets Material tabs and a stronger translucent fill where backdrop blur isn't available, and the web gets a frosted sidebar or a floating pill tab bar.

The rejections are recorded in PRODUCT.md: no themed costumes (radio, record label, poster, signage), no ratings or reviews, and no story timers or one-at-a-time gating.

**Key Characteristics:**
- System type with large titles. No display face.
- Teal is the only tint. Album art supplies every other colour.
- A blended, blurred-cover backdrop follows whatever covers are near the middle of the screen.
- Content sits on frosted glass panels. Text set directly on the backdrop gets a theme-aware halo.
- Light and dark are designed equally, and each platform keeps its native idioms.
- Reactions are emoji (🔥😭🫶🔁🤯 plus any emoji). There are no stars, scores, or reviews.
- "Listening now" is marked with the teal `now` dot or ring and is never called "live".

## Colors

The palette is achromatic system greys around a single teal. Album covers, seen through blur, provide the rest of the colour.

### Primary
- **Teal Tint** (`tint` / `tint-dark`): the brand's only accent. It is deep teal on light and luminous aqua on dark. It's used for the selected tab and nav item, the wordmark, primary pills ("Post a song", "Sign in"), the compose icon, and the count on your own reactions. It is also the native tab `tintColor`.
- **On Tint** (`on-tint` / `on-tint-dark`): text and icons on a tint fill. White on light, near-black teal on dark.
- **Tint Wash** (`tint-soft` / `tint-soft-dark`): a 12–16% teal wash. It fills the selected sidebar item, your own reaction pill (with a 40% tint border), and the taste-match badge.

### Secondary
- **Listening Now Aqua** (`now`): aqua for presence, deepened to #0f8f84 in light mode so the ring clears 3:1 against white (#3fc9bd in dark). It is reserved for presence: the 7px dot in a friend chip and the ring an avatar wears when `listeningNow` is true. The ring's width is `max(2, size/24)`, with a ground-coloured gap inside it.

### Neutral
- **Ground** (`ground` / `ground-dark`): pure white or pure black. It sits under the backdrop and is the page colour where there's no art.
- **Grouped Ground** (`ground-2` / `ground-2-dark`): the system grouped-background grey, for secondary grounds.
- **Ink, Ink 2, Ink 3** (`ink`, `ink-2`, `ink-3`, plus dark variants): primary text, then secondary text (artist · album lines, metadata, inactive icons), then tertiary text (placeholders, the ".fm" in the wordmark, the disc glyph in an empty cover).
- **Hairline** (`hair`): a thin divider and the outline for quiet bordered rows such as taste-match comparisons.
- **Fill** (`fill`): the translucent grey behind secondary pills, idle reaction pills, empty covers and avatars, and hover states.
- **Glass, Glass Strong, Glass Edge** (`glass`, `glass-strong`, `glass-edge`): the frosted panel fill, a stronger fill for Android and the wide sidebar, and the 1px light edge that defines a panel against the backdrop.
- **Chip Scrim** (`chip-scrim`): black at 45%, under white `on-scrim` text in both themes, for chips laid over cover art (the friend chip, the moment label, the fingerprint caption).

Legacy shadcn-style names (`background`, `primary`, `muted`, `card`, `border`, ...) are still mapped in `global.css` so screens that haven't been migrated keep rendering. They are not part of this system, so don't use them on new surfaces.

### Named Rules
**The One Tint Rule.** Teal is the only accent the interface owns. Any other colour on screen must come from album art or people's avatars.

**The Art Brings the Colour Rule.** Screens don't get a background colour. They get a backdrop made from the covers on them: up to 6 covers, weighted by how close each is to 45% of the viewport height, blurred and saturated, then veiled per theme (black at 42% on dark, rgba(250,250,252,0.46) on light).

**The Now Is Not Live Rule.** Presence is "listening now" with the `now` dot or ring. Never label it "live".

## Typography

**Display Font:** system (SF Pro on iOS, Roboto on Android, the system-ui stack on the web)
**Body Font:** the same system family
**Label/Mono Font:** none in the redesign

**Character:** native and unadorned. Hierarchy comes from size and weight. Large bold titles carry the confidence, and secondary text recedes through `ink-2` rather than through a smaller size.

### Hierarchy
- **Hero** (700, 40px rising to 52px at `sm`, tight tracking): artist and album names on music pages, over the backdrop with a halo.
- **Large Title** (700, 34px): the screen title: Today, Explore, and titled shell pages.
- **Headline** (700, 22px): section headings inside pages.
- **Title** (700, 20px): headings inside glass panels (Albums, Taste match, Favourites).
- **Post Text** (500, 20px, 26px line height, tight tracking): what someone said in a song post. In the feed, it is the largest text on a card.
- **Card Title** (700, 19px): the track or release name under a deck card.
- **Row Title** (600, 17px): the track in a post, and notice titles.
- **Body** (400, 15px): artist · album lines, listening facts, weave notes, and descriptions, usually in `ink-2`.
- **Meta** (400, 13px, tabular numbers): timestamps, counts, and context lines like "ana and 2 others played this today".
- **Label** (600, 11.5–13.5px): chips over art and small captions.
- **Tab Label** (600, 10.5px): labels in the web pill tab bar.

### Named Rules
**The System Voice Rule.** All interface text uses the system family. Fraunces, Crimson Pro, and Plex Mono are still in the repo, but the redesign doesn't use them for interface text.

**The Halo Rule.** Any text set directly on the backdrop, without a panel behind it, gets the theme halo: a 10px blur with no offset, in rgba(255,255,255,0.65) on light and rgba(0,0,0,0.6) on dark. Text on glass doesn't need it.

## Layout

Phone screens are one column with a 10px list gutter, panels running nearly edge to edge, and 20px insets for title blocks. The listening deck is a horizontal snap carousel. Cards are 78% of the screen width, capped at 330px, so the neighbouring cards peek in. Cards that aren't focused scale to 0.94 and drop to 80% opacity. Vertical rhythm between feed items is 14px.

At 1000px the web switches to a wide layout: a 264px floating frosted sidebar, a centre column capped at 660px for Today (48rem in the shared shell, 64rem for utility pages), and a 360px right rail (22rem in the shell, shown from 1280px). Below 1000px the web shows a floating glass pill tab bar, at most 380px wide, 14px above the bottom. Phone layouts leave about 110px of bottom padding so content clears the tab bar.

Covers are always square. Grids of releases wrap at 46% width on phones and 30% from `sm`.

## Elevation & Depth

Depth comes from layers, not from piled-up shadows. From the bottom up: the ground, the blurred-cover backdrop with its veil, frosted glass panels (system thin material on iOS at intensity 60, `backdrop-blur-2xl` with saturation 150% on the web, a stronger translucent fill on Android), and then content. Shadows are soft, ambient, and only for objects. Covers and stickers get them so they read as physical things resting on the glass. Panels themselves have no shadow. A panel separates from the backdrop through its fill and its 1px glass edge.

### Shadow Vocabulary
- **Cover lift** (`0 25px 50px -12px rgb(0 0 0 / 0.25)`): deck covers, music page hero art.
- **Cover rest** (`0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)`): covers inside post cards.
- **Sticker** (`0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)`): emoji stickers stamped on covers, release grid art, the tint "Post a song" pill.

### Named Rules
**The Glass Holds, Art Floats Rule.** Panels never cast shadows. Only covers, stickers, and the one primary action do, and those shadows are always soft and blurred, never hard or offset.

## Shapes

The forms are soft and continuous. Panels use 26px corners (30px for the wide sidebar). Covers scale their radius with size: 10px at 44px, 12px by default, 14px at 112px, 16–18px for hero and deck art. Fingerprint cells use 3px. Every control is a full pill: buttons, reaction pills, chips, icon buttons, the weave note, and the web tab bar. Avatars are circles. The one exception is the sidebar nav item, a 15px rounded rectangle. Borders are rare: the 1px glass edge, a hairline on quiet rows, and a 2px tint border at 70% that marks group-moment covers in the deck.

## Components

### Buttons
- **Shape:** always a full pill (9999px). Icon buttons are 36–44px circles.
- **Primary:** a tint fill with on-tint text, semibold, about 8px 16px (46px tall in the sidebar, with the sticker shadow). Use it for the one main action in a context: "Post a song", "Sign in".
- **Secondary:** a `fill` pill with ink text ("Try again", "See who's listening").
- **Glass icon button:** a 36px glass circle with an ink icon (tint for compose). It's used for header actions over the backdrop.
- **Press / Hover:** on native, the press shrinks the control (to 0.75 for quick reactions, 0.95 for pills). On the web, hover tints the background with `fill`.

### Chips
- **Friend chip:** a 34px pill in chip scrim over the top left of a cover, holding a 28px avatar, a white semibold name, the `now` dot, and "now" or a short time ago.
- **Taste-match badge:** a tint-wash pill with bold tint text.

### Cards / Containers
- **Corner Style:** 26px.
- **Background:** `glass` by default, `glass-strong` on Android and for the wide sidebar.
- **Shadow Strategy:** none on the panel (see Elevation & Depth).
- **Border:** 1px `glass-edge`.
- **Internal Padding:** 16px, or 16px on the sides with 16px top and 12px bottom in post cards. Notices use 20px.

### Inputs / Fields
- **Style:** the Explore search field sits inside a strong glass panel with a 23px `ink-2` search icon. The input itself is borderless and transparent, with 18px text.
- **Focus:** the input has no ring of its own, because the panel is the field.

### Navigation
- **Phone (native):** NativeTabs (UITabBar / Liquid Glass on iOS, Material navigation on Android) with four places: Today, Explore, Activity, You. Selection uses the theme tint.
- **Web wide:** a floating strong-glass sidebar with 30px corners and a "teal" wordmark (25px, extra bold, tint, with ".fm" in `ink-3`). Nav items are 46px with 22px icons and 16px semibold labels. The active item is a tint wash with tint text and icon. Below the items sit the primary "Post a song" pill and a profile card in `fill`.
- **Web narrow:** a 62px glass pill tab bar. The active tab gets a `fill` pill and tint colour.
- **You tab:** your avatar replaces the icon once you're signed in.

### Reactions
- **Quick set:** 🔥😭🫶🔁🤯 as 40px circular targets at 22px, followed by a smile-plus button that opens the full emoji picker. Your own reactions sit on `fill`.
- **Reaction pill:** a 32px pill showing the emoji and a tabular semibold count. Yours uses the tint wash with a 40% tint border and a tint count.
- **Stickers:** up to four 44px ground-coloured circles, stamped bottom right on a deck cover and overlapping by 12px. They enter with a springy zoom.
- **Gesture:** double-tapping a deck cover reacts 🔥, and a long press opens the picker.

### Listening Deck (signature)
A snap carousel of friends' current and recent listens with group moments slotted in. Listens and moments only; posts never go in the deck. The focused card's cover feeds the backdrop, so flicking the deck re-tints the screen. Under each card sit the card title, an artist · album line, and a listening fact, all with the halo, then the quick reactions. Moment cards add the 2px tint border and a tint glyph or a stack of listener avatars.

### Song Post (signature)
A glass panel with the author row (40px avatar, name, handle, time), the post text in the post style, a 112px cover beside the track with circle context and overlapping 22px faces, an open-in-app circle, then reactions, replies, and share. Each post registers its cover with the backdrop.

### Weave Note
A pill-shaped glass row woven between posts. It holds an avatar with the `now` ring, a sentence with the person and album in semibold ink, and a 44px cover.

### Listening Fingerprint
The last 31 days as columns of twelve two-hour slots. Each cell is filled with a crop of the cover that dominated that slot, with opacity scaled by plays. A chip-scrim caption sits at the bottom right.

## Do's and Don'ts

### Do:
- **Do** let covers supply colour: wrap screens in the ambient backdrop and mark covers as sources so the backdrop follows the content.
- **Do** put reading content on glass panels (26px corners, 1px glass edge), and give any text on the bare backdrop the theme halo.
- **Do** design every surface in both light and dark using the paired tokens, never values that only work in one theme.
- **Do** use system type with large bold titles (34px screen titles), and recede secondary text with `ink-2` rather than shrinking it.
- **Do** keep controls as pills and covers square, with radius scaled to their size.
- **Do** mark presence with the `now` dot or ring and the words "listening now" or "now".
- **Do** offer reactions as the quick set 🔥😭🫶🔁🤯 plus any emoji.

### Don't:
- **Don't** add a second accent colour or tint the interface from a cover. Art colours only reach the screen through the blurred backdrop.
- **Don't** introduce a display or serif face, mono labels, or uppercase tracked kicker lines above headings.
- **Don't** add ratings, stars, scores, or review UI.
- **Don't** call presence "live".
- **Don't** put shadows on panels or use hard offset shadows anywhere.
- **Don't** use the legacy shadcn tokens (`background`, `card`, `muted-foreground`, `primary`, `border`) on new or migrated surfaces. They now resolve to the redesign tokens (`primary` is `tint`, `foreground` is `ink`, `border` is `hair`) so older screens keep one tint, but new code should name the redesign tokens directly.
- **Don't** blend more than six covers into one backdrop. More turns it to mud.
