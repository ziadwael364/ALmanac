# Almanac — a personal life planner

One place to plan time, track what matters and look back on how it went.
Runs entirely in the browser: no build step, no server, no account. Open
`index.html` and it works.

## Principles

1. **Time is the backbone.** Everything (tasks, habits, focus sessions,
   goals) can land on the calendar or be measured against it.
2. **Fast capture.** One input understands plain English:
   `gym tomorrow 6-7:30pm #health every mon,wed,fri`.
3. **Flexible, not rigid.** Recurring events with exceptions, weekly
   timetables you can stamp onto any date range, tasks that auto-fit into
   free time.
4. **Your data is yours.** Saved locally, synced through the artifact store
   when published, exportable to JSON and `.ics` at any time.

## Modules

| # | Module | What it does |
|---|---|---|
| 1 | **Today** | Now/next, today's timeline, due + overdue tasks, today's habits, focus minutes, mood check-in, day progress and free time left |
| 2 | **Calendar** | Day, 3-day, week, month, agenda and year views. Drag to create, drag to move, drag the edge to resize, overlap layout, now line, conflict warnings, category filters, tasks shown on their due day, drag a task onto the grid to time-block it |
| 3 | **Timetable** | Weekly templates (school term, work rota, gym split). Edit them on a grid, then apply to a date range as recurring events |
| 4 | **Tasks** | Smart lists (Inbox, Today, Upcoming, Overdue, Someday, Done), projects, tags, priorities, subtasks, estimates, repeating tasks. List, board and Eisenhower-matrix layouts. Auto-schedule into free slots |
| 5 | **Habits** | Daily or chosen weekdays, count targets ("8 glasses"), week strip, streaks, best streak, 26-week heatmap |
| 6 | **Goals** | Deadline, why, milestones, linked tasks, numeric targets, progress |
| 7 | **Focus** | Pomodoro timer (focus / short / long), linked to a task, session log, keeps the screen awake |
| 8 | **Journal** | Daily mood, energy, sleep, gratitude, free text; mood calendar |
| 9 | **Insights** | Planned time by category, focus per day, tasks completed, habit rate, mood trend |
| 10 | **Settings** | Theme, week start, 12/24h, visible hours, snap, zoom, categories, projects, reminders, import/export (JSON, ICS), sample data, reset |

## Cross-cutting features

- **Quick add** (`N`) with natural-language parsing and a live preview of
  what it understood.
- **Command palette** (`Ctrl/⌘ K`): jump anywhere, run any command, search
  every event, task, habit, goal and journal entry.
- **Undo / redo** for every change (`Ctrl/⌘ Z`, `Shift` to redo), plus an
  Undo button on each toast.
- **Recurring events**: daily, weekdays, weekly on chosen days, monthly (by
  date or "2nd Tuesday"), yearly; interval, until-date or count; edit or
  delete *this one*, *this and following* or *all*.
- **Reminders**: per-event minutes-before, delivered as browser
  notifications when allowed and as in-app toasts otherwise.
- **Keyboard first**: `1`–`9` switch modules, `T` today, `←/→` previous/next,
  `D/W/M/A` calendar modes, `/` search, `?` shortcut sheet.
- **Responsive**: sidebar on desktop, drawer + bottom bar on phones.
- **Light and dark** themes, following the system or set by hand.

## Data model (all dates are local, `YYYY-MM-DD` / `YYYY-MM-DDTHH:MM`)

```
settings    { theme, weekStart, timeFormat, dayStart, dayEnd, snap, hourHeight, … }
categories  [{ id, name, color }]
projects    [{ id, name, color }]
events      [{ id, title, start, end, allDay, catId, location, notes,
               reminders:[min], recur:{freq, interval, byDay, monthMode, until, count},
               exdates:[date], taskId }]
tasks       [{ id, title, notes, status, priority, due, dueTime, projectId, tags,
               estimate, subtasks:[{id,title,done}], goalId, repeat, eventId,
               created, completedAt, spent }]
habits      [{ id, name, color, days:[0-6], target, unit, log:{date:count}, archived }]
goals       [{ id, title, why, deadline, catId, milestones, target, current, unit }]
journal     { date: { mood, energy, sleep, gratitude:[3], text } }
focus       [{ id, start, minutes, taskId, catId, label }]
templates   [{ id, name, blocks:[{ id, day, start, end, title, catId, location }] }]
```

## Persistence

- `localStorage` cache, written ~0.5 s after every change.
- When published as an artifact, each collection is also written to the
  viewer's private store (`data/users/<id>/…`), chunked under the 256 KB
  document limit, so the planner follows you between devices. The newer
  copy wins on load.
- Export / import JSON (full backup) and `.ics` (calendar apps).

## File layout

```
planner/
  index.html        shell, fonts, script order
  css/app.css       design tokens (light + dark) and every component
  js/core.js        dates, ids, store, undo, persistence, recurrence, ICS
  js/parse.js       natural-language quick-add parser
  js/ui.js          modal, drawer, toasts, menus, command palette, forms
  js/calendar.js    every calendar view and drag interactions
  js/tasks.js       task lists, board, matrix, auto-schedule
  js/life.js        habits, goals, journal
  js/focus.js       focus timer, insights, timetable templates
  js/app.js         routing, sidebar, Today, settings, shortcuts, reminders
```

## Build order

1. Core (store, dates, recurrence) → 2. Shell + routing → 3. Calendar →
4. Event editor → 5. Tasks → 6. Quick add + palette → 7. Habits, goals,
journal → 8. Focus + insights → 9. Timetable → 10. Settings, import/export,
reminders → 11. Sample data, responsive pass, keyboard pass.
