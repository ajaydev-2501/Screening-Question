---
version: 1
slug: "app-assessment-page-tsx"
primary_target: "app/assessment/page.tsx"
related_targets: ["app/page.tsx","app/admin/page.tsx"]
---

# Surface brief — candidate assessment flow

**Scope:** the candidate-facing assessment: the landing page, the 21 one-question-per-screen flow (20 scored + the Question 21 tool inventory), the confirmation screen, the submission result screen. Related surfaces inheriting this world: the recruiter admin dashboard.

**Visitor mode:** Operate for the question flow (the candidate completes a task under mild evaluation anxiety); Persuade for the landing page (the candidate decides to begin).

**Audience and job:** developers applying for a MERN + AI Agentic Engineering role, completing a 20–30 minute single-attempt screening alone, often on a laptop, sometimes a phone. Recruiters review results later on a desktop.

**Constraints that bind:** neutral light ground (brief-pinned), no timer, no countdown, no auto-advance, no sidebar chrome, keyboard 1–4, WCAG-conscious, one question per screen, scoring weights and competency groupings never revealed to the candidate.

---

## Direction contract

**THESIS:** An assessment is a game record, not a form. Every answer is a logged move in one continuous sequence, and the outcome is published as a rating — an estimate offered to an arbiter, never a verdict. The category-default arrangement this refuses: the centred question on pure white with four floating rounded cards and a thin progress bar, which says "quiz" and reads identically on every hiring platform.

**OWN-WORLD:** Tournament bond paper `#f5f6f4` as the ground, a pure white `#ffffff` sheet inset on it, ink `#14181c`, soft ink `#5a6470`, hairline rules `#d4d8d2`. Federation navy `#1c3557` owns structure and the selected state; current-move ochre `#b8801f` owns focus and the live marker; flag red `#a8322a` and certified green `#2f6b46` are reserved for state and never decoration. Type: a compact grotesque for prose and labels, a monospace with true tabular figures for every numeral, notation column and identifier. Squared corners (2–4px), hairline rules instead of shadows, elevation declared once.

**STORY:** The candidate reads that this is a record of their decisions, not a score being tallied behind a curtain. They answer 21 moves, see the sheet filling in, and are never rushed. They reach a boxed result cell — `1–0`, `0–1`, `½–½` in chess — reframed here as a submitted record, and understand the number is an indicator for an interviewer, not a judgement of them. The recruiter later reads the same sheet as a rating card per competency.

**FIRST VIEWPORT:** Slim sheet header — assessment name in tracked uppercase left, `MOVE 07 / 21` in tabular mono right, save-state mark beside it. Left edge: a vertical rail of 21 equal steps, one per question, hairline breaks between the seven sections, height carrying no information whatsoever. State by mark form as well as colour: solid filled = answered, hollow = unanswered, inverted half = current, dashed = answered but unsaved. Centre: a narrow move-number gutter in tabular mono, a hairline rule, then the question at large display size, 65–75ch measure. Below it four squared ruled option bands A–D, each ~72px tall, hairline separators, one flooded navy in the selected state with its numeral knocked out to white. Sheet footer: Back as a quiet secondary, Next as the filled navy primary, and `Press 1–4 · Enter to continue` set small. No timer anywhere.

**FORM:** The Tournament Scoresheet — FIDE chess tournament paperwork. Ranked 5 of 7 grounded candidates by resonance for this audience; seed key `0ce4662c`, mode operate. Raised by five donations: the stepped fore-edge rail (`challenger-acetate`), fixed per-item furniture for finite rosters (`challenger-shelf`), mark-form state never colour alone (`challenger-emission`), strength as fill density against a fixed axis rather than hue (`challenger-labanotation`), one accent owning every live state with selection flooding rather than outlining (`challenger-metro`), and all rules at 0/45/90 degrees only (`challenger-transit`).

**Security translation of one raise:** the acetate challenger's "tab height proportional to that section's extent" would publish the competency weighting, which the brief forbids. Translated: 21 equal steps with hairline section breaks, so the rail communicates position and completion only. This translation is binding.

**FINISH:** unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.

---

## Unresolved decisions

- Whether the seven competency section breaks in the rail are visible at all, or whether the rail is 21 undifferentiated steps (safest reading of the no-scoring-leak constraint).
- The exact wording of the boxed result cell on the submission screen, which must not imply pass or fail.
