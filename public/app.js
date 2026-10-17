const names=['Mom','Dad','Brannon','Jackson','Kayla','Ben','Harper','Callie'];
const state={me:null,members:[],owner:null,items:[],editing:null,message:'',error:false};
const app=document.getElementById('app');
let photos=[],photoIndex=0,photoTimer=null;
const isChild=m=>m?.role==='child';
const canEditOwner=()=>state.owner===state.me?.id || (['Kayla','Ben'].includes(state.me?.name)&&isChild(state.members.find(x=>x.id===state.owner)));
async function loadPhotos(){try{photos=await api('/api/photos');drawPhotos();}catch{}}
function drawPhotos(){const layer=document.getElementById('photo-background');if(!layer)return;
 layer.innerHTML=photos.length?`<div class="photo-stage"></div><div class="photo-stage"></div>`:'';
 if(photoTimer)clearInterval(photoTimer);
 if(!photos.length)return;
 const stages=[...layer.children];let visible=0;
 const paint=(el,index)=>{el.style.backgroundImage=`url('/api/photos/${photos[index%photos.length].id}/image')`;};
 paint(stages[0],0);stages[0].classList.add('visible');
 if(photos.length>1)photoTimer=setInterval(()=>{const next=1-visible;photoIndex=(photoIndex+1)%photos.length;paint(stages[next],photoIndex);stages[next].classList.add('visible');stages[visible].classList.remove('visible');visible=next;},8000);
}

