# Almanac — personal life planner

A calendar, weekly timetable, task manager, habit tracker, goal tracker, focus
timer, journal and insights dashboard in one app. Plain HTML, CSS and
JavaScript: no build step, no server, no account.

**Live:** https://ziadwael364.github.io/ALmanac/

**Run it:** open `index.html` in a browser. That's it.

Want one file you can copy anywhere? `node build.js` writes
`dist/almanac.html` with everything inlined.

The first time it opens it loads **example data** so every screen has
something in it. Press **Clear and start fresh** on the banner when you are
ready to use it for real.

See [PLAN.md](PLAN.md) for the design plan and data model.

## What's in it

| Section | Highlights |
|---|---|
| **Today** | Greeting, how much of the day is gone, free time left, now/next, today's timeline, due + overdue tasks, habit check-off, mood check-in, focus, goals, next three days |
| **Calendar** | Day, 3-day, week, month, agenda and year views. Drag to create, drag to move (also across days), drag the bottom edge to resize. Overlap warnings, working-hours shading, a now line, week numbers, a daily load bar, category filters, tasks on their due day, and a tray of unscheduled tasks you can drag onto the grid |
| **Repeating events** | Daily, weekdays, weekly on chosen days, every N weeks, monthly by date or by "2nd Tuesday", yearly, until a date or N times. Move, edit or delete *only this one*, *this and following*, or *every occurrence* |
| **Timetable** | Build a typical week (school, shifts, training) on a grid, start from a preset or copy your current week, then apply it to any date range as repeating events. Remove it from the calendar in one click |
| **Tasks** | Smart lists (Inbox, Today, Next 7 days, Overdue, No date, High priority, Completed), projects, tags, priorities, subtasks, estimates, due times, repeating tasks, goal links. List, kanban board and Eisenhower matrix. Drag tasks between lists, columns and quadrants |
| **Scheduling** | "Find a slot" per task, and **Plan day**, which fits open tasks into free time inside your working hours, most pressing first |
| **Habits** | Any weekdays, count targets ("8 glasses"), week strip, current and best streak (rest days don't break it), 30-day rate, 26-week heatmap, archive |
| **Goals** | Why it matters, deadline countdown, on-track / behind-pace, milestones, numeric targets, linked tasks |
| **Focus** | Pomodoro timer with focus / short / long cycles, linked to a task (time is added to it), session log, 7-day chart, chime, keeps the screen awake |
| **Journal** | Mood, energy, sleep, three good things, free writing with a daily prompt, mood-coloured month calendar, 30-day mood trend, writing streak |
| **Insights** | Planned time by category, planned and focus time per day, tasks completed and on-time rate, habit completion, mood and sleep trends |
| **Settings** | Theme, week start, 12/24-hour time, visible and working hours, drag snap, zoom, default length and reminder, categories, timer lengths, notifications, JSON backup/restore, .ics export/import |

## Quick add

Press **N** and type. Times make it an event, no time makes it a task.

```
Gym tomorrow 6-7:30pm #health every mon,wed,fri
Dentist 14 oct at 3pm @clinic remind 30m
Call the bank fri !2 ~15m +errands
Standup every weekday 9:30am for 15m #work
Study 20:00-22:00 daily until 30 oct
task: read chapter 4 by sunday #study
```

`#word` category (or tag) · `+word` project · `@word` place · `!1`–`!3`
priority (3 is high) · `~30m` estimate · `remind 15m` · `all day`

## Keyboard

`Ctrl/⌘ K` search and commands · `N` quick add · `E` new event ·
`Shift N` new task · `1`–`9` sections · `,` settings · `T` today ·
`←/→` previous/next · `D X W M A Y` calendar views · `Ctrl/⌘ Z` undo ·
`Ctrl/⌘ Shift Z` redo · `Space` start/pause the timer · `?` all shortcuts

## Your data

Saved in your browser's local storage after every change. Clearing site data
deletes it, so use **Settings → Back up (JSON)** now and then. When the page
is opened as a claude.ai artifact it also syncs to your account so it follows
you between devices.

Reminders and the focus chime only fire while the page is open in a tab.

## Files

```
index.html     shell and script order
css/app.css    every style, light and dark
js/core.js     dates, store, undo/redo, persistence, recurrence, ICS
js/parse.js    natural-language quick add
js/ui.js       icons, dialogs, menus, toasts, command palette, quick add
js/calendar.js calendar views, drag interactions, event editor
js/tasks.js    task lists, board, matrix, editor, scheduling
js/life.js     habits, goals, journal
js/focus.js    focus timer, insights, timetables
js/app.js      shell, Today, settings, shortcuts, reminders, sample data
build.js       bundles everything into one HTML file
```
