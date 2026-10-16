# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js App Router, React, TypeScript (strict), Tailwind CSS, shadcn/ui where appropriate, Neon PostgreSQL, Drizzle ORM with migrations, Zod for server validation, React Hook Form only where it earns its place, Vitest, Playwright. Confirmed by the client brief; the user reconfirmed Next.js for this build.

## Users

Two distinct audiences.

**Candidates** — developers applying for a MERN Stack Developer role with strong AI Agentic Engineering skills. They arrive from a job posting or recruiter link, usually alone, often on a laptop but sometimes a phone, in a state of mild evaluation anxiety. Their job is to answer honestly and completely in one 20–30 minute sitting, and to leave feeling the process was professional rather than interrogative.

**Recruiters / engineering leads** — a small internal team reviewing applicants. Their job is to compare candidates quickly, see where the multiple-choice signal is weak, and walk into an interview with specific follow-up questions. They use the admin dashboard on a desktop, repeatedly, across many candidates.

## Product Purpose

A single-attempt screening assessment that measures *how a developer thinks when working with AI coding agents*, not whether they can recite definitions. Every question presents a realistic engineering situation where all four options are plausible and represent different levels of engineering maturity. Success means: the candidate completes it without friction or confusion, and the reviewer receives a structured, evidence-based set of screening indicators that tells them what to probe in the interview.

The product exists because a definition quiz cannot distinguish a developer who orchestrates agents with bounded responsibility and independent verification from one who pastes prompts and hopes. The assessment's job is to surface that difference.

## Positioning

The scoring model rewards *verification behaviour*, not sophistication of language. Each option's proficiency level (1–4) is deliberately assigned to the engineering decision it represents — for example, commissioning an independent review agent scores differently from treating that agent's verdict as unquestionable authority, even though both options mention a review agent. A competing quiz could copy the questions; it could not copy the key's discrimination between plausible-sounding answers.

Results are labelled screening indicators, never measurements of competence, and are never used to auto-reject. A human interviewer always reviews.

## Operating Context

- Candidates start from a landing page that states the title, a short explanation, the 20–30 minute estimate, an instruction to choose the approach they would actually use in real development, and a notice that progress saves automatically.
- Exactly one question per screen. Keyboard shortcuts (1–4) select options. Back and Next controls, progress indicator, and save status are always visible. No timer, no countdown, no sidebar, no auto-advance on selection.
- Question order is randomized once per session and persisted; it never re-randomizes on refresh, resume, or browser restart.
- Question 21 is a separate, unscored tool-experience inventory: a searchable multi-select across thirteen categories (A–M) with four follow-up fields, presented as one question screen rather than thirteen.
- Answers autosave to PostgreSQL with debouncing. Refresh, navigate back, close the tab — nothing is lost.
- Submission is one-time and atomic. A confirmation screen precedes it and explains that submitted assessments cannot be edited or resubmitted.
- Recruiters work in a separately authenticated admin area: filter and sort by status and score, read the per-section skill radar with its strongest-skill callout and screening band, review the selected answers with their levels, export CSV; records filed under the retired competency model still render their evaluation notes and risk findings.

## Capabilities and Constraints

**Confirmed decisions from the interview:**

- **Admin authentication:** an env-seeded admin login. `ADMIN_EMAIL` and `ADMIN_PASSWORD` from the environment, hashed with argon2, issuing a Secure / HttpOnly / SameSite session cookie. Real server-side authorization on every admin route — hiding a link in the frontend is explicitly insufficient.
- **Candidate recovery:** cookie-only resume. The high-entropy session token in an HttpOnly cookie is the sole proof of identity; only its hash is stored server-side. No email provider is integrated, so there is no magic-link path — a candidate on a new browser or a cleared cookie store starts a fresh session. This also removes any email-enumeration leak: the product never tells an unauthenticated visitor whether a given address has an assessment in progress.
- **Question 21 placement:** always the final question screen, after the twenty scored questions and before the confirmation screen. It is excluded from randomization and contributes nothing to the 0–100 score.

