---
name: AI Engineering Developer Assessment
description: The Tournament Scoresheet — FIDE chess tournament paperwork as the visual system for a screening assessment.
colors:
  paper: "#f5f6f4"
  sheet: "#ffffff"
  ink: "#14181c"
  soft: "#5a6470"
  rule: "#d4d8d2"
  rule-strong: "#bcc3ca"
  navy: "#1c3557"
  navy-deep: "#16293f"
  navy-soft: "#eef1f5"
  ochre: "#b8801f"
  flag: "#a8322a"
  certified: "#2f6b46"
typography:
  display:
    fontFamily: "Archivo, Helvetica Neue, Helvetica, sans-serif"
    fontSize: "2rem"
    fontWeight: 500
    lineHeight: 1.24
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Archivo, Helvetica Neue, Helvetica, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 500
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Archivo, Helvetica Neue, Helvetica, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  label:
    fontFamily: "Chivo Mono, ui-monospace, SFMono-Regular, monospace"
    fontSize: "11px"
    fontWeight: 400
    letterSpacing: "0.18em"
  notation:
    fontFamily: "Chivo Mono, ui-monospace, SFMono-Regular, monospace"
    fontSize: "2.2rem"
    fontWeight: 700
    lineHeight: 0.86
    letterSpacing: "-0.02em"
    fontFeature: "tnum"
rounded:
  none: "0px"
  sheet: "2px"
  cell: "3px"
components:
  button-primary:
    backgroundColor: "{colors.navy}"
    textColor: "{colors.sheet}"
    rounded: "{rounded.none}"
    height: "48px"
    padding: "0 24px"
  button-primary-hover:
    backgroundColor: "{colors.navy-deep}"
  button-secondary:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    height: "48px"
    padding: "0 24px"
  button-secondary-hover:
    backgroundColor: "{colors.paper}"
  button-tertiary:
    backgroundColor: "transparent"
    textColor: "{colors.soft}"
    rounded: "{rounded.none}"
    height: "44px"
    padding: "0 8px"
  button-tertiary-hover:
    textColor: "{colors.ink}"
  option-band:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "16px 28px"
  option-band-selected:
    backgroundColor: "{colors.navy}"
    textColor: "{colors.navy-soft}"
  input-field:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "0 0 4px"
  filter-chip:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.soft}"
    rounded: "{rounded.none}"
    size: "30px"
    padding: "4px 8px"
  filter-chip-active:
    backgroundColor: "{colors.navy}"
    textColor: "{colors.sheet}"
  filed-stamp:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.certified}"
    rounded: "{rounded.none}"
    padding: "16px 28px"
---

# Design System: AI Engineering Developer Assessment

## Overview

**Creative North Star: "The Tournament Scoresheet"**

An assessment is a game record, not a form. Every answer is a logged move in one continuous sequence, and the outcome is published as a rating — an estimate offered to an arbiter, never a verdict. The whole interface is FIDE chess tournament paperwork: one continuous white sheet filling the browser edge to edge, hairline rules carrying every division, every entry written into a ruled cell. The candidate watches the scoresheet fill in as they answer; the recruiter reads the same sheet as a record of the candidate's decisions.

The material logic is stationery, not software chrome. The sheet no longer sits on a table — it is the page: the viewport is the sheet, and bond paper survives only as a wash and tint behind quiet controls and header rows. There is no depth anywhere — nothing in the product casts a shadow — and every division is a 1px rule. Corners are cut, not rounded. State is always carried by mark form as well as colour: filled, hollow, half-filled, dashed, struck-hollow. There is exactly one authored motion: a selected cell floods with navy the way a scoresheet cell is filled in, not the way a web card fades in.

The world refuses the category default for hiring quizzes — the centred question on pure white, four floating rounded cards, and a thin progress bar. It also honours two binding translations of its own: the move rail is twenty-one equal steps that carry no information about how questions are grouped or weighted, and no candidate-facing surface shows a score, a tally, or anything that implies pass or fail. The candidate is never rushed: no timer, no countdown, no auto-advance, no urgency styling anywhere.

