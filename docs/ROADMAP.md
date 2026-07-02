# Protocol — Roadmap

**Last Updated:** 2026-07-02

Next feature ideas, in rough priority order. These are intentionally beyond the
original PRD scope (which is outdated — see the note at the top of `PRD.md`).

---

## 1. Weigh-ins (bodyweight tracking)

Track and visualize bodyweight — no automatic target adjustment, just data.

- New `weigh_ins` table: `user_id`, `date`, `weight_kg` (one entry per user per day, upsert).
- Quick-entry UI (Diet page or Dashboard), plus a trend chart: raw points + a
  smoothed weekly moving average so daily noise doesn't obscure the trend.
- Unlocks later features for free: protein-per-kg, diet-phase context, and the
  diet side of the analytics refresh.

Small, self-contained, and everything else in the diet direction benefits from
this data existing as early as possible.

## 2. AI meal creation / logging (text + photo)

Use Claude (the `ANTHROPIC_API_KEY` config stub already exists) to turn a text
description ("chicken wrap, a coke, handful of almonds") or a photo of a meal
into one or more log entries with estimated macros, shown for confirmation
before saving.

- Backend endpoint that calls the Claude API with structured output
  (name, quantity, kcal, protein, carbs, fat per item).
- Frontend: a third tab in `AddFoodSheet` (text box + camera/photo picker),
  results rendered as editable rows before confirming.
- Start with text (cheap, fast, no upload plumbing); add photo second.

Biggest logging-friction win by far — the current search/custom flow is the
main reason a meal doesn't get logged.

## 3. Barcode scanner + food database

Scan a barcode to resolve a food, backed by Open Food Facts.

- Frontend: camera-based scanner (e.g. `html5-qrcode` or the native
  BarcodeDetector API where available) in `AddFoodSheet`.
- Backend: lookup endpoint — check local `food_items` by barcode first, then
  Open Food Facts API, caching hits as food items (needs a `barcode` column).
- Complements AI logging: barcode for packaged foods, AI for everything else.

## 4. Analytics refresh (mesocycles + diet)

A rework of the Progress area once the data above is in place:

- **Training:** weekly sets per muscle group, tonnage per session/week,
  PR detection — all derivable from the existing mesocycle JSONB.
- **Diet:** calorie/protein trend lines, adherence vs. daily targets
  (streaks/weekly view), weight trend overlay from weigh-ins,
  protein per kg bodyweight.

Deliberately last: it gets much better once weigh-ins (1) and richer logging
(2/3) have produced data worth visualizing.

---

## Not planned right now

- Offline-first logging (mutation queue / API caching in the service worker)
- Glucose domain (still referenced in the PWA manifest copy; unbuilt)
- Per-user identity / passkey auth — the single-password-per-user model is a
  deliberate simplicity choice for a friends-and-family app
