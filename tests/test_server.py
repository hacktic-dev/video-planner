import importlib.util, json, tempfile, threading, unittest, urllib.request, urllib.error
from unittest.mock import patch
from pathlib import Path
spec = importlib.util.spec_from_file_location('app', Path(__file__).resolve().parents[1] / 'server.py')
app = importlib.util.module_from_spec(spec); spec.loader.exec_module(app)

class WorkspaceTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(); app.DATA = Path(self.temp.name); (app.DATA/'videos').mkdir()
        self.http = app.ThreadingHTTPServer(('127.0.0.1', 0), app.Handler)
        self.thread = threading.Thread(target=self.http.serve_forever, daemon=True); self.thread.start()
        self.base = 'http://127.0.0.1:' + str(self.http.server_port)
    def tearDown(self): self.http.shutdown(); self.http.server_close(); self.thread.join(); self.temp.cleanup()
    def request(self, path, value=None, origin=None):
        headers = {'Content-Type':'application/json'}
        if origin: headers['Origin'] = origin
        req = urllib.request.Request(self.base+'/api/'+path, data=json.dumps(value).encode() if value is not None else None, headers=headers)
        return json.load(urllib.request.urlopen(req))
    def test_round_trip_and_archive(self):
        v = self.request('video', {'title':'A real idea', 'stage':'Script', 'tasks':[{'text':'Film','done':False}], 'script':'# Hello\n\nA story.'})
        self.assertTrue((app.DATA/'videos'/(v['id']+'.md')).exists())
        v['tasks'][0]['done'] = True; v['archived'] = True
        self.request('video', v)
        loaded = self.request('workspace')['videos'][0]
        self.assertEqual(self.request('workspace')['workspacePath'], str(app.DATA))
        self.assertEqual(loaded['script'], '# Hello\n\nA story.'); self.assertTrue(loaded['tasks'][0]['done']); self.assertTrue(loaded['archived'])
        loaded['archived'] = False; self.request('video', loaded)
        self.assertFalse(self.request('workspace')['videos'][0]['archived'])
        loaded['deleted'] = True; self.request('video', loaded)
        self.assertTrue(self.request('workspace')['videos'][0]['deleted'])
        loaded['deleted'] = False; self.request('video', loaded)
        self.assertEqual(self.request('workspace')['videos'][0]['script'], '# Hello\n\nA story.')
    def test_reject_unsafe_id_and_origin(self):
        for value, origin, status in [({'title':'X','stage':'Idea','id':'../x'},None,400),({'title':'X','stage':'Idea'},'https://example.com',403)]:
            with self.assertRaises(urllib.error.HTTPError) as e: self.request('video',value,origin)
            self.assertEqual(e.exception.code,status)
        self.assertEqual(list((app.DATA/'videos').iterdir()),[])
    def test_channel(self):
        c={'name':'My channel','mission':'Teach','pillars':'Code\nArt','notes':'Next season','tasks':[{'text':'Plan','done':False}]}
        self.request('channel',c); self.assertEqual(self.request('workspace')['channel'],c)

    def test_review_and_linked_idea_round_trip(self):
        video = self.request('video', {'title':'Experiment', 'stage':'Published', 'tasks':[], 'hypothesis':'A visible constraint creates curiosity', 'window':'7 days', 'views':'0', 'ctr':'4.5', 'retention':'52', 'effort':'12.5', 'reviewStatus':'Reviewed', 'observations':'The reveal retained viewers', 'interpretation':'The question may have helped', 'nextTest':'Move the reveal earlier'})
        learning = {'id':'a'*32, 'title':'Test reveal timing', 'status':'Test next', 'videoIds':[video['id']], 'directionId':'b'*32, 'observation':video['observations'], 'interpretation':video['interpretation'], 'nextTest':video['nextTest']}
        direction = {'id':'b'*32, 'title':'Constraint experiments', 'status':'Testing', 'videoIds':[video['id']], 'notes':'Freeform brainstorming'}
        channel = {'name':'Test', 'learnings':[learning], 'directions':[direction]}
        self.request('channel', channel)
        idea = self.request('video', {'title':'Next experiment', 'stage':'Idea', 'sourceLearningId':learning['id'], 'directionId':direction['id'], 'hypothesis':learning['nextTest']})
        loaded = self.request('workspace')
        self.assertEqual(loaded['channel'], channel)
        self.assertEqual(next(v for v in loaded['videos'] if v['id']==idea['id'])['sourceLearningId'], learning['id'])
        self.assertEqual(next(v for v in loaded['videos'] if v['id']==video['id'])['views'], '0')
        for invalid in ['-1', '101', 'NaN']:
            with self.assertRaises(urllib.error.HTTPError): self.request('video', {**video, 'ctr':invalid})
        with self.assertRaises(urllib.error.HTTPError): self.request('channel', {**channel, 'learnings':[{**learning, 'title':''}]})
        self.assertEqual(self.request('workspace')['channel'], channel)

    def test_notebook_board_and_conflict(self):
        n={'id':'c'*32,'title':'Test','body':'Freeform note','tags':'intro, pacing','color':'yellow','videoIds':[], 'x':-12000,'y':18000,'onBoard':True}
        n2={**n,'id':'d'*32,'x':350}
        book={'revision':0,'notes':[n,n2],'edges':[{'from':n['id'],'to':n2['id']}],'strokes':[{'points':[[10,20],[30,40]]}]}
        saved=self.request('notebook',book)
        self.assertEqual(saved['revision'],1)
        self.assertEqual(self.request('workspace')['notebook'],saved)
        with self.assertRaises(urllib.error.HTTPError) as e: self.request('notebook',book)
        self.assertEqual(e.exception.code,409)
        saved['notes'][0]['onBoard']=False
        self.assertEqual(len(self.request('notebook',saved)['notes']),2)
        saved['revision']=2; saved['edges'][0]['to']='missing'
        with self.assertRaises(urllib.error.HTTPError): self.request('notebook',saved)

    def test_image_and_sponsor_round_trip(self):
        import base64
        png=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jD1kAAAAASUVORK5CYII=')
        image=self.request('image',{'name':'Reference.png','data':base64.b64encode(png).decode()})
        self.assertEqual(urllib.request.urlopen(self.base+image['path']).read(),png)
        video=self.request('video',{'title':'Sponsored test','stage':'Edit','sponsored':'Yes','sponsor':'Example','sponsorStatus':'Draft sent','images':[image]})
        loaded=self.request('workspace')['videos'][0]
        self.assertEqual(loaded['sponsorStatus'],'Draft sent'); self.assertEqual(loaded['images'],[image])
        with self.assertRaises(urllib.error.HTTPError): self.request('image',{'data':base64.b64encode(b'<svg>not allowed</svg>').decode()})

