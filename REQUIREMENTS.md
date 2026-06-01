# Calorie & Nutrition Tracker — Requirements

## Project overview

A single-user calorie and macro tracking web app, self-hosted on a Raspberry Pi and accessed over a Tailscale network. The user manually enters all nutrition values — the app does no estimation, database lookup, or external API calls.

## Tech stack

- Raspberry Pi (existing hardware)
- Node.js (already installed)
- SQLite for storage (already used by other apps on the Pi)
- React frontend
- Tailscale-only access — no authentication

## Data model

- **SavedMeal** — name, calories, protein, carbs, fat, and an optional category. Persists across sessions. Editable and deletable by the user from the Saved Meals page.
- **Category** — a user-created label for organising the saved-meal library. Name only (unique, case-insensitive). A SavedMeal belongs to at most one category; meals without one are "Uncategorized". Deleting a category leaves its meals Uncategorized. Categories apply only to the library, not to logged meals.
- **Session** — id, start date, end date (null while open), daily calorie target, daily protein target, status (`open` / `closed`), optional starting and ending weight (kg).
- **Meal** — belongs to a session and a date; name, calories (required), protein (required), carbs (optional), fat (optional). May optionally reference the SavedMeal it was created from, but stores its own copy of the values so edits/deletes of the source SavedMeal do not affect historical entries.
- **DailyTotal** — per-day calories and protein; retained when a session is archived and its one-time meals are deleted.
- **DailyWeight** — per-day weight (kg) for the open session. At most one entry per day. Deleted when the session is closed; only the session's starting/ending weight survives in the archive.

Day boundaries follow the Pi's local timezone (midnight to midnight).

## Pages

1. **Home / Today** — today's overview, today's weight, and the 90-day history table (each history day opens an editor for that day).
2. **Add Meal** — modal launched from Home (today) or from a day in the history table (any day of the open session).
3. **Saved Meals** — manage the saved meal library (view, edit, delete) and its categories, grouped by category.
4. **Archive** — list of closed sessions.
5. **Session Detail** — drill-down view of one archived session.

## Functional requirements

### First run / no open session

- Prompt the user to create a new session.
- Capture daily calorie target and daily protein target at creation time.
- Optionally capture a starting weight (kg).

### Home — today's overview

- Shows today's totals: calories, protein, carbs, fat.
- "Add meal" button in the top right.
- Today's meals can be added and edited.
- Earlier days in the open session are editable too: clicking a day in the history opens a modal to add, edit, and delete that day's meals.
- A "today's weight" card lets the user log or clear a single weight value for the current day.

### Adding a meal

- Pick from the saved-meal library **or** create a new one. The library picker can be filtered by category.
- For a new meal, a checkbox decides whether it's also added to the saved library. When saving to the library, the user may file it under an existing category or create a new one inline.
- Picking a saved meal copies its numbers exactly into a new Meal entry.
- Calories and protein required; carbs and fat optional.
- Available for any day of the open session — today by default, or a past day chosen from the history. Dates before the session start or in the future are rejected.

### Daily history (below today's overview)

Up to the last 90 days of the current session. For each day, show total calories and total protein with progress bars against the session's targets:

- **Calories bar** — green while at/under the target; red (full) once over.
- **Protein bar** — red while under target; green once the target is met or exceeded.

Numeric values are shown next to both bars. Clicking a day opens a modal to add, edit, or delete that day's meals (open session only; archived sessions stay read-only).

### Sessions

- A session spans up to 90 days.
- The user can close a session at any time, optionally entering a final weight.
- On close: meals not marked reusable are deleted; per-day weight logs are deleted; daily totals (calories + protein) and the session's starting/ending weights are preserved. The session moves to the Archive.
- On day 90: warn the user; on day > 90, block further meal and weight entries — including edits to earlier days — until the session is closed. No auto-close.

### Saved Meals page

- Lists every meal in the saved library, grouped by category (with an "Uncategorized" group).
- User can edit any field (name, calories, protein, carbs, fat) and assign a category.
- User can delete saved meals.
- User can create, rename, and delete categories. Deleting a category moves its meals to "Uncategorized" rather than deleting them.
- Editing or deleting a SavedMeal does **not** retroactively change Meal entries that were created from it — those are independent copies.

### Archive page

- List of closed sessions with date range, day count, targets, and any recorded start/end weight.
- Selecting one opens the Session Detail view.

### Session Detail page

- Per-day totals (calories + protein only) for the selected archived session.
- Shows starting and ending weights when recorded.

### Export

- Pretty-printed JSON of the current open session only.
- Includes the session row, daily totals, per-day weights, and the session's meal entries with full nutrition data.
- Excludes the saved-meal library.

## Implementation notes

The following were left open in the initial spec and resolved during build:

1. **Protein bar coloring** — implemented as red below target, green at/above target.
2. **JSON export schema** — `{ exported_at, session, daily_totals, daily_weights, meals }`; see `server/routes/export.js`.
3. **Protein target requiredness** — required at session creation (server returns 400 if missing or non-positive).
4. **Add Meal UI** — implemented as a modal launched from the Home page.

## Non-goals (for now)

- No authentication or multi-user support.
- No automatic nutrition lookup or estimation.
- No editing of archived (closed) sessions — only the open session is mutable.
- No mobile-specific UI work beyond what comes from being a responsive React app.