**Key Characteristics:**
- A single white sheet (#ffffff) filling the viewport edge to edge; bond paper (#f5f6f4) survives only as a wash and tint; no elevation anywhere.
- Hairline rules (1px, #d4d8d2) carry every division; no card shadows, no floating panels.
- Federation navy owns structure, selection, and primary action; ochre owns focus and the current move only; flag red and certified green are reserved for state and never decoration.
- Square corners everywhere — cut, not rounded.
- Two self-hosted faces: Archivo for prose and headings; Chivo Mono, tabular figures, for every numeral, identifier, notation column, and control label.
- State carried by mark form as well as colour (filled / hollow / inverted half / dashed / struck-hollow; square / dashed / ringed).
- One authored motion: the 460ms ink-flood selection sweep.

## Colors

A palette of papers and inks with one structural navy, one live-state ochre, and two state flags that never decorate — colour on this sheet is either structure, position, or state, and nothing else.

### Primary
- **Federation Navy** (#1c3557): owns structure and selection. The flood fill behind a selected option band or inventory row, the fill of primary buttons (Next move, Begin the assessment, Sign in, Submit this record, Apply), active filter chips, the header seal, the rail's answered marks, links on hover, and progress fills on the staff side. It is the only colour permitted to fill a large surface.
- **Deep Federation Navy** (#16293f): the hover state of every navy-filled control — buttons and active chips deepen one step rather than brighten. Authored as a literal in the components, not a theme token.

### Secondary
- **Current-Move Ochre** (#b8801f): focus and the live marker, nothing else. The global `:focus-visible` outline (2px, offset 2px), the text caret, the current-move rail mark (2px ring over a half-and-half fill), the current row's 2px rule, the 3px tick under the move number, dashed pending/saving marks, outstanding-move rows on the confirm screen, and attention dots on the staff side. It never fills a surface and never serves as a hover wash.

### Tertiary
- **Flag Red** (#a8322a): failure and risk only. Save-failure banners (background at 8% opacity), the 2px ring on a failed save mark, invalid field borders and messages, the destructive hover on removable chips (border and text, never fill), the retry button's outline, and risk context on the staff side. Never decoration, never an accent.
- **Certified Green** (#2f6b46): confirmed completion only. The saved save-mark fill, the FILED result cell and stamp, filed status pills, and strength indicators on staff screens. Never decoration.

### Neutral
- **Bond Paper** (#f5f6f4): the paper wash and tint behind quiet controls and table rows — a texture on the sheet, never a margin around it.
- **Sheet White** (#ffffff): the sheet itself and every control surface on it — bands, buttons' resting fill, chips, panels, tables.
- **Record Ink** (#14181c): primary text, headings, and the knock-out letter on nothing — the letter knocked out of the navy flood is pure white instead.
- **Soft Ink** (#5a6470): secondary text, field labels, placeholders, disabled text, and captions.
- **Hairline Rule** (#d4d8d2): every 1px division — band separators, table rules, header and footer borders, rail lines, scrollbar thumbs.
- **Strong Hairline** (#bcc3ca): outline-control borders (Back, Back to the sheet, Export CSV) — one step darker than the rule so a quiet button still reads as a control.
- **Sheet-Blue Tint** (#eef1f5): ink on navy — the selected option's label, knocked-out badges, chips on flooded rows, and the reference for alpha hairlines on navy (25% and 40% steps).

### Named Rules

**The Reserved-State Rule.** Flag red and certified green are state colours only — failure and confirmed completion. They never decorate. A surface that wants more colour gets a hairline, not a hue.

**The Live-Marker Rule.** Ochre appears only as focus and as the current move (ring, 2px rule, 3px tick, dashes). It never fills a surface and never becomes the selected state — all 8% washes and alpha borders derive from the source colours rather than new tints.

## Typography

**Display Font:** Archivo (with Helvetica Neue, Helvetica, sans-serif)
**Body Font:** Archivo (same stack)
**Label/Mono Font:** Chivo Mono (with ui-monospace, SFMono-Regular, monospace)

**Character:** A compact grotesque for prose, headings, and option text, paired with a typewriter monospace used in exactly the places a scoresheet uses one — move numbers, notation columns, counters, keys, dates, and control labels. Both faces are self-hosted at build time and served from this origin; no candidate's browser talks to a font CDN. Every numeral on the sheet is set with tabular figures (`font-variant-numeric: tabular-nums` is applied at the root and by the `mono` utility) so counters such as `MOVE 07 / 21` do not jitter as digits change.

### Hierarchy
- **Display / Question** (500, 2rem / 30px desktop, 1.65rem / 26.4px mobile, line-height 1.24, tracking -0.015em, balanced, ≤38ch): the question prompt, the largest prose on the candidate flow. The landing hero steps the same voice up to 3rem (2.1rem mobile), tracking -0.02em, ≤24ch.
- **Title** (500, 1.75rem, line-height 1.15, tracking -0.02em): screen headings — confirm (up to 2.2rem), submitted (1.7→2.1rem), staff pages (1.5–1.7rem).
- **Move numeral** (mono 700, 2.2rem / line-height 0.86, tracking -0.02em, up to 2.6rem desktop): the large `MOVE 01` gutter number, with a 3px × 28px ochre tick beneath it on desktop.
- **Body** (400, 15.5px → 17px option text, line-height 1.5, ≤68ch): option labels and control text. Lead prose runs 16→17px with line-height 1.65 at ≤62ch. Notes and captions sit at 12.5–13.5px, line-height 1.55.
- **Label** (mono 400–700, 10–11.5px, tracking 0.12–0.20em, uppercase, soft ink): field and column labels (`DECISIONS`, `MOVES`, `RESULT`, table headers), counters, footer hints, and badges. The masthead title is the one sans exception: 11.5px, 700, tracking 0.19em.
- **Control / Button** (mono 500–600, 11.5–12px, tracking 0.13–0.14em, uppercase, white or ink): every button label.
- **Stamp** (mono 700, 15px, tracking 0.4em, certified green): the FILED word inside the submitted stamp, with its date at 11px / 0.16em soft ink beneath.

### Named Rules

**The Tabular Record Rule.** Every numeral that can change — move counters, move numbers, dates, character counts, catalogue counts, scores — is set in Chivo Mono with tabular figures. The sans face never carries a data numeral, and the mono is never a costume over prose.

**The Tracked Label Rule.** Micro-labels are uppercase mono, tracked 0.12–0.20em, in soft ink. They name fields and columns; they never sit above a headline as a kicker.

## Layout

The page model is one sheet filling the browser: no outer margin, no border, no maximum width — the white sheet is the viewport itself at every size. The sheet is a column: fixed masthead (56px, border-bottom hairline), flexible body, fixed footer (72px, 76px at `md`, border-top hairline).

The body splits into the move rail and the working area at `lg`. The full rail is a fixed 104px column on the left edge — `MOVES 21` header, then 21 marks stacked at 22px each with hairline lines extending right, and the boxed result cell pinned to its foot. Below `lg` the rail becomes a horizontal strip of the same 21 marks under the masthead. The working area is a grid — 88px move-number gutter, a 1px rule column, then the content (all sharing horizontal padding of 20px, 48px at `md`); the move number is set as display type, not as a label.

Option bands stack inside a hairline border: four rows separated by 1px rules, 92px minimum height (102px at `md`), each with a 44px (58px at `md`) letter column, the option text at ≤68ch, and a 30×26px key box at the right. Footer controls sit at the extremes of the footer bar: secondary Back left, mono key hint centred (hidden below `sm`), primary Next right, 44px tall (48px at `md`).

Other surfaces keep the same grammar: the landing splits into a content column and a 440px entry column at `lg`; the confirm screen reads the record back as numbered ruled rows in an 880px column; the submitted screen centres its stamp and fact rows in 640px; the staff side runs the same sheet with denser tables (mono 10.5px headers on a paper-tinted header row, right-aligned tabular numerals, 6px navy progress fills on 50% rule tracks). Breakpoints are the Tailwind defaults the build uses: `sm` 640px, `md` 768px, `lg` 1024px, `xl` 1280px.

### Named Rules

**The Equal Steps Rule.** The rail is twenty-one equal steps. No step is taller, wider, or labelled differently from another, and no break or heading may reveal how the questions are grouped or weighted. The rail communicates position and completion — nothing else.

## Elevation & Depth

This system has no depth at all. The inset sheet is gone — the sheet fills the viewport — so even the product's single historical shadow no longer exists. Surfaces separate only by hairline rules and by the paper wash (a paper tint behind header rows and quiet hover states). Nothing in the product casts a shadow.

### Named Rules

**The No-Elevation Rule.** No element in the product carries a shadow — not a button, band, chip, table, hover state, or page frame. Surfaces separate by hairline rule or the paper wash, never by elevation or a second background plane.

## Shapes

Corners are cut, not rounded: every container, band, button, chip, badge, mark, input, and table renders square (0px radius). The theme reserves two corner tokens — `--radius-sheet: 2px` and `--radius-cell: 3px` — for fine sheet detailing; the current build does not consume them, and nothing in the candidate flow is visibly rounded. The one circular form in the system is the platform-native radio marker in the inventory's single-choice rows (a 15px ring holding a 5px dot).

Form language in full: 1px hairlines for every division and control outline; 2px reserved for focus outlines, error rings, the current-move underline, and the FILED stamp border; 3px for the move-number tick and the scrollbar thumb's paper inset. Marks are small filled or outlined squares — the seal is an 11px navy square, rail marks are 12px, checkboxes 17px, save marks 10px, staff dots 9px. Drawn marks (check, cross, seal, skip strike) are inline SVG strokes at 1.2–1.6px with square line caps, matching the hairline weight; rules and strokes stay at 0°, 45°, or 90°. The ink-flood selection clips, it does not scale.

### Named Rules

**The Cut-Corner Rule.** Corners are square everywhere; the reserved radius tokens (2px sheet, 3px cell) exist only for fine sheet detailing. The single circle in the system is the radio marker — a control affordance, not a decorative shape.

## Components

The system's pieces are all stationery: an inset sheet, ruled rows, banded choices, and small printed marks. Everything below divides with hairlines and inherits the square-corner, tabular-numeral rules above.

### Buttons
- **Shape:** square (0px radius), 1px border, fixed height 44px mobile / 48px at `md`.
- **Primary:** navy fill (#1c3557) with white mono uppercase label (11.5–12px, 500–600, tracking 0.13–0.14em); hover deepens the fill to #16293f; disabled becomes a flat rule-grey block (rule fill, soft text, no pointer). The Next button carries its destination number after a 30%-white divider (`02`).
- **Secondary:** sheet fill, strong-hairline border (#bcc3ca), ink label; hover is a paper wash (#f5f6f4). Used for Back and Back to the sheet.
- **Tertiary / links:** mono 11–11.5px soft-ink uppercase labels that underline on hover and shift to navy or flag red (Sign out hovers flag; Change and Open hover navy). Skip question sits here — a quiet footer label beside the primary Next, never a styled button; it disables to 50% soft ink while a write is pending and takes the S key. The retry control is a flag-red outline that fills flag red on hover with sheet-white text.
- **Focus:** every control takes the global ochre outline — 2px, offset 2px.

### Option Bands (signature)
- **Shape:** a bordered stack of four bands (hairline border around, 1px rules between), each ≥92px (≥102px at `md`), square.
- **Anatomy:** a 44/58px letter cell in mono 15px bold inside a right hairline; option text 15.5→17px at ≤68ch; a 30×26px mono key box at the right edge showing the shortcut digit.
- **Selection:** the navy flood — `ink-flood` sweeps `clip-path: inset(0 100% 0 0)` to `inset(0 0 0 0)` in 460ms on `cubic-bezier(0.16, 1, 0.3, 1)`; the letter knocks out to white, the label to #eef1f5, the letter-cell hairline to navy-soft/25, the key box to navy-soft/40.
- **Hover / focus:** unselected bands take a paper wash; focus lands as an ochre outline inset -2px (the band is full-bleed inside its border). Reduced motion collapses the flood to 1ms.

### Move Rail (signature)
- **Style:** fixed 104px left column at `lg`, horizontal mark strip below; 12px square marks at 22px pitch, each trailed by a hairline line that becomes a 2px ochre rule for the current move.
- **States by form:** filled navy = answered; hollow (1px soft-ink/45 border) = unanswered; 2px ochre ring over a half-ochre/half-white gradient = current; dashed ochre on sheet = saved-but-unsaved (pending); hollow square with a 45° strike = declined (skip). Each mark carries an sr-only label; state is never colour alone.
- **Result cell:** a bordered mono box at the rail's foot, labelled `RESULT` in 10px / 0.2em soft ink. It holds an em dash for the entire assessment and only resolves to `FILED` (certified green) once the record is submitted; it never shows a running score.

### Sheet Furniture
- **Sheet:** white, full-bleed — the viewport itself: no border, no width cap, no shadow.
- **Masthead:** 56px; 11px navy seal, 11.5px/0.19em bold uppercase title; right side holds the mono move counter (11px soft, numerals 13px bold ink) and the save status.
- **Ruled rows:** label/value grid (120px label column at `sm`, stacked below it), 1px top rule between rows, 16px/20px padding; label mono 11px / 0.18em soft, value 14–14.5px ink. Used by the landing conditions, entry form, confirm rows, and submitted facts.
- **Save marks:** 10px squares — certified filled = saved, dashed ochre = saving, 2px flag ring = failed. Paired with a mono status word (`PROGRESS SAVED`, `SAVING MOVE 07…`, `SAVE FAILED`) and a polite live region.

### Inputs & Fields
- **Style:** entry and admin fields are square, transparent, with a single 1px bottom hairline (rule); 17px text, soft-ink placeholder, ochre caret. Selects and textareas use a full 1px rule border on sheet white (mono 12.5px for selects; 15px for the example textarea).
- **Focus:** the bottom hairline (or full border) shifts to ochre; no glow, no ring.
- **Error:** border and message switch to flag red; the field carries `aria-invalid`.
- **Search:** the inventory search is a single bottom hairline inside the catalogue frame, next to a `319 SHOWN` mono count.

### Chips, Badges & Marks
- **Filter chips:** square, mono 11px / 0.08em uppercase; resting sheet white with hairline border; active is navy fill with white text; hover darkens the border and text to navy.
- **Selection chips:** removable tool chips — sheet white, hairline border, mono 11.5px, with a drawn 9px cross; hover turns border and text flag red (the one destructive hover).
- **Badges:** the `Top three` badge and status pills are outlined mono 10–10.5px / 0.12em uppercase; filed pills are certified green on sheet, in-progress pills are ochre (staff record page) or neutral soft (lists).
- **Checkbox / radio:** 17px square checkbox, navy-filled when checked, with a drawn white check (11px, 1.6px stroke); the inventory radio is the system's only circle (15px ring, 5px navy dot).

### Tables (staff side)
- **Style:** hairline-bordered, `border-collapse`; header row on a 60% paper tint; headers mono 10.5px / 0.16em soft-ink uppercase; row hover is a 70% paper wash; numerals right-aligned in tabular mono (12–15px bold for scores); progress renders as a 6px navy fill on a 50% rule track.

### Filed Stamp
- **Style:** the submitted screen's boxed stamp — 2px certified-green border, 28px×16px padding, `FILED` in mono 15px / 0.4em bold certified green, UTC date beneath in 11px / 0.16em soft ink.

### Browser Surfaces
- **Selection:** navy background with sheet-blue text (#eef1f5), globally.
- **Focus:** 2px ochre outline, offset 2px, globally (`:focus-visible`).
- **Caret:** ochre in every text field.
- **Scrollbars:** thin, thumb in hairline rule with a 3px paper border, square corners; the thumb deepens to soft ink on hover. The browser's own surfaces are themed, not left to the user agent.

### Named Rules

**The Flood-Not-Outline Rule.** Selection is a navy flood, swept across the band by the ink-flood clip-path (460ms, ease-press). Selection is never an outline, a border thickening, or a fade.

## Do's and Don'ts

### Do:
- **Do** divide the sheet with 1px hairlines (#d4d8d2) instead of adding cards, panels, or shadows.
- **Do** flood the navy selection with the ink-flood sweep (460ms, cubic-bezier(0.16, 1, 0.3, 1)) and knock the letter cell to pure white, the label to #eef1f5.
- **Do** carry every state by mark form as well as colour: filled/hollow/half/dashed/struck rail marks, square/dashed/ringed save marks, lettered key boxes.
- **Do** set every numeral in Chivo Mono with tabular figures — `MOVE 07 / 21`, dates, character counts, catalogue counts.
- **Do** keep candidate-facing surfaces free of score, tally, or pass/fail framing; the result cell stays an em dash until the record reads FILED.
- **Do** keep every surface flat; hover answers are a paper wash (#f5f6f4) or a one-step navy deepen (#16293f).

### Don't:
- **Don't** add shadows anywhere — buttons, bands, chips, tables, hover states, or page frames.
- **Don't** use flag red or certified green as decoration, brand accents, or category colours — they mean failure and confirmed completion, nothing else.
- **Don't** use ochre as a fill, selection, or hover background; it belongs to focus and the current move only.
- **Don't** round corners — the inventory radio marker is the sole circular form, and it is a control affordance, not decoration.
- **Don't** use glyph characters or icon fonts as icons; every mark is drawn — inline SVG strokes at 1.2–1.6px with square caps, matching the hairline weight, at 0°, 45°, or 90°.
- **Don't** use the mono face as a costume over prose, or the sans face for data numerals.
- **Don't** add a timer, countdown, auto-advance, or any urgency treatment to candidate surfaces; the world is deliberately clockless.