class WorkspaceConfigurationTest(unittest.TestCase):
    def test_remember_and_switch_without_moving_content(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp = str(Path(tmp).resolve())
            root = Path(tmp) / 'app'; root.mkdir()
            with patch.object(app, 'ROOT', root), patch.object(app, 'CONFIG', root / '.frame-local.json'):
                old = app.configure_workspace()
                (old / 'channel.json').write_text('{"name":"Original"}')
                chosen = Path(tmp) / 'Content with spaces'
                self.assertEqual(app.configure_workspace(str(chosen)), chosen)
                self.assertEqual(app.configure_workspace(), chosen)
                self.assertTrue((chosen / 'videos').is_dir())
                self.assertFalse((chosen / 'channel.json').exists())
                self.assertEqual(json.loads((old / 'channel.json').read_text())['name'], 'Original')
                self.assertEqual(app.configure_workspace(str(old)), old)

    def test_invalid_choice_preserves_configuration(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp = str(Path(tmp).resolve())
            root = Path(tmp) / 'app'; root.mkdir()
            with patch.object(app, 'ROOT', root), patch.object(app, 'CONFIG', root / '.frame-local.json'):
                chosen = app.configure_workspace(str(Path(tmp) / 'content'))
                for bad in [root, root / 'web', Path(tmp)]:
                    with self.assertRaises(ValueError): app.configure_workspace(str(bad))
                bad = Path(tmp) / 'file'; bad.write_text('keep')
                with self.assertRaises(OSError): app.configure_workspace(str(bad))
                self.assertEqual(app.configure_workspace(), chosen)

if __name__ == '__main__': unittest.main()
