# Video Planner

A local workspace for planning YouTube videos and managing your channel.

Video Planner runs entirely on your computer. There are no accounts, no cloud storage, and no database. Your videos, scripts, notes, channel data, and uploaded assets are stored as ordinary files in a workspace folder you control.

## Run

```sh
python3 server.py
```

Then open:

```text
http://127.0.0.1:4310
```

Keep the terminal running while using the app.

To use a different port:

```sh
PORT=4320 python3 server.py
```

## Features

* **Notebook** is the default screen: a freeform board where you brainstorm and create video ideas directly
* Seven-stage video production pipeline, with separate kanban boards for main videos and shorts
* A 16-colour palette for notes and video ideas, changeable from a swatch on the card
* Ideas live on their own Videos screen and only join the kanban once moved to Research
* Archive unfinished videos and restore them later
* Search and new-video creation
* Production checklists
* Video briefs and Markdown scripts
* Title candidates and thumbnail concepts
* Sponsor notes, sponsorship status, invoicing, and payment tracking
* Publish calendar
* Channel strategy, content pillars, and channel tasks
* Video performance reviews and manual metrics
* Learnings and channel directions
* Shared notebook, a freeform notes board on every video, and a freeform visual board
* Thumbnail/reference uploads and sketching
* Videos tabs: Board, Shorts, Ideas, Published, Archived
* Command-K search
* Command-S save on macOS, or Ctrl-S on other platforms

Deleted videos can be restored from Trash. Deleted notebook items can be restored using Undo during the current session.

## Saving

Click **Save changes** after editing a video project or channel settings.

Navigation through links inside the app saves pending edits before leaving the page. Task checkboxes and newly added tasks save immediately.

The browser warns before closing a page with unsaved edits.

For notebook content, note edits, board positions, connections, and strokes are saved automatically after editing. A manual **Save** button is also available if an automatic save needs to be retried.

## Separate app and content repositories

The application code and your Video Planner content can use completely independent Git repositories.

A recommended layout is:

```text
Documents/
  project-manager/       # Video Planner application repository
  video-workspace/       # Private content repository
    videos/
    assets/
    channel.json
    notebook.json
```

To use a separate content workspace, stop Video Planner and launch it with:

```sh
python3 server.py --workspace "$HOME/Documents/video-workspace"
```

The folder is created if it does not already exist.

Video Planner remembers the selected workspace's absolute path in:

```text
.frame-local.json
```

This file is excluded from the application Git repository, so your local workspace location is not committed with the app.

Future launches using:

```sh
python3 server.py
```

will reopen the remembered workspace.

The active workspace path is also printed when the server starts and shown in the app. You can hover over the local workspace indicator in the sidebar to see the path.

Relative paths are resolved from the terminal's current working directory, and `~` is supported.

### Give the workspace its own Git repository

You can use an existing Video Planner workspace, a cloned repository, or a new folder.

To initialize a new workspace repository:

```sh
git -C "$HOME/Documents/video-workspace" init
```

You can then commit and push that repository independently of the Video Planner application repository.

Video Planner does not create Git repositories or configure remotes, but it does commit workspace changes automatically when the workspace is a Git repository (see below). It never pushes or synchronizes repositories.

The legacy app-local `workspace/` directory is also excluded from the application's Git repository.

### Automatic workspace commits

If your workspace folder is a Git repository, Video Planner commits changes automatically while the server is running (on startup, then every 10 minutes by default):

```text
Autosave 2026-09-20 14:30:00
```

Change the interval in seconds, or disable it:

```sh
AUTOCOMMIT_SECONDS=60 python3 server.py
AUTOCOMMIT_SECONDS=0 python3 server.py
```

Video Planner only commits; it never pushes. Add a remote and push yourself if you want off-machine backups.

The same background task also removes uploaded images that are no longer referenced by any video, note, script, or channel field. Recently uploaded images are kept for a grace period (`ASSET_GRACE_SECONDS`, default 1 hour), so nothing in use is deleted.

### Moving an existing workspace

Choosing another workspace does not automatically move or copy your existing content.

To migrate:

1. Stop Video Planner.
2. Copy the contents of the old workspace into the new folder.
3. Launch Video Planner with `--workspace` pointing to the new folder.
4. Verify that your videos, channel data, notebook, and assets are present.
5. Keep the old copy until you are satisfied that the migration worked correctly.

If the destination already contains files, resolve any filename conflicts before copying.

You can switch back at any time by launching Video Planner with the old workspace path.

If no workspace has been selected, Video Planner uses the original app-local `workspace/` folder.

Workspace selection currently happens at launch. There is no in-app folder picker yet.

## Workspace files