**Hard constraints:**

- One assessment per normalized email per assessment version, enforced by a database constraint, not application logic alone.
- Scoring rules, option weights, correct-answer labels, and internal evaluation notes must never reach client JavaScript, public API responses, HTML, or static files.
- The browser is never trusted as proof of identity; no candidate ID is accepted from a request as authority.
- Candidates cannot modify status, score, submission timestamp, or question order through any client request.
- `DATABASE_URL` lives in an ignored `.env.local` locally and a secret manager in production. Emails, session tokens, and credentials are never logged in full.
- Rate limiting on session creation and recovery. Security headers on all responses.
- The tool catalog is versioned so new tools can be added without breaking existing assessment records.
- The question bank is versioned so existing assessments remain interpretable if questions change later.

**Undecided:** the deployment target (Vercel is the natural fit for Next.js + Neon but was not confirmed).

## Brand Commitments

The client brief pins the candidate-facing aesthetic: clean, premium, minimal, Typeform-inspired. White or subtle neutral background. Strong typography. Large, clearly selectable answer cards. Smooth transitions between questions without unnecessary animation. The assessment must feel trustworthy, professional, and easy to complete.

The brief also pins explicit negatives: no cluttered sidebar or dashboard chrome in the candidate flow, no distracting timer or forced countdown, no automatic advancement immediately after selecting an answer.

Assessment title, fixed: **AI Engineering Developer Assessment**.

No logo, brand palette, or typeface was supplied. Nothing here may be treated as an existing brand identity.

## Evidence on Hand

- The complete client brief: `C:\Users\remot\.qoder\tmp\D--Client-Client-Screening-Question\attachments\e6d63fa1-d781-4ba1-9c80-a60536bfcd37\80866da6-9b1f-4798-8c42-fd2d7c88ebd9.txt` — twenty questions with all eighty options verbatim, seven competency weights, thirty acceptance tests, full security requirements.
- The Question 21 tool inventory: thirteen categories A–M with every tool name, four follow-up fields, and eleven implementation rules.
- A live Neon PostgreSQL database, `screening_question`, connection string supplied by the user.

**Absences that must not be fabricated:** there are no real candidates, no real scores, no testimonials, no client logos, no company name, and no hiring-page copy. Any illustrative candidate data authored for the admin dashboard must be labelled synthetic. No pricing, no benchmarks, no claims about assessment efficacy beyond "screening indicator".

## Product Principles

1. **Plausibility is the instrument.** Every option must be a choice a competent developer might actually make. An obviously wrong answer destroys the question's discriminating power and the candidate's trust at once.
2. **The candidate is a guest, not a subject.** The interface reduces anxiety rather than applying pressure: no timer, no countdown, no red flags, visible save status, permission to go back. A candidate who feels watched answers defensively and the signal degrades.
3. **Nothing is lost, ever.** Autosave, persisted order, resumable sessions, and idempotent submission are the product's core reliability promise. A lost answer is a lost candidate.
4. **Scoring stays in the dark.** The rubric is the product's real IP. Any leak into a public payload, bundle, or HTML comment breaks the assessment's validity for every future candidate.
5. **Indicators, not verdicts.** Every result is framed as a reason to ask a better interview question, never as proof of ability and never as grounds for automatic rejection.

## Accessibility & Inclusion

WCAG-conscious accessibility is an explicit brief requirement, not an aspiration. Keyboard navigation throughout, including number keys 1–4 for option selection and full operability of the Question 21 multi-select (search, category filters, selection review) without a pointer. Clear visible focus states. Accessible focus handling on question transitions so a screen reader announces the new question rather than losing its place. Sufficient contrast on a light neutral ground. Responsive across mobile, tablet, and desktop — the client's acceptance tests require the candidate experience to work on both mobile and desktop.
