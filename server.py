#!/usr/bin/env python3
"""Local video workspace. Run: python3 server.py"""
import argparse, base64, math, json, os, re, tempfile, threading, uuid
from pathlib import Path
from datetime import date
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent
DATA = ROOT / 'workspace'
CONFIG = ROOT / '.frame-local.json'
LOCK = threading.Lock()
STAGES = ['Idea', 'Research', 'Script', 'Record', 'Edit', 'Ready', 'Published']

def atomic(path, content):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, name = tempfile.mkstemp(dir=path.parent)
    try:
        with os.fdopen(fd, 'w') as f: f.write(content)
        os.replace(name, path)
    finally:
        if os.path.exists(name): os.unlink(name)

def save(path, value): atomic(path, json.dumps(value, indent=2, ensure_ascii=False) + '\n')
def read(path, fallback): return json.loads(path.read_text()) if path.exists() else fallback

def configure_workspace(selected=None):
    """Remember explicit choices locally; keep existing installs on their old folder."""
    configured = read(CONFIG, {}).get('workspace')
    folder = Path(selected or configured or ROOT / 'workspace').expanduser().resolve()
    if folder == ROOT or ROOT in folder.parents and folder != ROOT / 'workspace':
        raise ValueError('Choose a folder outside the app, or the existing workspace folder.')
    if folder in ROOT.parents:
        raise ValueError('The workspace cannot contain the app folder.')
    folder.mkdir(parents=True, exist_ok=True)
    (folder / 'videos').mkdir(exist_ok=True)
    if selected:
        save(CONFIG, {'workspace': str(folder)})
    return folder

def validate(v):
    if not isinstance(v, dict): raise ValueError('Expected an object')
    if not isinstance(v.get('title'), str) or not v['title'].strip(): raise ValueError('A title is required')
    if len(v['title']) > 250: raise ValueError('Title is too long')
    if v.get('stage') not in STAGES: raise ValueError('Invalid stage')
    if v.get('date'):
        if not isinstance(v['date'], str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}', v['date']): raise ValueError('Invalid date')
        date.fromisoformat(v['date'])
    for key in ['hook', 'notes', 'pillar', 'sponsor', 'titles', 'thumbnail', 'hypothesis', 'observations', 'interpretation', 'productionLearning', 'nextTest', 'directionId', 'sourceLearningId']:
        if not isinstance(v.get(key, ''), str): raise ValueError('Invalid ' + key)
    if not isinstance(v.get('tasks', []), list): raise ValueError('Invalid tasks')
    for t in v.get('tasks', []):
        if not isinstance(t, dict) or not isinstance(t.get('text'), str) or not isinstance(t.get('done'), bool): raise ValueError('Invalid task')
    for key in ['views', 'ctr', 'retention', 'effort']:
        value = v.get(key, '')
        if value != '':
            try: number = float(value)
            except (ValueError, TypeError): raise ValueError('Invalid ' + key)
            if not math.isfinite(number) or number < 0 or (key in ['ctr', 'retention'] and number > 100): raise ValueError('Invalid ' + key)
            if key == 'views' and not number.is_integer(): raise ValueError('Views must be a whole number')
    for key in ['reviewDate', 'measuredOn']:
        if v.get(key): date.fromisoformat(v[key])
    if not isinstance(v.get('window', ''), str) or len(v.get('window', '')) > 120: raise ValueError('Invalid measurement window')
    for key, options in {'reviewStatus': ['Not reviewed', 'In progress', 'Reviewed'], 'repeat': ['Undecided', 'Yes', 'With changes', 'No']}.items():
        if key in v and v[key] not in options: raise ValueError('Invalid ' + key)
    return v

def validate_todos(todos):
    if not isinstance(todos, list): raise ValueError('Invalid to-dos')
    by_id = {}
    for t in todos:
        if not isinstance(t, dict) or not isinstance(t.get('id'), str) or not re.fullmatch('[a-f0-9]{32}', t['id']) or t['id'] in by_id: raise ValueError('Invalid to-do ID')
        by_id[t['id']] = t
        if not isinstance(t.get('text'), str) or not t['text'].strip() or len(t['text']) > 500: raise ValueError('Invalid to-do text')
        if not isinstance(t.get('done'), bool) or t.get('priority') not in ['low', 'normal', 'high', 'urgent']: raise ValueError('Invalid to-do status')
        if not isinstance(t.get('parentId', ''), str): raise ValueError('Invalid parent')
        deadline = t.get('deadline', '')
        if not isinstance(deadline, str): raise ValueError('Invalid deadline')
        if deadline:
            if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', deadline): raise ValueError('Invalid deadline')
            date.fromisoformat(deadline)
    for t in todos:
        seen = {t['id']}; parent = t.get('parentId', '')
        while parent:
            if parent not in by_id or parent in seen: raise ValueError('Invalid parent hierarchy')
            seen.add(parent); parent = by_id[parent].get('parentId', '')

