// Freeform notebook canvas used for each video's own notes. It mirrors the Game Planner
// notebook: pan/zoom, draggable and resizable note cards, connections, headings and text
// objects, pen drawings, image drag/drop and paste, multi-select, undo, and a library.
// The component operates on a plain document { id, notes[], board{texts,edges,strokes} }
// and reports changes through an onChange(immediate) callback.
const BoardNotes=(()=>{
 const state={};
 let active=null;
 const uid=()=>crypto.randomUUID().replaceAll('-','');
 const byId=(game,nid)=>(game.notes||[]).find(n=>n.id===nid);
 const boardOf=game=>{ if(!game.board||typeof game.board!=='object')game.board={texts:[],edges:[],strokes:[]}; game.board.texts||=[]; game.board.edges||=[]; game.board.strokes||=[]; return game.board };
 const itemBy=(game,iid)=>byId(game,iid)||boardOf(game).texts.find(t=>t.id===iid);
 const isOnBoard=(game,iid)=>{const n=byId(game,iid);if(n)return !!n.onBoard;return boardOf(game).texts.some(t=>t.id===iid)};
 const boardItems=game=>[...(game.notes||[]).filter(n=>n.onBoard),...boardOf(game).texts];
 const noteTitle=n=>(n.title||'').trim()||((n.body||'').split('\n').find(l=>l.trim())||'').slice(0,70)||'Untitled note';
 const excerpt=n=>(n.body||'').replace(/[#*`>_-]/g,' ').replace(/\s+/g,' ').trim().slice(0,140)||'No content yet';
 const touch=n=>{n.updatedAt=new Date().toISOString()};
 const defaultWidth=()=>220;
 function ctx(key){ if(!state[key])state[key]={camera:{x:60,y:60,z:1},tool:'move',selected:null,group:new Set(),strokeGroup:new Set(),history:[],filter:'',libraryOpen:false,expanded:false,changed:false,saving:false,timer:null,pointers:new Map(),gesture:null,space:false}; return state[key] }

 function inline(s){
  return esc(s)
   .replace(/`([^`]+)`/g,(m,c)=>`<code>${c}</code>`)
   .replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>')
   .replace(/(^|[^*])\*([^*\n]+)\*/g,'$1<em>$2</em>')
   .replace(/!\[([^\]]*)\]\((https?:\/\/[^)\s]+|\/assets\/[a-f0-9]{32}\.(?:png|jpg|webp|gif))\)/g,'<img class="note-image" src="$2" alt="$1">')
   .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+|\/assets\/[a-f0-9]{32}\.(?:png|jpg|webp|gif))\)/g,'<a href="$2" target="_blank" rel="noopener">$1</a>');
 }
 function md(text){
  const lines=String(text??'').replace(/\r\n?/g,'\n').split('\n');
  let html='',list=null,para=[];
  const flushPara=()=>{ if(para.length){html+=`<p>${para.join('<br>')}</p>`;para=[]} };
  const closeList=()=>{ if(list){html+=`</${list}>`;list=null} };
  const flush=()=>{flushPara();closeList()};
  for(const line of lines){
   let m;
   if(!line.trim()){flush();continue}
   if((m=line.match(/^(#{1,4})\s+(.*)$/))){flush();const l=m[1].length;html+=`<h${l}>${inline(m[2])}</h${l}>`;continue}
   if(/^(---|\*\*\*|___)\s*$/.test(line)){flush();html+='<hr>';continue}
   if((m=line.match(/^\s*[-*+]\s+(.*)$/))){flushPara();if(list!=='ul'){closeList();html+='<ul>';list='ul'}html+=`<li>${inline(m[1])}</li>`;continue}
   if((m=line.match(/^\s*\d+[.)]\s+(.*)$/))){flushPara();if(list!=='ol'){closeList();html+='<ol>';list='ol'}html+=`<li>${inline(m[1])}</li>`;continue}
   if((m=line.match(/^>\s?(.*)$/))){flush();html+=`<blockquote>${inline(m[1])}</blockquote>`;continue}
   closeList();para.push(inline(line));
  }
  flush();
  return html;
 }
 function imagesHtml(list){
  return (list||[]).filter(a=>a&&a.path).map(a=>`<img class="note-image" src="${esc(a.path)}" alt="${esc(a.name||'Image')}" loading="lazy">`).join('');
 }
 function thumbsHtml(list){
  return (list||[]).map((a,i)=>`<span class="thumb"><img src="${esc(a.path)}" alt="${esc(a.name||'')}"><button type="button" data-drop-image="${i}" aria-label="Remove image">×</button></span>`).join('');
 }
 async function uploadImage(file){
  if(!file)return null;
  if(!/^image\/(png|jpeg|webp|gif)$/.test(file.type)){toast('Use PNG, JPEG, WebP, or GIF');return null}
  if(file.size>10000000){toast('Image must be under 10 MB');return null}
  try{
   const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]);r.onerror=reject;r.readAsDataURL(file)});
   return await api('image',{name:file.name,data});
  }catch(e){toast(e.message||'Could not add image');return null}
 }
 function imageInputHtml(){
  return `<div class="image-drop" data-image-drop>Drop images here, paste into the note, or <label class="text-link" style="display:inline;margin:0">browse<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" data-image-input multiple hidden></label></div>`;
 }

 // ---------------------------------------------------------------- persistence
 function status(key){const c=ctx(key);document.querySelectorAll('.nb-status').forEach(e=>e.textContent=c.saving?'Saving…':c.changed?'Unsaved':'Saved')}
 async function persist(game,key,onChange){const c=ctx(key);clearTimeout(c.timer);if(c.saving||!c.changed)return;c.saving=true;c.changed=false;status(key);try{await onChange(true)}catch(e){c.changed=true;toast(e.message)}finally{c.saving=false;status(key)}}
 function edit(game,key,onChange){const c=ctx(key);c.changed=true;status(key);clearTimeout(c.timer);c.timer=setTimeout(()=>persist(game,key,onChange),500)}
 function snapshot(game,key){const c=ctx(key);c.history.push(JSON.stringify({notes:game.notes||[],board:boardOf(game)}));if(c.history.length>30)c.history.shift()}
 function undo(game,key,onChange){const c=ctx(key);if(!c.history.length)return;const previous=JSON.parse(c.history.pop());game.notes=previous.notes;game.board=previous.board;c.selected=null;c.group.clear();c.strokeGroup.clear();edit(game,key,onChange);draw(game,key,onChange);library(game,key,onChange)}
 function removeNotes(game,key,onChange,ids){const c=ctx(key);snapshot(game,key);game.notes=game.notes.filter(n=>!ids.has(n.id));const b=boardOf(game);b.edges=b.edges.filter(e=>!ids.has(e.from)&&!ids.has(e.to));c.group.clear();c.strokeGroup.clear();c.selected=null;edit(game,key,onChange);draw(game,key,onChange);library(game,key,onChange);toast('Deleted. Use Undo to restore.')}
 function deleteSelected(game,key,onChange){
  const c=ctx(key);
  if(!c.group.size&&!c.strokeGroup.size&&!c.selected)return;
  snapshot(game,key);
  const ids=new Set(c.group);
  if(!ids.size&&c.selected?.kind==='note')ids.add(c.selected.id);
  const b=boardOf(game);
  game.notes.forEach(n=>{if(ids.has(n.id))n.onBoard=false});
  b.texts=b.texts.filter(t=>!ids.has(t.id));
  b.edges=b.edges.filter(e=>!ids.has(e.from)&&!ids.has(e.to));
  if(c.strokeGroup.size)b.strokes=b.strokes.filter((_,i)=>!c.strokeGroup.has(i));
  else if(!ids.size&&c.selected&&c.selected.kind!=='note'){const list=c.selected.kind==='edge'?b.edges:b.strokes;list.splice(c.selected.index,1)}
  c.group.clear();c.strokeGroup.clear();c.selected=null;edit(game,key,onChange);draw(game,key,onChange);library(game,key,onChange);
  toast('Removed from board. Use Undo to restore.');
 }

 // ---------------------------------------------------------------- geometry
 function size(game,item){const el=document.querySelector(`[data-item="${item.id}"]`);return {w:item.width||el?.offsetWidth||defaultWidth(),h:item.height||el?.offsetHeight||180}}
 function anchors(a,b){const sa=size(null,a),sb=size(null,b),ax=a.x+sa.w/2,ay=a.y+sa.h/2,bx=b.x+sb.w/2,by=b.y+sb.h/2,dx=bx-ax,dy=by-ay;const t=1/Math.max(Math.abs(dx)/(sa.w/2),Math.abs(dy)/(sa.h/2),1),u=1/Math.max(Math.abs(dx)/(sb.w/2),Math.abs(dy)/(sb.h/2),1);return {x1:ax+dx*t,y1:ay+dy*t,x2:bx-dx*u,y2:by-dy*u}}
 function connected(game,a,b){return boardOf(game).edges.some(e=>(e.from===a&&e.to===b)||(e.from===b&&e.to===a))}
 function connect(game,a,b){if(a&&b&&a!==b&&!connected(game,a,b))boardOf(game).edges.push({from:a,to:b})}
 function center(key){const el=document.getElementById('board-scroll'),c=ctx(key);return {x:((el?.clientWidth||600)/2-c.camera.x)/c.camera.z-110,y:((el?.clientHeight||500)/2-c.camera.y)/c.camera.z-80}}
 function world(key,e){const el=document.getElementById('board-scroll'),c=ctx(key),r=el.getBoundingClientRect();return {x:(e.clientX-r.left-c.camera.x)/c.camera.z,y:(e.clientY-r.top-c.camera.y)/c.camera.z}}
 function transform(game,key){const board=document.getElementById('note-board'),viewport=document.getElementById('board-scroll');if(!board)return;const c=ctx(key);board.style.transform=`translate(${c.camera.x}px,${c.camera.y}px) scale(${c.camera.z})`;viewport.style.backgroundSize=`${24*c.camera.z}px ${24*c.camera.z}px`;viewport.style.backgroundPosition=`${c.camera.x}px ${c.camera.y}px`;viewport.dataset.pen=String(c.tool==='draw');const z=document.getElementById('nb-zoom');if(z)z.textContent=Math.round(c.camera.z*100)+'%';try{localStorage.setItem('board-camera:'+(game.id||key),JSON.stringify(c.camera))}catch{}}
 function zoom(game,key,z,x,y){const el=document.getElementById('board-scroll'),c=ctx(key);if(!el)return;x??=el.clientWidth/2;y??=el.clientHeight/2;z=Math.min(4,Math.max(.1,z));c.camera.x=x-(x-c.camera.x)*z/c.camera.z;c.camera.y=y-(y-c.camera.y)*z/c.camera.z;c.camera.z=z;transform(game,key)}
 function fit(game,key){const c=ctx(key);let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;const include=(x,y)=>{minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y)};boardItems(game).forEach(n=>{include(n.x,n.y);include(n.x+size(game,n).w,n.y+size(game,n).h)});boardOf(game).strokes.forEach(s=>s.points.forEach(p=>include(...p)));const el=document.getElementById('board-scroll');if(!Number.isFinite(minX)){c.camera={x:60,y:60,z:1};transform(game,key);return}c.camera.z=Math.max(.1,Math.min(1.5,(el.clientWidth-100)/(maxX-minX||1),(el.clientHeight-100)/(maxY-minY||1)));c.camera.x=el.clientWidth/2-(minX+maxX)/2*c.camera.z;c.camera.y=el.clientHeight/2-(minY+maxY)/2*c.camera.z;transform(game,key)}

 // ---------------------------------------------------------------- rendering
 function noteCardHtml(c,n){
  const imageOnly=(n.images||[]).length&&!n.title&&!(n.body||'').trim();
  const body=n.body?`<div class="note-body-text">${md(n.body)}</div>`:'';
  return `<article tabindex="0" class="board-note color-${n.color||'plain'} ${imageOnly?'image-only':''} ${c.group.has(n.id)?'connecting':''}" style="left:${n.x}px;top:${n.y}px;width:${n.width||defaultWidth()}px;${n.height?`height:${n.height}px;`:''}" data-item="${n.id}" data-note="${n.id}" aria-label="${esc(noteTitle(n))}. Drag to move; double-click to edit."><div class="note-handle"><span>${esc((n.tags||[]).join(', ')||'Note')}</span></div><div class="note-content">${n.title?`<strong>${esc(n.title)}</strong>`:''}${imagesHtml(n.images)}${body}</div><button class="note-resize" data-resize="${n.id}" aria-label="Resize note" title="Drag to resize">◢</button><button class="note-port" data-port="${n.id}" aria-label="Connect note" title="Drag to connect"></button></article>`;
 }
 function textCardHtml(c,t){
  return `<div tabindex="0" class="board-text kind-${t.kind} ${c.group.has(t.id)?'connecting':''}" data-item="${t.id}" data-text="${t.id}" style="left:${t.x}px;top:${t.y}px;width:${t.width||300}px" aria-label="${esc(t.text)}. Double-click to edit text."><div class="board-text-content">${esc(t.text)||'Write…'}</div></div>`;
 }
 function lines(game,key){
  const svg=document.getElementById('board-ink');if(!svg)return;
  const c=ctx(key),b=boardOf(game);
  svg.innerHTML=b.edges.map((e,i)=>{const a=itemBy(game,e.from),d=itemBy(game,e.to);if(!a||!d||!isOnBoard(game,e.from)||!isOnBoard(game,e.to))return '';const p=anchors(a,d);return `<line class="${c.selected?.kind==='edge'&&c.selected.index===i?'ink-selected':''}" data-edge="${i}" x1="${p.x1}" y1="${p.y1}" x2="${p.x2}" y2="${p.y2}"/>`}).join('')+b.strokes.map((s,i)=>`<polyline class="${c.strokeGroup.has(i)||(c.selected?.kind==='stroke'&&c.selected.index===i)?'ink-selected':''}" data-stroke="${i}" points="${s.points.map(p=>p.join(',')).join(' ')}"/>`).join('');
  if(c.gesture?.kind==='connect'){const n=itemBy(game,c.gesture.id);if(n){const z=size(game,n);svg.innerHTML+=`<line class="connection-preview" x1="${n.x+z.w}" y1="${n.y+Math.min(60,z.h/2)}" x2="${c.gesture.point.x}" y2="${c.gesture.point.y}"/>`}}
 }
 function draw(game,key,onChange){
  const cards=document.getElementById('board-cards');if(!cards)return;
  const c=ctx(key),b=boardOf(game);
  lines(game,key);
  cards.innerHTML=(game.notes||[]).filter(n=>n.onBoard).map(n=>noteCardHtml(c,n)).join('')
   +b.texts.map(t=>textCardHtml(c,t)).join('');
  cards.querySelectorAll('[data-text]').forEach(el=>el.ondblclick=e=>{e.stopPropagation();textEditor(game,key,onChange,el.dataset.text)});
  cards.querySelectorAll('[data-note]').forEach(el=>el.ondblclick=e=>{if(e.target.closest('button,a'))return;e.stopPropagation();editor(game,key,onChange,el.dataset.note,null)});
  transform(game,key);
 }
 function library(game,key,onChange){
  const el=document.getElementById('note-library');if(!el)return;
  const c=ctx(key),q=c.filter.trim().toLowerCase();
  const notes=(game.notes||[]).filter(n=>(noteTitle(n)+' '+(n.body||'')+' '+(n.tags||[]).join(' ')).toLowerCase().includes(q));
  el.innerHTML=notes.length?notes.map(n=>`<div class="library-note color-${n.color||'plain'}" draggable="true" data-drag-note="${n.id}"><button type="button" data-edit-note="${n.id}">${n.title?`<strong>${esc(n.title)}</strong>`:''}<p>${esc(excerpt(n))}</p></button><small>${esc((n.tags||[]).join(' · ')||'No tags')}</small><div><button type="button" class="text-link" data-place-note="${n.id}">${n.onBoard?'Locate':'Add to board'}</button></div></div>`).join(''):'<p class="muted">Nothing here yet.</p>';
  el.querySelectorAll('[data-edit-note]').forEach(btn=>btn.onclick=()=>editor(game,key,onChange,btn.dataset.editNote,null));
  el.querySelectorAll('[data-place-note]').forEach(btn=>btn.onclick=()=>{
   const n=byId(game,btn.dataset.placeNote),scroll=document.getElementById('board-scroll');if(!n)return;
   if(!n.onBoard){snapshot(game,key);n.onBoard=true;Object.assign(n,center(key));edit(game,key,onChange)}
   c.camera.x=scroll.clientWidth/2-(n.x+110)*c.camera.z;c.camera.y=scroll.clientHeight/2-(n.y+100)*c.camera.z;
   c.group.clear();c.group.add(n.id);c.selected={kind:'note',id:n.id};draw(game,key,onChange);library(game,key,onChange);transform(game,key);
  });
  el.querySelectorAll('[data-drag-note]').forEach(card=>card.ondragstart=e=>{e.dataTransfer.setData('application/x-notebook',card.dataset.dragNote);e.dataTransfer.effectAllowed='copyMove'});
 }

 function sectionHtml(game,key){
  const c=ctx(key);
  return `<section id="notebook-root" class="${c.expanded?'expanded':''}"><div class="canvas-top"><div class="canvas-tools"><button type="button" class="secondary" id="nb-library" aria-pressed="${c.libraryOpen}" title="Library">Library</button><button type="button" class="secondary" data-new-note title="New note">＋ Note</button><button type="button" class="secondary" id="nb-heading">Heading</button><button type="button" class="secondary" id="nb-text">Text</button><button type="button" class="secondary" id="nb-pen" aria-pressed="${c.tool==='draw'}" title="Pen / Select">✎</button><span class="nb-status">${c.changed?'Unsaved':'Saved'}</span></div><button type="button" class="secondary" id="nb-expand" title="Expand canvas">${c.expanded?'Exit full screen':'Full screen'}</button></div><aside class="note-library ${c.libraryOpen?'open':''}"><input id="note-filter" type="search" aria-label="Search notes" placeholder="Search notes…" value="${esc(c.filter)}"><div id="note-library"></div></aside><div id="board-scroll" tabindex="0" aria-label="Notes canvas. Drag blank space to pan; scroll to zoom; drop images to add them."><div id="note-board"><svg id="board-ink" width="1" height="1"></svg><div id="board-cards"></div></div></div><div class="canvas-bottom"><span id="nb-help">Drag blank space to pan · Scroll to zoom · Double-click to add a note · Drop or paste images</span><div class="canvas-tools"><button type="button" id="nb-undo" title="Undo">↶</button><button type="button" id="nb-fit" title="Fit all">Fit</button><button type="button" id="nb-minus" aria-label="Zoom out">−</button><button type="button" id="nb-zoom" title="Reset zoom">100%</button><button type="button" id="nb-plus" aria-label="Zoom in">＋</button><button type="button" id="nb-save" title="Save now">Save</button></div></div></section>`;
 }

 function bindCanvas(game,key,onChange){
  const el=document.getElementById('board-scroll'),c=ctx(key);
  library(game,key,onChange);draw(game,key,onChange);
  document.getElementById('nb-library').onclick=()=>{c.libraryOpen=!c.libraryOpen;document.querySelector('#notebook-root .note-library').classList.toggle('open',c.libraryOpen);document.getElementById('nb-library').setAttribute('aria-pressed',String(c.libraryOpen))};
  document.getElementById('nb-heading').onclick=()=>textEditor(game,key,onChange,'','heading');
  document.getElementById('nb-text').onclick=()=>textEditor(game,key,onChange,'','text');
  document.getElementById('nb-pen').onclick=()=>{c.tool=c.tool==='draw'?'move':'draw';document.getElementById('nb-pen').setAttribute('aria-pressed',String(c.tool==='draw'));transform(game,key)};
  document.getElementById('nb-save').onclick=()=>{c.changed=true;persist(game,key,onChange)};
  document.getElementById('nb-undo').onclick=()=>undo(game,key,onChange);
  document.getElementById('nb-fit').onclick=()=>fit(game,key);
  document.getElementById('nb-plus').onclick=()=>zoom(game,key,c.camera.z*1.2);
  document.getElementById('nb-minus').onclick=()=>zoom(game,key,c.camera.z/1.2);
  document.getElementById('nb-zoom').onclick=()=>zoom(game,key,1);
  document.getElementById('nb-expand').onclick=()=>{c.expanded=!c.expanded;document.getElementById('notebook-root').classList.toggle('expanded',c.expanded);document.getElementById('nb-expand').textContent=c.expanded?'Exit full screen':'Full screen';transform(game,key)};
  document.getElementById('note-filter').oninput=e=>{c.filter=e.target.value;library(game,key,onChange)};

  el.ondragover=e=>{e.preventDefault()};
  el.ondrop=async e=>{
   e.preventDefault();
   const addNote=images=>{
    if(!images.length)return;
    const pos=world(key,e),now=new Date().toISOString();
    const n={id:uid(),title:'',body:'',color:'plain',tags:[],images,onBoard:true,x:pos.x,y:pos.y,createdAt:now,updatedAt:now};
    snapshot(game,key);game.notes=[...(game.notes||[]),n];edit(game,key,onChange);draw(game,key,onChange);library(game,key,onChange);
   };
   const images=[];
   const droppedFiles=[...(e.dataTransfer.files||[])].filter(f=>String(f.type).startsWith('image/'));
   for(const f of droppedFiles){const a=await uploadImage(f);if(a)images.push(a)}
   if(images.length){addNote(images);return}
   try{const nid=e.dataTransfer.getData('application/x-notebook');const n=byId(game,nid);if(!n)return;snapshot(game,key);n.onBoard=true;Object.assign(n,world(key,e));edit(game,key,onChange);draw(game,key,onChange);library(game,key,onChange)}catch{}
  };
  el.onwheel=e=>{e.preventDefault();const r=el.getBoundingClientRect(),factor=e.deltaMode===1?16:e.deltaMode===2?el.clientHeight:1;zoom(game,key,c.camera.z*Math.exp(-e.deltaY*factor*.002),e.clientX-r.left,e.clientY-r.top)};
  el.ondblclick=e=>{if(!e.target.closest('[data-item]'))editor(game,key,onChange,'',world(key,e))};

  el.onpointerdown=e=>{
   c.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
   if(e.target.closest('a,textarea,input,select')||(e.target.closest('button')&&!e.target.closest('[data-port],[data-resize]'))||e.button===2)return;
   e.preventDefault();el.focus();
   if(c.space){c.gesture={kind:'pan',x:e.clientX,y:e.clientY,cx:c.camera.x,cy:c.camera.y,captured:false};return}
   if(c.tool==='draw'&&!e.target.closest('[data-port],[data-resize]')){c.gesture={kind:'draw',stroke:boardOf(game).strokes.length};boardOf(game).strokes.push({points:[[world(key,e).x,world(key,e).y]]});lines(game,key);el.setPointerCapture(e.pointerId);return}
   if(e.target.closest('[data-port]')){c.gesture={kind:'connect',id:e.target.closest('[data-port]').dataset.port,point:world(key,e)};lines(game,key);return}
   if(e.target.closest('[data-resize]')){const n=itemBy(game,e.target.closest('[data-resize]').dataset.resize);const s=size(game,n);c.gesture={kind:'resize',id:n.id,x:e.clientX,y:e.clientY,w:s.w,h:s.h};el.setPointerCapture(e.pointerId);return}
   const item=e.target.closest('[data-item]');
   if(item){
    const iid=item.dataset.item;
    if(!c.group.has(iid)){c.group.clear();c.group.add(iid)}
    c.selected={kind:byId(game,iid)?'note':'item',id:iid};
    const items=[...c.group].map(gid=>{const n=itemBy(game,gid);return {id:gid,x:n.x,y:n.y}});
    const strokes=[...c.strokeGroup].map(i=>({i,points:boardOf(game).strokes[i].points.map(p=>[...p])}));
    c.gesture={kind:'note',x:e.clientX,y:e.clientY,items,strokes,moved:false,captured:false};return;
   }
   if(e.shiftKey){c.gesture={kind:'select',start:world(key,e),base:new Set(c.group),strokes:new Set(c.strokeGroup)};el.setPointerCapture(e.pointerId)}
   else c.gesture={kind:'pan',x:e.clientX,y:e.clientY,cx:c.camera.x,cy:c.camera.y,captured:false};
  };

  el.onpointermove=e=>{
   c.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
   const g=c.gesture;if(!g)return;
   if(g.kind==='pan'){if(!g.captured){g.captured=true;el.setPointerCapture(e.pointerId)}c.camera.x=g.cx+e.clientX-g.x;c.camera.y=g.cy+e.clientY-g.y;transform(game,key)}
   else if(g.kind==='note'){const dx=(e.clientX-g.x)/c.camera.z,dy=(e.clientY-g.y)/c.camera.z;if(Math.hypot(dx,dy)>3){g.moved=true;if(!g.captured){g.captured=true;el.setPointerCapture(e.pointerId)}}for(const o of g.items){const n=itemBy(game,o.id);n.x=o.x+dx;n.y=o.y+dy;const card=document.querySelector(`[data-item="${n.id}"]`);if(card){card.style.left=n.x+'px';card.style.top=n.y+'px'}}for(const s of g.strokes)boardOf(game).strokes[s.i].points=s.points.map(p=>[p[0]+dx,p[1]+dy]);lines(game,key)}
   else if(g.kind==='resize'){const n=itemBy(game,g.id);n.width=Math.min(3000,Math.max(140,g.w+(e.clientX-g.x)/c.camera.z));n.height=Math.min(3000,Math.max(100,g.h+(e.clientY-g.y)/c.camera.z));const card=document.querySelector(`[data-item="${n.id}"]`);if(card){card.style.width=n.width+'px';card.style.height=n.height+'px'}lines(game,key)}
   else if(g.kind==='select'){const p=world(key,e),x=Math.min(p.x,g.start.x),y=Math.min(p.y,g.start.y),r=Math.max(p.x,g.start.x),b=Math.max(p.y,g.start.y);c.group=new Set(g.base);c.strokeGroup=new Set(g.strokes);boardItems(game).forEach(n=>{const z=size(game,n);if(n.x<=r&&n.x+z.w>=x&&n.y<=b&&n.y+z.h>=y)c.group.add(n.id)});boardOf(game).strokes.forEach((s,i)=>{if(s.points.some(pt=>pt[0]>=x&&pt[0]<=r&&pt[1]>=y&&pt[1]<=b))c.strokeGroup.add(i)});highlight(game,key);let box=document.getElementById('selection-box');if(!box){box=document.createElement('div');box.id='selection-box';document.getElementById('note-board').append(box)}Object.assign(box.style,{left:x+'px',top:y+'px',width:(r-x)+'px',height:(b-y)+'px'})}
   else if(g.kind==='connect'){g.point=world(key,e);lines(game,key)}
   else if(g.kind==='draw'){g.point=world(key,e);boardOf(game).strokes[g.stroke].points.push([g.point.x,g.point.y]);lines(game,key)}
  };

  const end=e=>{
   c.pointers.delete(e.pointerId);
   const g=c.gesture;if(!g)return;
   if(g.kind==='connect'&&e.type!=='pointercancel'){const target=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-item]')?.dataset.item;if(target&&target!==g.id&&!connected(game,g.id,target)){snapshot(game,key);connect(game,g.id,target);edit(game,key,onChange)}}
   if(g.kind==='draw'||g.kind==='resize'||(g.kind==='note'&&g.moved))edit(game,key,onChange);
   const wasClick=g.kind==='note'&&!g.moved;
   document.getElementById('selection-box')?.remove();c.gesture=null;
   if(c.pointers.size===1){const p=[...c.pointers.values()][0];c.gesture={kind:'pan',x:p.x,y:p.y,cx:c.camera.x,cy:c.camera.y,captured:false}}
   if(wasClick)highlight(game,key);else draw(game,key,onChange);
  };
  el.onpointerup=end;el.onpointercancel=end;el.onlostpointercapture=e=>{if(c.pointers.has(e.pointerId))end(e)};
 }

 function highlight(game,key){document.querySelectorAll('[data-item]').forEach(el=>el.classList.toggle('connecting',ctx(key).group.has(el.dataset.item)));lines(game,key)}

 function textEditor(game,key,onChange,tid='',kind='heading'){
  const c=ctx(key);let t=boardOf(game).texts.find(x=>x.id===tid),fresh=!t;
  if(fresh){t={id:uid(),kind,text:'',...center(key)};boardOf(game).texts.push(t);draw(game,key,onChange)}
  const el=document.querySelector(`[data-text="${t.id}"]`),content=el?.querySelector('.board-text-content');
  if(!el||el.querySelector('textarea'))return;
  const input=document.createElement('textarea');input.className='board-text-input';input.setAttribute('aria-label',t.kind==='heading'?'Heading text':'Board text');input.value=t.text;content.replaceWith(input);
  const grow=()=>{input.style.height='auto';input.style.height=input.scrollHeight+'px'};input.oninput=grow;
  let finished=false;const finish=cancel=>{if(finished)return;finished=true;const value=input.value.trim();if(fresh)boardOf(game).texts=boardOf(game).texts.filter(x=>x.id!==t.id);if(!cancel){snapshot(game,key);if(value){t.text=value;if(fresh)boardOf(game).texts.push(t)}else boardOf(game).texts=boardOf(game).texts.filter(x=>x.id!==t.id);edit(game,key,onChange)}draw(game,key,onChange)};
  input.onblur=()=>finish(false);input.onkeydown=e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();finish(true)}else if(e.key==='Enter'&&(t.kind==='heading'||e.ctrlKey||e.metaKey)&&!e.shiftKey){e.preventDefault();finish(false)}};
  input.focus();grow();
 }

 function editor(game,key,onChange,nid='',position=null){
  const existing=byId(game,nid);
  const note=existing||{id:uid(),title:'',body:'',color:'plain',tags:[],images:[],onBoard:!!position,x:position?position.x:0,y:position?position.y:0,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
  let pendingImages=[...(note.images||[])];
  let dialog=document.getElementById('note-editor');
  if(!dialog){dialog=document.createElement('dialog');dialog.id='note-editor';document.body.append(dialog)}
  dialog.innerHTML=`<form id="note-form"><h2>${existing?'Edit note':'New note'}</h2><label>Title (optional)<input name="title" value="${esc(note.title||'')}" maxlength="250" placeholder="Note title"></label><label>Note<textarea name="body" class="note-writing" placeholder="Write… Markdown headings, lists, links and images are supported.">${esc(note.body||'')}</textarea></label>${imageInputHtml()}<div class="thumb-row" data-image-thumbs>${thumbsHtml(pendingImages)}</div><div class="meta-row"><label>Tags (comma-separated)<input name="tags" value="${esc((note.tags||[]).join(', '))}" placeholder="idea, hook, reference"></label><label>Colour<select name="color">${['plain','yellow','blue','pink','green'].map(x=>`<option ${note.color===x?'selected':''}>${x}</option>`).join('')}</select></label></div><div class="dialog-actions">${existing?'<button type="button" id="delete-note" class="secondary danger">Delete</button>':''}<button type="button" id="cancel-note" class="secondary">Cancel</button><button class="primary">Save note</button></div></form>`;
  dialog.showModal();dialog.querySelector('[name=body]').focus();
  const drawThumbs=()=>{dialog.querySelector('[data-image-thumbs]').innerHTML=thumbsHtml(pendingImages);bindThumbs()};
  const bindThumbs=()=>dialog.querySelectorAll('[data-drop-image]').forEach(b=>b.onclick=()=>{pendingImages.splice(Number(b.dataset.dropImage),1);drawThumbs()});
  bindThumbs();
  const addFiles=async files=>{for(const f of [...(files||[])]){const a=await uploadImage(f);if(a)pendingImages.push(a)}drawThumbs()};
  dialog.querySelector('[data-image-input]').onchange=e=>addFiles(e.target.files);
  const drop=dialog.querySelector('[data-image-drop]');
  drop.ondragover=e=>{e.preventDefault();drop.classList.add('over')};
  drop.ondragleave=()=>drop.classList.remove('over');
  drop.ondrop=e=>{e.preventDefault();drop.classList.remove('over');addFiles(e.dataTransfer.files)};
  dialog.querySelector('[name=body]').addEventListener('paste',e=>{const files=[...(e.clipboardData?.items||[])].filter(i=>i.kind==='file').map(i=>i.getAsFile()).filter(Boolean);if(files.length){e.preventDefault();addFiles(files)}});
  dialog.querySelector('#cancel-note').onclick=()=>dialog.close();
  dialog.querySelector('#delete-note')?.addEventListener('click',()=>{removeNotes(game,key,onChange,new Set([note.id]));dialog.close()});
  dialog.querySelector('#note-form').onsubmit=e=>{
   e.preventDefault();const f=e.target.elements;
   if(!existing)game.notes=[...(game.notes||[]),note];
   note.title=f.title.value;note.body=f.body.value;note.tags=f.tags.value.split(',').map(x=>x.trim()).filter(Boolean);note.color=f.color.value;note.images=pendingImages;
   if(position&&!existing){note.onBoard=true;note.x=position.x;note.y=position.y}
   touch(note);edit(game,key,onChange);draw(game,key,onChange);library(game,key,onChange);dialog.close();
  };
 }

 // ---------------------------------------------------------------- mount
 function mount(root,game,key,onChange){
  if(!root)return;
  boardOf(game);
  const c=ctx(key);
  active={game,key,onChange};
  try{const saved=JSON.parse(localStorage.getItem('board-camera:'+(game.id||key)));if(saved&&[saved.x,saved.y,saved.z].every(Number.isFinite)&&saved.z>=.1&&saved.z<=4)c.camera=saved}catch{}
  root.innerHTML=sectionHtml(game,key);
  c.pointers=new Map();c.gesture=null;
  library(game,key,onChange);draw(game,key,onChange);
  root.querySelector('[data-new-note]')?.addEventListener('click',()=>editor(game,key,onChange,'',center(key)));
  bindCanvas(game,key,onChange);
 }
 function unmount(){active=null}

 window.addEventListener('keydown',e=>{
  if(!active||!document.getElementById('notebook-root')||document.querySelector('dialog[open]')||e.target.closest('input,textarea,select'))return;
  const {game,key,onChange}=active,c=ctx(key);
  if(e.key==='Escape'){c.tool='move';c.selected=null;c.group.clear();c.strokeGroup.clear();if(c.expanded){c.expanded=false;document.getElementById('notebook-root').classList.remove('expanded');document.getElementById('nb-expand').textContent='Full screen'}draw(game,key,onChange);return}
  if(e.code==='Space'){e.preventDefault();c.space=true}
  if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='z'){e.preventDefault();undo(game,key,onChange);return}
  if(e.metaKey||e.ctrlKey)return;
  if(e.key.toLowerCase()==='f'){c.expanded=!c.expanded;document.getElementById('notebook-root').classList.toggle('expanded',c.expanded);document.getElementById('nb-expand').textContent=c.expanded?'Exit full screen':'Full screen';transform(game,key)}
  if(e.key.toLowerCase()==='n')editor(game,key,onChange,'',center(key));
  if(e.key==='+'||e.key==='=')zoom(game,key,c.camera.z*1.2);
  if(e.key==='-')zoom(game,key,c.camera.z/1.2);
  if(e.key==='0')fit(game,key);
  if(e.key.toLowerCase()==='p'||e.key.toLowerCase()==='v'){c.tool=e.key.toLowerCase()==='p'?'draw':'move';document.getElementById('nb-pen').setAttribute('aria-pressed',String(c.tool==='draw'));transform(game,key)}
  if(e.key==='Enter'&&c.selected){const n=byId(game,c.selected.id);if(n)editor(game,key,onChange,c.selected.id,null);else textEditor(game,key,onChange,c.selected.id)}
  if(['Delete','Backspace'].includes(e.key)){e.preventDefault();deleteSelected(game,key,onChange)}
 });
 window.addEventListener('keyup',e=>{if(e.code==='Space'&&active)ctx(active.key).space=false});
 window.addEventListener('blur',()=>{if(active)ctx(active.key).space=false});
 window.addEventListener('beforeunload',e=>{if(active&&(ctx(active.key).changed||ctx(active.key).saving)){e.preventDefault();e.returnValue=''}});

 return {mount,unmount,md,imagesHtml,thumbsHtml,uploadImage,imageInputHtml,noteTitle,excerpt};
})();