const e=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function api(url,opt={}){let r=await fetch(url,{...opt,headers:{'Content-Type':'application/json',...(opt.headers||{})}}),d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||`Request failed (${r.status})`);return d;}
const nav=()=>`<div class="top"><span class="brand">✦ Family Gifts</span><div class="top-right">${state.me?`<span class="muted small">${e(state.me.name)}</span><button class="btn ghost small" data-action="logout">Sign out</button>`:''}</div></div>`;
const msg=()=>state.message?`<div class="alert ${state.error?'error':''}" role="status">${e(state.message)}</div>`:'';
function say(s,bad=false){state.message=s;state.error=bad;render();}
function render(){
 if(!state.me){app.innerHTML=`<main class="shell">${nav()}<h1>Surprises stay surprises.</h1><p class="muted">Everyone adds what they want. Everyone else can coordinate the gifts.</p>${msg()}<section class="card stack"><h2>Who's signing in?</h2><div class="member-grid">${state.members.filter(m=>!isChild(m)).map(m=>`<button class="member" data-member="${m.id}"><span class="avatar">${e(m.name[0])}</span><strong>${e(m.name)}</strong><span class="arrow">→</span></button>`).join('')}</div></section><p class="foot">Your own gifts never reveal who claimed them.</p></main>`;return;}
 if(state.owner===null){app.innerHTML=`<main class="shell">${nav()}<h1>Hi, ${e(state.me.name)} 👋</h1><p class="muted">Edit your own list or find a gift for someone else.</p>${msg()}<div class="my-list-panel"><button class="my-list-button" data-owner="${state.me.id}"><span class="my-icon">♡</span><span><strong>My List</strong><small>Your ideas, just for you to manage</small></span><span class="arrow">→</span></button></div><h2 class="browse-label">Browse family wish lists</h2><div class="member-grid">${state.members.filter(m=>m.id!==state.me.id).map(m=>`<button class="member" data-owner="${m.id}"><span class="avatar">${e(m.name[0])}</span><strong>${e(m.name)}${isChild(m)?' 🧸':''}</strong><span class="arrow">→</span></button>`).join('')}</div><div class="photo-controls"><button class="btn secondary small" data-action="photos">Manage family photos</button></div><p class="foot">Only people other than the recipient can see claims.</p></main>`;return;}
 const mine=state.owner===state.me.id,editable=canEditOwner(),owner=state.members.find(m=>m.id===state.owner);
 app.innerHTML=`<main class="shell">${nav()}<div style="margin-top:24px"><button class="back" data-action="back">← Family</button></div><div class="list-head"><div><h1>${mine?'My wish list':e(owner?.name)+"'s wish list"}</h1><p class="muted">${mine?'Add, update, or remove your ideas. Gift claims are kept secret from you.':editable?'Manage this child’s list and coordinate gifts with the family.':'Browse ideas and coordinate with other shoppers.'}</p></div>${editable?'<button class="btn" data-action="new">+ Add gift</button>':''}</div>${msg()}<section class="stack">${state.items.length?state.items.map(g=>giftCard(g,mine,editable)).join(''):`<div class="empty">${mine?'Your wish list is empty. Add your first gift idea!':'No gift ideas here yet.'}</div>`}</section><p class="foot">Family Gifts · Private surprises for eight people</p></main>`;
}
function giftCard(g,mine,editable){
 const status=g.status||'available',isBuyer=g.buyer_id===state.me.id;
 const editControls=editable?`<button class="btn secondary small" data-action="edit" data-id="${g.id}">Edit</button><button class="btn danger small" data-action="delete" data-id="${g.id}">Delete</button>`:'';
 const claimControls=mine?'':status==='available'?`<button class="btn small" data-action="claim" data-id="${g.id}">Claim this gift</button>`:isBuyer?`<button class="btn secondary small" data-action="toggle" data-id="${g.id}" data-status="${status==='claimed'?'purchased':'claimed'}">Mark ${status==='claimed'?'purchased':'claimed'}</button><button class="btn ghost small" data-action="release" data-id="${g.id}">Release claim</button>`:'';
 return `<article class="card"><div class="gift-title">${e(g.title)}</div>${g.price?`<div class="muted small">Estimated price: ${e(g.price)}</div>`:''}${g.notes?`<p class="muted small">${e(g.notes)}</p>`:''}${g.url?`<p><a class="links small" href="${e(g.url)}" target="_blank" rel="noopener noreferrer">View gift link ↗</a></p>`:''}${!mine?`<div style="margin-top:12px"><span class="tag ${e(status)}">${status==='available'?'Available':status==='claimed'?'Claimed':'Purchased'}</span>${g.claimed_by?` <span class="muted small">by ${e(g.claimed_by)}</span>`:''}</div>`:''}<div class="actions">${editControls}${claimControls}</div></article>`;
}
function photoPage(){app.innerHTML=`<main class="shell">${nav()}<button class="back" data-action="back">← Family</button><h1>Family photos</h1><p class="muted">Photos rotate gently behind the app for signed-in family members. Upload a JPG, PNG, or WebP under 2 MB. Maximum 32 photos.</p><form id="upload-photo" class="card stack"><div class="field"><label for="photo-file">Add a family photo</label><input id="photo-file" type="file" accept="image/jpeg,image/png,image/webp" required></div><button class="btn" type="submit">Upload photo</button></form><section class="photo-gallery">${photos.map(p=>`<div class="photo-tile"><img src="/api/photos/${p.id}/image" alt="Family photo" loading="lazy">${p.uploader_id===state.me.id?`<button class="btn danger small" data-action="removePhoto" data-id="${p.id}">Remove</button>`:''}</div>`).join('')}</section></main>`;}
function loginForm(id){const m=state.members.find(x=>x.id===id);app.innerHTML=`<main class="shell">${nav()}<button class="back" data-action="cancel">← Back</button><h1>Welcome, ${e(m.name)}</h1><p class="muted">Enter your personal PIN to continue.</p><form id="login" class="card" data-id="${id}"><div class="field"><label for="pin">Personal PIN</label><input id="pin" name="pin" type="password" class="pin-entry" inputmode="numeric" pattern="[0-9]{6,12}" minlength="6" maxlength="12" autocomplete="current-password" required autofocus></div><button class="btn" type="submit">Sign in</button></form></main>`;document.querySelector('#pin')?.focus();}
function giftForm(g){const isEdit=!!g;app.innerHTML=`<main class="shell">${nav()}<button class="back" data-action="backToList">← Back to list</button><h1>${isEdit?'Edit gift':'Add a gift idea'}</h1><form id="gift" class="card stack"><div class="field"><label>Gift name *</label><input name="title" maxlength="140" value="${e(g?.title||'')}" required placeholder="e.g. Coffee maker"></div><div class="field"><label>Product link</label><input name="url" type="url" maxlength="1500" value="${e(g?.url||'')}" placeholder="https://..."></div><div class="field"><label>Estimated price</label><input name="price" maxlength="80" value="${e(g?.price||'')}" placeholder="$50"></div><div class="field"><label>Details, size or color</label><textarea name="notes" maxlength="600">${e(g?.notes||'')}</textarea></div><button class="btn" type="submit">${isEdit?'Save changes':'Add to wish list'}</button></form></main>`;state.editing=g?.id||null;}
async function loadList(id){state.owner=id;state.message='';state.items=await api(`/api/gifts/${id}`);render();}
async function refresh(){if(state.owner!==null)await loadList(state.owner);}
app.addEventListener('click',async ev=>{
 const member=ev.target.closest('[data-member]');if(member){loginForm(Number(member.dataset.member));return;}
 const owner=ev.target.closest('[data-owner]');if(owner){try{await loadList(Number(owner.dataset.owner));}catch(err){say(err.message,true)}return;}
 const b=ev.target.closest('[data-action]');if(!b)return;const a=b.dataset.action,id=Number(b.dataset.id);
 try{
 if(a==='cancel'){state.message='';render();}else if(a==='logout'){await api('/api/auth/logout',{method:'POST'});state.me=null;state.owner=null;photos=[];if(photoTimer)clearInterval(photoTimer);drawPhotos();render();}
 else if(a==='photos'){photoPage();}
 else if(a==='removePhoto'){if(confirm('Remove this photo?')){await api(`/api/photos/${id}`,{method:'DELETE'});await loadPhotos();photoPage();}}
 else if(a==='back'){state.owner=null;state.message='';render();}else if(a==='new')giftForm(null);
 else if(a==='backToList')render();else if(a==='edit')giftForm(state.items.find(x=>x.id===id));
 else if(a==='delete'){if(confirm('Delete this gift idea? Existing claims will also be removed.')){await api(`/api/gifts/${id}`,{method:'DELETE'});await refresh();}}
 else if(a==='claim'){await api(`/api/gifts/${id}/claim`,{method:'POST'});await refresh();}
 else if(a==='toggle'){await api(`/api/gifts/${id}/claim`,{method:'PATCH',body:JSON.stringify({status:b.dataset.status})});await refresh();}
 else if(a==='release'){if(confirm('Release your claim on this gift?')){await api(`/api/gifts/${id}/claim`,{method:'DELETE'});await refresh();}}
 }catch(err){try{await refresh();}catch{}say(err.message,true);}
});
app.addEventListener('submit',async ev=>{
 if(!['login','gift','upload-photo'].includes(ev.target.id))return;ev.preventDefault();
 const f=ev.target,button=f.querySelector('button[type=submit]');button.disabled=true;
 try{
 if(f.id==='upload-photo'){const file=f.querySelector('input[type=file]').files[0];if(!file)throw new Error('Choose an image.');if(file.size>2*1024*1024)throw new Error('Photo must be smaller than 2 MB.');const r=await fetch('/api/photos',{method:'POST',headers:{'Content-Type':file.type},body:file});const data=await r.json();if(!r.ok)throw new Error(data.error||'Upload failed');await loadPhotos();photoPage();}
 else if(f.id==='login'){const me=await api('/api/auth/login',{method:'POST',body:JSON.stringify({memberId:Number(f.dataset.id),pin:new FormData(f).get('pin')})});state.me=me;state.owner=null;state.message='';render();await loadPhotos();}
 else {const o=Object.fromEntries(new FormData(f));await api(state.editing?`/api/gifts/${state.editing}`:'/api/gifts',{method:state.editing?'PUT':'POST',body:JSON.stringify({...o,ownerId:state.owner})});state.editing=null;await refresh();}
 }catch(err){button.disabled=false;if(f.id==='login'){alert(err.message);}else alert(err.message);}
});
(async()=>{try{state.members=await api('/api/members');state.me=await api('/api/me').catch(()=>null);render();if(state.me)await loadPhotos();}catch(err){app.textContent=`Could not connect to server: ${err.message}`;}})();
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));
