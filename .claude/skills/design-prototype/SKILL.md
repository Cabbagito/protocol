---
argument-hint: <description of what to design>
---

# /design-prototype — Design screens in Claude Design

Propose new UI as a Claude Design artifact built on the Protocol design system, iterate there with the user, and only then implement it in React. Designs are not kept in the repo.

## The design system

**Protocol** — https://claude.ai/artifact/NsJhqrd6Vh2U8Snyb7mWkz (a Design System artifact).

It holds the visual spec: tokens for 8 of the 15 themes plus muscle, macro and status colours (from `frontend/src/lib/themes.ts`, `index.css`, `lib/muscleColors.ts`), type styles, spacing and radii, voice and copy rules, layout and motion rules, and guidelines with live previews for the shared components (Chrome, BottomNav, NumeralsCard, ProgressRail, Meter, ListRow, Button, ActionSheet…). Its `README.md` ends with an "Open" list of known problems; read it before relying on a token.

## Steps

1. **Understand the request.** Read `$ARGUMENTS`. If it's vague, ask one short question first. Decide whether it needs directions (layout open: show 2–3) or one design (details only).
2. **Read the design system.** Artifact `read` on the design system URL with `path: "project/README.md"`, then the component cards you'll use (`project/components/<Name>/README.md`). Don't guess values: take them from `project/tokens.json`.
3. **Look at the real screen.** For a redesign, read the current page's code and, where it helps, run the app (`docker compose up`, the `frontend-docker-api` launch config, password from `docker-compose.yml`) and look at it at 390 × 844.
4. **Make the design.** Artifact `quickstart` with `intent: "design"` and `design_systems: false`, then start a Design artifact from the type it names, passing the Protocol design system link, and follow that type's instructions. Constraints:
   - Phone artboards at 390 × 844 on the static gradient ground (`.pr-screen`), with the floating nav where the screen has it.
   - Real content: real exercise names, weights, foods, dates. No lorem ipsum.
   - Reuse the system's components; anything new is drawn from its tokens.
   - Static: no continuous animation.
   - When showing directions, label each with one sentence on what it trades.
5. **Hand it over.** Give the user the link and a few lines on the directions and any data-model questions the design raises. Iterate on the same artifact when they comment or reply.

## After approval

- Implement in React from the design. Put the design's link in the PR description.
- If the work adds or changes a shared component or a token, update the design system in the same piece of work (revise its `tokens.json`, add or edit the component card), so the next design starts from what the app really looks like.