The workspace files are the source of truth.

No database is required.

Each video's metadata and production checklist are stored in:

```text
<workspace>/videos/<id>.json
```

Its script is stored alongside it as:

```text
<workspace>/videos/<id>.md
```

Channel settings, tasks, learnings, and directions are stored in:

```text
<workspace>/channel.json
```

Each video's own notes and freeform board (`boardNotes` and `board`) are stored inside its JSON record.

Shared notebook notes and board data are stored in:

```text
<workspace>/notebook.json
```

Uploaded images and saved sketches are stored in:

```text
<workspace>/assets/
```

The app starts with an empty workspace and creates files as you add content.

You can edit these files outside Video Planner and reload the app afterwards.

Use one editing tab at a time and avoid editing the underlying files manually while the app is open. General project data does not currently have automatic conflict resolution.

Individual files are replaced atomically, but writes involving both a video's JSON metadata and Markdown script are not a multi-file transaction.

Backing up the workspace or storing it in a private Git repository is recommended.

## Video reviews and metrics

Each video can have an initial hypothesis and a **Review** tab.

Reviews can contain:

* Audience observations
* Possible explanations
* Production lessons
* The next thing to test

Marking a review complete removes it from the overview's review queue.

Metrics are entered manually. Supported metrics currently include:

* Views
* Impressions click-through rate
* Average percentage viewed
* Production hours

The measurement window accepts presets (24 hours, 7 days, 28 days, Lifetime) or custom text such as “14 days after publishing”. Blank metrics remain blank. Each video has one editable metric snapshot. Measurement dates are no longer shown, and the separate Results page has been removed.

Use the header's **Dark mode / Light mode** button to switch themes. Your choice is remembered in this browser; the initial theme follows your system preference.

## Learnings and channel directions

**Record learning** copies the current review's observations, interpretation, and next test into a learning linked to that video.

This creates a starting copy rather than a live synchronized version.

Learnings can distinguish between:

* Observations
* Hypotheses
* Proposed tests
* Applied findings

A learning can reference multiple videos and can be linked to a channel direction.

**Directions** provides freeform space for broader channel questions, ideas, brainstorming, and supporting evidence. Directions can reference related videos and learnings.

Using **Create video idea** from a learning or direction creates a new video idea while preserving its source link and starting hypothesis.

The normal production pipeline remains available under **Videos**.

Learnings and directions are stored in `channel.json`. Reviews, metric snapshots, and source links are stored in each video's JSON file.

Existing workspace files continue to work without migration.

Learnings and directions can be archived and restored from their respective list pages.

## Notebook and freeform board

**Notebook** is the default screen. It combines a shared note library with a freeform board that supports panning and zooming, and is where you brainstorm: **＋ Idea** creates a new video at the Idea stage directly on the board, with cards for your videos, shared traits and hypotheses built from them.

When a video is at the **Idea** stage its hook is shown on its board card, and you can recolour any video card with the swatch in its corner. Video ideas live on the board and the Videos **Ideas** tab until you move them to Research.

Notes can have:

* An optional title
* Markdown/text content
* Comma-separated tags
* A colour
* Images
* Links to any number of videos

A note does not need to be linked to a video.

Every video also has its own freeform **Notes** tab. It uses the same canvas as the shared board — pan and zoom, drag and resize cards, connect them, add headings, text and pen drawings — but its notes belong to that video and are stored inside the video's own record. There is no separate list-style notes view: notes always appear on a freeform board.

### Working with the board

* Open **Notes** to search the library and filter by video. Cards show titles, excerpts, and related videos.
* Drag a library card onto the board, or use **Add to board**. Review sections appear in the same sidebar and can be dragged or added directly. Each imported section becomes an independent note; repeated imports locate/reposition the existing copy without overwriting your edits.
* Double-click empty space to create a note; double-click an existing note to edit it.
* Drag notes to move them. Drag the bottom-right corner to resize them.
* Click a card to focus it: the card and its directly connected cards and connections stay bright while everything else fades. Hovering alone previews the same focus, and clicking empty space clears it. Only one-hop connections are highlighted.
* Use **Heading** or **Text** to type directly on the board. Double-click to edit; Enter finishes a heading, Ctrl+Enter finishes free text, and Escape cancels. These objects are stored separately from notes, with no tags, images, or video links. Delete removes the text object; Undo restores it. Existing headings migrate automatically.
* Hold **Shift** and drag a rectangle to select notes, text, headings, and drawings. Shift-click a note to toggle its selection. Drag a selected item to move the group.
* Press **Delete** or **Backspace** to remove selected items from the board. Notes remain in the library, linked to their videos, and can be added back. Removing a note from the board clears its connections.
* **Delete** in the note editor removes the note itself. **Undo** restores recent changes during the current session.
* Drag a note's dot onto another note to connect them. Connections follow the facing edges as notes move or resize.
* Use the pen to sketch; drag empty paper to pan and scroll to zoom. **Fit** frames your board.

