# Video Planner

A local video and channel planning workspace. No accounts or cloud storage.

## Run

```sh
python3 server.py
```

Open http://127.0.0.1:4310. Keep the terminal running while using the app. Change the port with `PORT=4320 python3 server.py`.

## What's here

- Overview with project counts, open production tasks, and upcoming releases
- Seven-stage video pipeline, search, and new videos with production checklists
- Video briefs, Markdown scripts, title candidates, thumbnail concepts, sponsor notes
- Publish calendar, channel strategy, content pillars, and channel tasks
- Archive and restore; nothing is permanently deleted through the UI
- Command-K search and Command-S save (Ctrl on other platforms)

Click **Save changes** after editing a project or channel. In-app link navigation saves pending edits first. Task checkboxes and additions save immediately. The browser warns before closing with unsaved edits.

## Separate app and content repositories

The app code and your content can have completely independent Git histories. A useful layout is:

```text
Documents/
  project-manager/       # Frame app repository
  video-workspace/       # Your private content repository
    videos/
    channel.json
```

Stop Frame, then choose the content folder on launch:

```sh
python3 server.py --workspace "$HOME/Documents/video-workspace"
```

The folder is created if needed. Frame remembers its absolute path in `.frame-local.json`, which is excluded from the app's Git repository. Future `python3 server.py` launches reopen it. Relative paths resolve from the terminal's working directory; `~` is supported. The active folder is printed at startup and shown in video details (also hover over the sidebar's local workspace indicator).

You can use an existing Frame workspace or a cloned content repository. To give a new content folder its own Git history, run:

```sh
git -C "$HOME/Documents/video-workspace" init
```

Commits, remotes, and sync remain manual. Frame does not initialize repositories or change Git settings automatically. The old app-local `workspace/` folder is also excluded from the app's Git repository.

**Choosing a different folder does not move or copy existing content.** To migrate, stop Frame and copy the old workspace's contents into the new folder, then launch with `--workspace`. Keep the old copy until you have verified the new workspace. If the destination already has content, resolve any filename conflicts before copying. Switch back by passing the old folder to `--workspace`.

Without a saved choice, Frame continues using the original app-local `workspace/` folder. Workspace selection currently happens at launch; there is no in-app folder picker yet.

## Your files

`<selected folder>/videos/<id>.json` contains each video's metadata and checklist. The matching `.md` contains its script. `<selected folder>/channel.json` contains channel settings and tasks. These ordinary text files are the source of truth; no database is required. The app starts empty and creates files as you work.

You can edit these files outside the app, then reload. Use one app tab at a time and avoid simultaneous manual edits: there is no conflict resolution yet. Individual files are replaced atomically, but JSON and script writes are not a multi-file transaction. Back up the workspace or put it in a private Git repository. Git commits and sync are currently manual.

This first version runs only on localhost. It is a local browser app, not yet a packaged desktop application. Calendar entries are your planned publishing dates; external calendars, email, native reminders, analytics imports, attachments, and automatic Git history are not implemented.

## Check

```sh
python3 -m unittest discover -s tests
node --check web/app.js
```

## Reviews, learnings, and channel directions

Each video has an initial hypothesis and a **Review** tab. Record audience observations, possible explanations, production lessons, and the next thing to test. Mark the review complete to remove it from the overview's review queue.

Metrics are manual: views, impressions CTR, average percentage viewed, and production hours. **Results** compares published videos by the selected measurement window (24 hours, 7 days, 28 days, or lifetime). Blank metrics remain blank rather than being treated as zero. There is currently one editable metric snapshot per video, not a historical series; changing it replaces the previous snapshot. Measurement dates and windows should reflect the actual source data.

**Record learning** copies the current review observations, interpretation, and next test into a learning linked to that video. This is a starting copy, not a live synchronization. Learnings distinguish observations, hypotheses, proposed tests, and applied findings. They can cite multiple videos and link to a channel direction.

**Directions** provides freeform space for channel questions, brainstorming, and evidence, with related videos and learnings. **Create video idea** on a learning or direction creates an idea with its source link and starting hypothesis preserved. The production pipeline remains available under Videos.

Learnings and directions are stored in `channel.json`; reviews, metric snapshots, and source links are stored in each video's JSON file. Existing files work without migration. Entries can be archived and restored from their list pages. Save changes explicitly or navigate using the app links to save before leaving.

## Notes and freeform board

**Notebook** is a shared note library and a scrollable 2400 × 1600 board. Notes have optional titles, comma-separated tags, colours, images, and links to any number of videos. Video pages have a **Notes** tab. A board-only note does not need a video link.

- Add an existing note from the library, or double-click blank paper to write one there.
- Drag a note by its top bar (arrow keys on the focused bar also move it).
- **Connect**: click two note bodies to draw a connection.
- **Draw**: drag on blank paper to doodle or write by hand.
- **Erase**: click a connection or stroke. **Undo** restores recent board/note edits within this session.
- Removing a note with its × button only removes its placement. The note remains in the library and on its linked videos.
- Open a note to read or edit the full text. Board previews are shortened.

Note edits, positions, connections, and strokes save automatically after editing, with a manual Save button to retry. They live in `notebook.json`. A revision check prevents a second tab from silently overwriting notebook changes. On a conflict, keep the unsaved tab open and copy its changes before reloading; automatic merging is not implemented. Use a single editing tab.

The Review prompts remain available. **Save as note** creates a linked note containing the written reflection. Earlier structured learnings and directions remain under Notebook → Earlier material and have **Copy to notebook**. Copies can then be edited freely; they are not synchronized back to their source forms.

Notes accept image uploads and sketches. Video **Packaging** also accepts uploaded thumbnails/references and has a 16:9 sketch pad with ink colour, width, and undo. PNG, JPEG, WebP, and GIF up to 10 MB are supported. Uploads and saved sketches are stored in the workspace's `assets/` folder, and sketches are saved as PNGs. Cancelled drafts may leave unused image files; the app does not automatically delete assets.

Video details retain sponsor notes and now include **Sponsored video** and a separate **Sponsor status**, from outreach through approval, invoicing, and payment. These fields are independent of production stage.