def validate_knowledge(channel):
    for kind in ['learnings', 'directions']:
        entries = channel.get(kind, [])
        if not isinstance(entries, list): raise ValueError('Invalid ' + kind)
        seen = set()
        for entry in entries:
            if not isinstance(entry, dict): raise ValueError('Invalid entry')
            ident = entry.get('id', '')
            if not isinstance(ident, str) or not re.fullmatch('[a-f0-9]{32}', ident) or ident in seen: raise ValueError('Invalid entry ID')
            seen.add(ident)
            title = entry.get('title')
            if not isinstance(title, str) or not title.strip() or len(title) > 250: raise ValueError('An entry title is required (up to 250 characters)')
            for key in ['notes', 'question', 'evidence', 'observation', 'interpretation', 'nextTest', 'directionId']:
                if not isinstance(entry.get(key, ''), str): raise ValueError('Invalid ' + key)
            statuses = ['Observation', 'Hypothesis', 'Test next', 'Applied'] if kind == 'learnings' else ['Exploring', 'Testing', 'Continuing', 'Paused']
            if entry.get('status') not in statuses: raise ValueError('Invalid entry status')
            if not isinstance(entry.get('videoIds', []), list) or any(not isinstance(x, str) or not re.fullmatch('[a-f0-9]{32}', x) for x in entry.get('videoIds', [])): raise ValueError('Invalid video links')

