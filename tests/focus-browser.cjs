const {chromium}=require('playwright');const fs=require('fs');const assert=require('assert');
(async()=>{const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||"msedge"});const page=await browser.newPage({viewport:{width:1500,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
const A='a'.repeat(32),B='b'.repeat(32),C='c'.repeat(32),D='d'.repeat(32),E='e'.repeat(32),V='v'.repeat(32);
const videos=[{id:V,title:'Focus video',stage:'Idea',tasks:[],hook:''}];
const channel={};
let book={revision:0,notes:[
 {id:A,kind:'video',title:'Focus video',body:'',tags:'',color:'plain',videoIds:[V],x:200,y:200,onBoard:true},
 {id:B,kind:'trait',title:'Trait B',body:'',tags:'',color:'plain',videoIds:[],x:560,y:150,onBoard:true},
 {id:C,kind:'trait',title:'Trait C',body:'',tags:'',color:'plain',videoIds:[],x:560,y:380,onBoard:true},
 {id:D,kind:'hypothesis',title:'Hypo D',body:'',tags:'',color:'plain',videoIds:[],x:940,y:260,onBoard:true},
 {id:E,kind:'note',title:'Lonely',body:'No links',tags:'',color:'plain',videoIds:[],x:200,y:640,onBoard:true}],edges:[{from:A,to:B},{from:A,to:C},{from:B,to:D}],strokes:[],texts:[]};
await page.route('http://localhost:54321/**',async route=>{const path=new URL(route.request().url()).pathname;
 if(path==='/api/workspace')return route.fulfill({json:{workspacePath:'test',workspaceGit:false,videos,channel,notebook:book}});
 if(path==='/api/notebook'){book=route.request().postDataJSON();return route.fulfill({json:book})}
 if(path==='/api/channel')return route.fulfill({json:channel});
 if(path==='/api/video'){const v=route.request().postDataJSON();return route.fulfill({json:v})}
 const file='web/'+(path==='/'?'index.html':path.slice(1));await route.fulfill({body:fs.readFileSync(file),contentType:path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':'text/html'})});
const focusOn=()=>page.locator('[data-item].focus-on').count();
const focusIds=()=>page.locator('[data-item].focus-on').evaluateAll(els=>els.map(e=>e.dataset.item).sort());
const litEdges=()=>page.locator('#board-ink line.focus-edge').count();
const allLines=()=>page.locator('#board-ink line').count();
const isFocusing=()=>page.locator('#note-board.focusing').count();
await page.goto('http://localhost:54321/#notebook');await page.locator('.board-note').first().waitFor();
assert.equal(await page.locator('.board-note').count(),5);

// 1 + 2: clicking a connected video focuses it and only its direct neighbours.
await page.locator('[data-note="'+A+'"]').click();
assert.equal(await isFocusing(),1);
assert.deepEqual(await focusIds(),[A,B,C].sort());
assert.equal(await litEdges(),2);assert.equal(await allLines(),3);
assert.equal(await page.locator('[data-item="'+D+'"].focus-on').count(),0);
assert.equal(await page.locator('[data-item="'+E+'"].focus-on').count(),0);

// 3: clicking another node immediately changes focus (hypothesis is one hop from B only).
await page.locator('[data-note="'+D+'"]').click();
assert.deepEqual(await focusIds(),[B,D].sort());
assert.equal(await litEdges(),1);
assert.equal(await page.locator('[data-item="'+A+'"].focus-on').count(),0);

// 4: clicking empty canvas clears focus and restores everything.
const scroll=await page.locator('#board-scroll').boundingBox();
await page.mouse.click(scroll.x+30,scroll.y+scroll.height/2);
assert.equal(await isFocusing(),0);assert.equal(await focusOn(),0);

// Hover preview when nothing is selected, cleared when the pointer leaves the node.
const b=await page.locator('[data-note="'+B+'"]').boundingBox();
await page.mouse.move(b.x+b.width/2,b.y+b.height/2);
assert.equal(await isFocusing(),1);assert.deepEqual(await focusIds(),[A,B,D].sort());
await page.mouse.move(scroll.x+30,scroll.y+scroll.height/2);
assert.equal(await isFocusing(),0);assert.equal(await focusOn(),0);

// 5: dragging still works and keeps the dragged node focused.
const ab=await page.locator('[data-note="'+A+'"]').boundingBox();
await page.mouse.move(ab.x+ab.width/2,ab.y+ab.height/2);await page.mouse.down();
await page.mouse.move(ab.x+ab.width/2+150,ab.y+ab.height/2+90,{steps:10});await page.mouse.up();
const ab2=await page.locator('[data-note="'+A+'"]').boundingBox();
assert(ab2.x>ab.x+100);assert.equal(await isFocusing(),1);assert.deepEqual(await focusIds(),[A,B,C].sort());

// 6: a card button still works and does not change the selection.
await page.locator('[data-note="'+A+'"] [data-add-trait]').click();
await page.locator('#trait-picker[open]').waitFor();
assert.deepEqual(await focusIds(),[A,B,C].sort());

// 7: a newly created node and its edge participate in focus automatically.
await page.locator('#new-trait-title').fill('Fresh trait');
await page.locator('#trait-create').click();
await page.waitForTimeout(150);
const fresh=page.locator('.board-note.kind-trait',{hasText:'Fresh trait'});
assert.equal(await fresh.count(),1);
assert.deepEqual(await focusIds(),[A,(await fresh.getAttribute('data-item'))].sort());
assert.equal(await allLines(),4);assert.equal(await litEdges(),1);
assert((await fresh.getAttribute('class')).includes('focus-on'));

assert.deepEqual(errors,[]);await browser.close();console.log('Focus interaction passed')})().catch(e=>{console.error(e);process.exit(1)});
