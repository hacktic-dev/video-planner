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

* Overview with project counts, open production tasks, upcoming releases, and pending reviews
* Seven-stage video production pipeline
* Search and new-video creation
* Production checklists
* Video briefs and Markdown scripts
* Title candidates and thumbnail concepts
* Sponsor notes, sponsorship status, invoicing, and payment tracking
* Publish calendar
* Channel strategy, content pillars, and channel tasks
* Video performance reviews and manual metrics
* Learnings and channel directions
* Shared notebook and freeform visual board
* Thumbnail/reference uploads and sketching
* Archive and restore
* Command-K search
* Command-S save on macOS, or Ctrl-S on other platforms

Nothing is permanently deleted through the UI.

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
.Video Planner-local.json
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

Video Planner does not create Git repositories, configure remotes, commit changes, or synchronize repositories automatically.

The legacy app-local `workspace/` directory is also excluded from the application's Git repository.

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

Notebook notes and board data are stored in:

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

The **Results** page compares published videos using one of four measurement windows:

* 24 hours
* 7 days
* 28 days
* Lifetime

Blank metrics remain blank rather than being interpreted as zero.

Each video currently has one editable metric snapshot rather than a historical series. Updating the metrics replaces the previous snapshot.

The measurement date and measurement window should therefore match the source data you entered.

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

**Notebook** combines a shared note library with a scrollable 2400 × 1600 freeform board.

Notes can have:

* An optional title
* Markdown/text content
* Comma-separated tags
* A colour
* Images
* Links to any number of videos

A note does not need to be linked to a video.

Video pages also include a **Notes** tab for notes associated with that video.

### Working with the board

You can add an existing note from the library or double-click empty board space to create one directly.

Drag a note using its top bar. When the bar is focused, the arrow keys can also move it.

Use **Connect** and click two note bodies to draw a connection between them.

Use **Draw** to drag on empty board space and sketch or write by hand.

Use **Erase** to remove a connection or stroke.

**Undo** restores recent note and board edits made during the current session.

Removing a note from the board using its × button only removes that placement. The note remains in the notebook library and remains linked to any associated videos.

Open a note to read or edit its complete contents. Board previews are shortened automatically.

### Notebook saving and conflicts

Notebook changes are saved automatically after editing.

A revision check prevents a second browser tab from silently overwriting newer notebook changes.

If a conflict is detected, keep the tab containing your unsaved work open and copy anything you need before reloading.

Automatic merging is not currently implemented, so using a single editing tab is recommended.

## Review notes and earlier material

The structured prompts in the video's **Review** tab remain available.

**Save as note** creates a notebook note linked to the video using the written review reflection.

Earlier structured learnings and directions remain accessible under:

**Notebook → Earlier material**

Use **Copy to notebook** to turn one of these entries into a normal notebook note.

The copy can then be edited freely and is not synchronized back to the original learning or direction.

## Images and sketches

Notebook notes accept uploaded images and sketches.

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

Cancelled drafts may leave unused image files in `assets/`. Video Planner does not currently remove unused assets automatically.

## Sponsorship tracking

Video details include both sponsor notes and structured sponsorship tracking.

**Sponsored video** determines whether the video is sponsored.

**Sponsor status** tracks the sponsorship separately from the video's production stage, including states covering outreach, agreement, production, approval, invoicing, and payment.

This means a video's production status and sponsorship status can progress independently.

## Current limitations

This version runs only on localhost and is not yet packaged as a desktop application.

The following are not currently implemented:

* In-app workspace folder selection
* Automatic Git commits or synchronization
* Historical metric snapshots
* Automatic edit conflict resolution
* Automatic cleanup of unused assets
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