### Notebook saving and conflicts

Notebook changes are saved automatically after editing.

A revision check prevents a second browser tab from silently overwriting newer notebook changes.

If a conflict is detected, keep the tab containing your unsaved work open and copy anything you need before reloading.

Automatic merging is not currently implemented, so using a single editing tab is recommended.

## Review notes and earlier material

The structured prompts in the video's **Review** tab remain available.

**Add section as note** copies an individual review section into a linked note. You can also add review sections directly from the notebook sidebar.

Earlier structured learnings and directions remain accessible under:

**Notebook → Earlier material**

Use **Copy to notebook** to turn one of these entries into a normal notebook note.

The copy can then be edited freely and is not synchronized back to the original learning or direction.

## Images and sketches

Notebook notes accept uploaded images and sketches. Drag image files onto a board (or into the note editor), paste them into the note body, or use the file picker. Images are stored under `assets/` and render inline in the note, and note bodies support Markdown headings, lists, links and `![alt](/assets/…)` images.

The video **Packaging** section also supports:

* Uploaded thumbnails
* Reference images
* A 16:9 sketch pad
* Adjustable ink colour
* Adjustable stroke width
* Undo

Supported image formats are:

```text
PNG
JPEG
WebP
GIF
```

Maximum upload size:

```text
10 MB
```

Uploaded files and saved sketches are stored in the workspace's `assets/` directory.

Sketches are saved as PNG files.

Cancelled drafts may briefly leave unused image files in `assets/`. When autosave is enabled, the background maintenance task removes images that are no longer referenced by any video, note, script, or channel field after a grace period (`ASSET_GRACE_SECONDS`, default 1 hour).

## Sponsorship tracking

Video details include both sponsor notes and structured sponsorship tracking.

**Sponsored video** determines whether the video is sponsored.

**Sponsor status** tracks the sponsorship separately from the video's production stage, including states covering outreach, agreement, production, approval, invoicing, and payment.

This means a video's production status and sponsorship status can progress independently.

## Current limitations

This version runs only on localhost and is not yet packaged as a desktop application.

The following are not currently implemented:

* In-app workspace folder selection
* Automatic Git synchronization (pushes); commits are automatic but pushing is not
* Historical metric snapshots
* Automatic edit conflict resolution
* External calendar integration
* Email integration
* Native reminders
* Analytics imports
* General file attachments beyond the supported image features

Calendar entries represent planned publishing dates inside Video Planner rather than events synchronized with an external calendar.

## Check

Run the Python tests with:

```sh
python3 -m unittest discover -s tests
```

Check the JavaScript syntax with:

```sh
node --check web/app.js
```

Browser regression checks (requires Playwright and Microsoft Edge):

```sh
node tests/notebook-browser.cjs
node tests/videos-browser.cjs
node tests/focus-browser.cjs
```

Set `BROWSER_CHANNEL` to `chrome` to run them in Chrome instead. The browser checks use an isolated, mocked workspace and do not edit your content.

## Published videos

Videos has **Board**, **Shorts**, **Ideas**, **Published**, and **Archived** tabs. The Board holds main videos and the Shorts tab holds videos flagged as short-form; a video in the Published stage stays on its board for seven calendar days after its publish date, then appears in Published automatically. This is calculated from the date when viewing the app, so it also works if the app was closed. An open Videos page rechecks when the day changes.

Each video stores a boolean short-form flag. Adding a video from the Shorts board sets that flag, and the **Video format** dropdown in a video's details lets you move it between the main Board and Shorts at any time.

Videos without a publish date stay on their board until a date is entered. Future dates and videos in other stages do not move. Changing the stage or date updates the placement. Videos whose stage is **Idea** are kept off the kanban and shown on the **Ideas** tab; moving one to Research puts it on the appropriate board. Unfinished videos can be moved to **Archived** from their detail page and restored from the Archived tab. Trash remains separate.

## Checklist and production stages

Built-in production tasks and stages stay in sync. Checking a production step completes earlier steps; unchecking one reopens later steps. Moving a video between stages updates those checkboxes. Custom tasks remain independent.

Upload and Publish are separate tasks. Upload stays in Ready. Checking Publish, moving into Published, or creating a Published video sets the publish date to today. Moving an already published video to the same stage preserves its existing date. Existing combined Upload & publish tasks split automatically, retaining their completion state.

Production regression check: `node tests/production.cjs`.
