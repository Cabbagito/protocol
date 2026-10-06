---
argument-hint: <description of what to design>
---

# /design-prototype — Brainstorm & Prototype UI Designs

Create and iterate on standalone HTML prototypes in `frontend/design/` using the `frontend-design` skill for high-quality output.

## Context

The `frontend/design/` directory holds single-file HTML prototypes used for brainstorming UI before implementing in React. Each file is self-contained (inline Tailwind via CDN, inline styles, no external deps beyond CDN links).

**Before generating anything**, read `docs/design-v5/README.md` (the implemented design spec — mind its status note: there are no animated backgrounds) and the theme tokens in `frontend/src/index.css` / `frontend/src/lib/themes.ts` for colors, typography, component specs, and the muscle group palette. All prototypes must follow this style guide. If you discover the style guide is missing information relevant to the prototype, note it so it can be updated.

## Steps

1. **Understand the request:** Read `$ARGUMENTS` to understand what the user wants to design. If vague, ask a brief clarifying question before proceeding.

2. **Read the style guide:** Read `docs/design-v5/README.md` to load the current design tokens, color palette, and component specs.

3. **Review existing prototypes:** Scan `frontend/design/` to see current files and avoid name collisions. If the user is iterating on an existing prototype, read it first.

4. **Generate the prototype:** Invoke the `frontend-design` skill to create the HTML file. Pass it the user's design request along with the relevant parts of `docs/design-v5/README.md` and these constraints:
   - Single self-contained HTML file
   - Mobile-first (375px viewport), designed for PWA
   - Follow `docs/design-v5/README.md` — theme CSS variables, muscle colors, text hierarchy, component styles; static backgrounds only (no continuous animation)
   - Fonts: Inter for body text, JetBrains Mono for data/numbers (load from Google Fonts CDN)
   - Tailwind via CDN (`<script src="https://cdn.tailwindcss.com"></script>`)
   - Use the static page background from the spec (no animated layers)
   - Include multiple variations/approaches when the user is exploring — e.g. 2-3 different card layouts, header styles, or interaction patterns side-by-side so they can compare

5. **Save the file** to `frontend/design/prototype-{descriptive-name}.html`. Use a short, descriptive kebab-case name.

6. **Open for review:** Run `open frontend/design/{filename}` so the user can see it in their browser immediately.

7. **Iterate:** The user will give feedback — "I like the second card style", "make the header sticky", "try a bottom sheet instead", etc. For each round:
   - Read the current file
   - Invoke the `frontend-design` skill again with the feedback and current file contents
   - Update the file
   - Open it again

The goal is rapid visual exploration. Keep the feedback loop tight — generate, review, refine.

## After Prototyping

When the user approves a design and moves to implementation (planning or coding), **commit the prototype HTML file first** so the design is preserved in version control before the React implementation begins. Use a commit message like `chore: add prototype for {feature}`.