def validate_notebook(v):
    if not isinstance(v, dict) or not isinstance(v.get('revision'), int): raise ValueError('Invalid notebook')
    for key in ['notes', 'edges', 'strokes']:
        if not isinstance(v.get(key), list): raise ValueError('Invalid ' + key)
    ids = set()
    for n in v['notes']:
        if not isinstance(n, dict) or not isinstance(n.get('id'), str) or not re.fullmatch('[a-f0-9]{32}', n['id']) or n['id'] in ids: raise ValueError('Invalid note ID')
        ids.add(n['id'])
        for k in ['title', 'body', 'tags', 'color']:
            if not isinstance(n.get(k), str): raise ValueError('Invalid note ' + k)
        if n['color'] not in ['plain', 'yellow', 'blue', 'pink', 'green']: raise ValueError('Invalid note colour')
        if not isinstance(n.get('videoIds'), list) or any(not isinstance(x, str) or not re.fullmatch('[a-f0-9]{32}', x) for x in n['videoIds']): raise ValueError('Invalid video links')
        if not isinstance(n.get('onBoard'), bool): raise ValueError('Invalid board placement')
        if n.get('kind', 'note') not in ['note', 'text', 'heading', 'video', 'trait', 'hypothesis']: raise ValueError('Invalid board item')
        for k in ['width', 'height']:
            if k in n and (isinstance(n[k], bool) or not isinstance(n[k], (int, float)) or not math.isfinite(n[k]) or not 80 <= n[k] <= 3000): raise ValueError('Invalid note size')
        for k in ['x', 'y']:
            if not isinstance(n.get(k), (int, float)) or not math.isfinite(n[k]): raise ValueError('Invalid note position')
    if not isinstance(v.get('texts', []), list): raise ValueError('Invalid board texts')
    text_ids = set(ids)
    for t in v.get('texts', []):
        if not isinstance(t, dict) or not isinstance(t.get('id'), str) or not re.fullmatch('[a-f0-9]{32}', t['id']) or t['id'] in text_ids: raise ValueError('Invalid board text ID')
        text_ids.add(t['id'])
        if t.get('kind') not in ['heading', 'text'] or not isinstance(t.get('text'), str): raise ValueError('Invalid board text')
        for k in ['x', 'y', 'width', 'height']:
            if k not in t and k in ['width', 'height']: continue
            value = t.get(k)
            if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or (k in ['width', 'height'] and not 80 <= value <= 3000): raise ValueError('Invalid board text geometry')
    for e in v['edges']:
        if not isinstance(e, dict) or e.get('from') not in ids or e.get('to') not in ids: raise ValueError('Invalid connection')
    for stroke in v['strokes']:
        if not isinstance(stroke, dict) or not isinstance(stroke.get('points'), list) or len(stroke['points']) > 20000: raise ValueError('Invalid drawing')
        for point in stroke['points']:
            if not isinstance(point, list) or len(point) != 2 or any(not isinstance(x, (int, float)) or not math.isfinite(x) for x in point): raise ValueError('Invalid drawing point')

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs): super().__init__(*args, directory=str(ROOT / 'web'), **kwargs)
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def reply(self, data, status=200):
        body = json.dumps(data).encode()
        self.send_response(status); self.send_header('Content-Type', 'application/json'); self.send_header('Cache-Control', 'no-store'); self.send_header('Content-Length', str(len(body))); self.end_headers(); self.wfile.write(body)
    def do_GET(self):
        path = urlparse(self.path).path
        if path == '/api/workspace':
            with LOCK:
                videos = [read(p, {}) for p in sorted((DATA / 'videos').glob('*.json'))]
                for v in videos:
                    p = DATA / 'videos' / (v['id'] + '.md')
                    v['script'] = p.read_text() if p.exists() else ''
                self.reply({'notebook': read(DATA / 'notebook.json', {'revision': 0, 'notes': [], 'edges': [], 'strokes': []}), 'workspacePath': str(DATA), 'workspaceGit': (DATA / '.git').exists(), 'videos': videos, 'channel': read(DATA / 'channel.json', {'name': 'My channel', 'mission': '', 'pillars': 'Creative coding\nExperiments\nBehind the scenes', 'notes': '', 'tasks': []})})
        elif re.fullmatch(r'/assets/[a-f0-9]{32}\.(png|jpg|webp|gif)', path):
            asset = DATA / 'assets' / path.split('/')[-1]
            if not asset.is_file(): return self.reply({'error': 'Image not found'}, 404)
            body = asset.read_bytes()
            self.send_response(200)
            self.send_header('Content-Type', {'png':'image/png', 'jpg':'image/jpeg', 'webp':'image/webp', 'gif':'image/gif'}[asset.suffix[1:]])
            self.send_header('X-Content-Type-Options', 'nosniff')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers(); self.wfile.write(body)
        elif path.startswith('/api/'): self.reply({'error': 'Not found'}, 404)
        else: super().do_GET()
    def do_POST(self):
        # Only same-origin browser requests can mutate the local workspace.
        origin = self.headers.get('Origin')
        if origin and origin != 'http://' + self.headers.get('Host', ''): return self.reply({'error': 'Origin rejected'}, 403)
        if self.headers.get('Content-Type', '').split(';')[0] != 'application/json': return self.reply({'error': 'JSON required'}, 415)
        try:
            size = int(self.headers.get('Content-Length', 0))
            if size > 16_000_000: raise ValueError('Request too large')
            v = json.loads(self.rfile.read(size))
            path = urlparse(self.path).path
            with LOCK:
                if path == '/api/video':
                    validate(v)
                    ident = v.get('id') or uuid.uuid4().hex
                    if not re.fullmatch('[a-f0-9]{32}', ident): raise ValueError('Invalid ID')
                    v['id'] = ident
                    script = v.pop('script', '')
                    if not isinstance(script, str): raise ValueError('Invalid script')
                    atomic(DATA / 'videos' / (ident + '.md'), script)
                    save(DATA / 'videos' / (ident + '.json'), v)
                    self.reply({**v, 'script': script})
                elif path == '/api/image':
                    if not isinstance(v, dict) or not isinstance(v.get('data'), str): raise ValueError('Invalid image')
                    try: raw = base64.b64decode(v['data'], validate=True)
                    except Exception: raise ValueError('Invalid image encoding')
                    if len(raw) > 10_000_000: raise ValueError('Image must be under 10 MB')
                    ext = 'png' if raw.startswith(b'\x89PNG\r\n\x1a\n') else 'jpg' if raw.startswith(b'\xff\xd8\xff') else 'gif' if raw.startswith((b'GIF87a',b'GIF89a')) else 'webp' if raw[:4] == b'RIFF' and raw[8:12] == b'WEBP' else None
                    if not ext: raise ValueError('Use PNG, JPEG, WebP, or GIF')
                    asset_id = uuid.uuid4().hex + '.' + ext
                    (DATA / 'assets').mkdir(exist_ok=True)
                    (DATA / 'assets' / asset_id).write_bytes(raw)
                    self.reply({'path': '/assets/' + asset_id, 'name': str(v.get('name', 'Image'))[:250]})
                elif path == '/api/notebook':
                    validate_notebook(v)
                    previous = read(DATA / 'notebook.json', {'revision': 0})
                    if v.get('revision') != previous['revision']:
                        return self.reply({'error': 'Notebook changed in another tab. Keep this tab open and copy your unsaved notes before reloading.'}, 409)
                    v['revision'] += 1
                    save(DATA / 'notebook.json', v)
                    self.reply(v)
                elif path == '/api/channel':
                    if not isinstance(v, dict) or any(not isinstance(v.get(k, ''), str) for k in ['name', 'mission', 'pillars', 'notes']): raise ValueError('Invalid channel')
                    for t in v.get('tasks', []):
                        if not isinstance(t.get('text'), str) or not isinstance(t.get('done'), bool): raise ValueError('Invalid task')
                    validate_todos(v.get('todos', []))
                    validate_knowledge(v)
                    save(DATA / 'channel.json', v); self.reply(v)
                else: self.reply({'error': 'Not found'}, 404)
        except (ValueError, TypeError, AttributeError) as e: self.reply({'error': str(e)}, 400)
        except OSError: self.reply({'error': 'Could not save files. Check disk space and permissions.'}, 500)

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Frame local video studio')
    parser.add_argument('--workspace', metavar='FOLDER', help='Open a content folder and remember it for future launches. Creates the folder if needed; does not move existing content.')
    args = parser.parse_args()
    try:
        DATA = configure_workspace(args.workspace)
    except (OSError, ValueError, AttributeError) as e:
        parser.error('Could not open workspace: ' + str(e))
    port = int(os.environ.get('PORT', '4310'))
    print(f'Workspace: {DATA}', flush=True)
    print(f'Video studio is running at http://127.0.0.1:{port}', flush=True)
    ThreadingHTTPServer(('127.0.0.1', port), Handler).serve_forever()
