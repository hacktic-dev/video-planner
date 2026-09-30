const {chromium}=require('playwright');const fs=require('fs');const assert=require('assert');
(async()=>{const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||"msedge"});const page=await browser.newPage({viewport:{width:1400,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
const mainId='a'.repeat(32),shortId='b'.repeat(32);const posts=[];
let videos=[{id:mainId,title:'Main video',stage:'Research',isShort:false,tasks:[],pillar:'',date:'',color:'plain',archived:false,deleted:false},{id:shortId,title:'Short video',stage:'Research',isShort:true,tasks:[],pillar:'',date:'',color:'plain',archived:false,deleted:false}];
const channel={name:'My channel',mission:'',pillars:'Creative coding',notes:'',tasks:[]};const book={revision:0,notes:[],texts:[],edges:[],strokes:[]};
await page.route('http://localhost:54321/**',async route=>{const path=new URL(route.request().url()).pathname;
 if(path==='/api/workspace')return route.fulfill({json:{workspacePath:'test',workspaceGit:false,videos,channel,notebook:book}});
 if(path==='/api/video'){const v=route.request().postDataJSON();posts.push(v);v.id||='f'.repeat(32);const i=videos.findIndex(x=>x.id===v.id);if(i<0)videos.push(v);else videos[i]=v;return route.fulfill({json:v})}
 if(path==='/api/channel')return route.fulfill({json:channel});
 if(path==='/api/notebook'){book.revision++;return route.fulfill({json:book})}
 const file='web/'+(path==='/'?'index.html':path.slice(1));await route.fulfill({body:fs.readFileSync(file),contentType:path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':'text/html'})});
await page.goto('http://localhost:54321/#videos/shorts');await page.locator('.video-card').first().waitFor();
assert.equal(await page.locator('.video-card[data-video="'+shortId+'"]').count(),1);assert.equal(await page.locator('.video-card[data-video="'+mainId+'"]').count(),0);
await page.locator('[data-create][data-short="true"]').first().click();await page.locator('#create-dialog[open]').waitFor();assert.equal(await page.locator('#create-dialog h2').textContent(),'New short');
await page.locator('#new-title').fill('Brand new short');await page.locator('#create-form button.primary').click();await page.waitForTimeout(500);
const created=posts.find(p=>p.title==='Brand new short');assert(created);assert.equal(created.isShort,true);assert.equal(created.stage,'Research');
await page.goto('http://localhost:54321/#video/'+shortId);await page.locator('[data-field="isShort"]').waitFor();assert.equal(await page.locator('[data-field="isShort"]').inputValue(),'true');
await page.locator('[data-field="isShort"]').selectOption('false');await page.locator('#save-video').click();await page.waitForTimeout(500);
const updated=posts.filter(p=>p.id===shortId).pop();assert(updated);assert.equal(updated.isShort,false);
await page.goto('http://localhost:54321/#videos/shorts');await page.locator('.video-card').first().waitFor();assert.equal(await page.locator('.video-card[data-video="'+shortId+'"]').count(),0);
assert.deepEqual(errors,[]);await browser.close();console.log('Videos shorts passed')})().catch(e=>{console.error(e);process.exit(1)});
