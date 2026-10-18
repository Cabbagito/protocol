# How diet works

The Diet tab after the October 2026 redesign. Designs: Claude Design canvas
"Diet — meals by time" (https://claude.ai/artifact/AZGhAGWdzJD5iSXuYTdrDU);
components and rules: the Protocol design system, group "Diet" (link in
`CLAUDE.md`).

## Meals

- **A meal is whatever someone ate at one time.** There are no breakfast/lunch/
  dinner slots: a day is a timeline of meals by time (`meals.eaten_on`, the user's
  local date, and `eaten_at`, the local wall clock).
- **A meal is saved as a full snapshot.** `PUT /api/meals/{id}` with `{eaten_on,
  eaten_at, name, items[]}` creates or replaces it; the id is a UUID made by the
  client, so saving is idempotent and the same call can later serve local-first
  drafts (as `PUT /api/workouts/session` does). Another user's meal id answers 404.
  A snapshot needs at least one item; removing the last food deletes the meal.
- **Items copy what they need.** `meal_items` keep the food's name and the macros
  for the amount, plus how the amount was entered (`unit_name` + `unit_quantity`,
  or grams when `unit_name` is null) and the grams. Editing or deleting the food
  later doesn't change logged meals (`food_item_id` becomes NULL on delete).
  Items logged before the redesign may have no grams; they can only be removed.
- **Day and range reads.** `GET /api/meals?date=` returns the day's meals by time,
  totals and the user's targets. `GET /api/meals/days?from=&to=` returns kcal per
  day with meals (at most 92 days), for the week strip and the month calendar.

## Names and summaries (Claude Haiku)

- After a save whose items changed, a background task asks `claude-haiku-5-5`
  (`services/meal_summary.py`, structured output) for a name and for the items
  grouped into two or three lines, by item number. About $0.00007 a meal.
- The answer is stored with `summary_key`, a fingerprint of the items it describes
  (`meal_service.items_key`), and only if the meal still has those items. Responses
  carry the name and summary only while they describe the current items; until then
  (or without a key) `name` and `summary` are null and the client shows the foods
  ("Oats & Banana", "Oats, Whey & 2 more").
- A name the user typed (`name` in the snapshot) sets `name_source = user` and
  always wins; a snapshot without a name hands the meal back to Claude.
- The card's amounts come from the items, never from Claude: a line with one item
  shows its own amount, a group shows its grams. If Claude's lines don't cover every
  item exactly once, the summary is dropped and the card lists the foods.
- The client refetches the meal and its day 3 s after a save that came back unnamed.

## Foods and units

- **Visibility** follows the usual pattern: seeded foods and barcode products are
  shared (`user_id` NULL), custom foods belong to their creator.
- **Who may change what:** seeded foods are read-only (403). Barcode products
  describe an objective product, so any user may correct one (`PUT /api/foods/{id}`)
  but nobody may delete it (403), since others may have logged it. Custom foods are
  their owner's to edit and delete. `POST /api/foods` with a barcode that already
  exists returns that food with 200 and ignores the submitted values.
- **Units** (`food_units`) are named amounts of a food ("cookie" = 12 g). A food's
  own units have `user_id` NULL: they come from the seed data, the label or whoever
  may edit the food, and an update replaces them. Personal units (`POST
  /api/foods/{id}/units`, from the Amount sheet's "+ unit") belong to one user, on
  any food they see. Visible units are the food's own plus the user's; names are
  unique per food and owner, case-insensitively, and "g"/"grams" is never a unit
  (grams always are).
- **Search** (`GET /api/foods?q=`): every word must match the name or the brand;
  foods the user logged come first, most recent first, each with `last_used` (the
  last unit, number and grams), then names starting with the query, then the rest.
  With no query the client shows the recent ones.

## Products from the pack

- **Scanning** looks the barcode up in our foods, then Open Food Facts
  (`GET /api/foods/by-barcode/{code}`): a complete OFF product is saved as a shared
  food with its serving and pack sizes as units; otherwise the partial draft opens
  New product with the code.
- **Label reading** (`POST /api/foods/read-label`): one to four photos (downscaled
  on the phone to 1568 px JPEG, sent as base64) go to `claude-opus-5-5` with a
  structured-output schema; it returns name, brand, per-100 g values (converted from
  per serving or kJ when needed) and units such as "cookie" and "pack". Nothing is
  saved; the user checks the values, which stay marked until edited. 30 readings per
  user per hour; about 2–3 cents each. Without `ANTHROPIC_API_KEY` it answers 503 and
  the product is typed in.

## Screens

- **Diet** (`/diet`, `/diet?date=` for past days): chrome with day arrows and the
  title opening the month calendar, the week strip (kcal per day against target),
  day totals (kcal and protein lead, carbs and fat beneath), the timeline, the
  bodyweight card, and the floating "Log meal".
- **Meal** (`/diet/meals/:id`): `/diet/meals/new?date=` gets a fresh id and keeps
  its date and time in the address (`?new=1&date=&at=`) until the first food saves
  it. A new meal shows Eaten at, the foods and the search; an existing one adds its
  totals and Name, and its ⋯ menu has "Log again today" and "Delete meal". Its back
  button goes to the meal's day.
- **Amount sheet:** unit pills (grams, the food's and the user's units, "+ unit"),
  one number with −/+, the grams and live macros; "Add to meal", or "Save" and
  "Remove from meal". "Edit product" for foods the user may correct.
- **New product / Edit product** (`/diet/products/new?barcode=&back=`,
  `/diet/products/:id`): photo slots (the second photo starts the reading), the
  barcode with rescan, name, brand, per-100 g values and units. Saving a new product
  returns to the meal with its Amount sheet open (`?add=<food id>`).

## Saving and sync (offline)

Meals save the way workouts do (`docs/WORKOUT-LOGIC.md`): on the phone first, then in
the background (`frontend/src/lib/mealSync.ts`).

1. Every change to a meal (a food added, changed or removed, the name, the time,
   "Log again today", deleting it) is written to the phone's storage at once as the
   meal's full snapshot, one draft per user and meal. Deleting leaves a tombstone.
2. One background queue sends the drafts, oldest first: `PUT /api/meals/{id}` with
   the snapshot, `DELETE` for a tombstone (404 counts as done: the meal never reached
   the server). It retries with backoff until the server confirms, and again when the
   phone comes back online or the app is reopened. A snapshot the server rejects (a
   food that was deleted, say) stays on the phone, flagged, until the user taps retry.
3. Once confirmed, the snapshot is dropped and the server's copy is shown (with
   Claude's name a moment later). A confirmed tombstone stays for a week, the life of
   the cached data, so a response loaded before the delete can't bring the meal back.

The day, the meal and the week strip and calendar show the server's data with the
drafts laid over it: unsynced meals are in the timeline and the totals, deleted ones
are gone. A day that was never loaded shows only its drafts and says "Offline · this
day needs a connection". The meal's header shows **Synced**, **Syncing…**,
**Offline · saved on phone**, or **Not synced · retry** (tap to retry).

**Needs a connection:** searching foods (offline, the search says so and lists the
matching foods already on the phone: the recent ones, which are kept with the app's
data, and any loaded since it opened), scanning, reading a label, new or edited
products, and adding a unit. A logged food whose product isn't on the phone opens in
the unit it was logged in.

## Not yet

- Quick add (numbers without a food) and describing a whole meal to Claude are not
  designed. Search covers our own foods only (Open Food Facts text search was
  unreliable when tried).
