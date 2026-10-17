import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import Database from 'better-sqlite3';
import argon2 from 'argon2';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.DATA_DIR || path.join(root, 'data');
fs.mkdirSync(dataDir, { recursive: true });
const db = new Database(path.join(dataDir, 'gifts.sqlite'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(`
CREATE TABLE IF NOT EXISTS members (
 id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE, pin_hash TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS gifts (
 id INTEGER PRIMARY KEY AUTOINCREMENT, owner_id INTEGER NOT NULL REFERENCES members(id),
 title TEXT NOT NULL, url TEXT NOT NULL DEFAULT '', price TEXT NOT NULL DEFAULT '',
 notes TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS claims (
 gift_id INTEGER PRIMARY KEY REFERENCES gifts(id) ON DELETE CASCADE,
 buyer_id INTEGER NOT NULL REFERENCES members(id),
 status TEXT NOT NULL CHECK(status IN ('claimed','purchased'))
);
CREATE TABLE IF NOT EXISTS sessions (
 token_hash TEXT PRIMARY KEY, member_id INTEGER NOT NULL REFERENCES members(id),
 expires_at INTEGER NOT NULL
);
`);
// Existing installations retain their gifts and claims. Children are non-login profiles.
const columns=db.prepare('PRAGMA table_info(members)').all().map(c=>c.name);
if(!columns.includes('role')) db.exec("ALTER TABLE members ADD COLUMN role TEXT NOT NULL DEFAULT 'adult'");
db.prepare("UPDATE members SET role='child' WHERE name IN ('Harper','Callie')").run();
db.exec(`CREATE TABLE IF NOT EXISTS family_photos (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 uploader_id INTEGER NOT NULL REFERENCES members(id),
 image BLOB NOT NULL, mime TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`);
// Retire any previously established child sessions.
db.prepare("DELETE FROM sessions WHERE member_id IN (SELECT id FROM members WHERE role='child')").run();
const childParents = new Set(['Kayla','Ben']);
function canEdit(userId, ownerId){
 if(userId===ownerId) return true;
 const owner=db.prepare('SELECT role FROM members WHERE id=?').get(ownerId);
 const editor=db.prepare('SELECT name FROM members WHERE id=?').get(userId);
 return owner?.role==='child' && childParents.has(editor?.name);
}
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', process.env.TRUST_PROXY === '1' ? 1 : false);
app.use(helmet({contentSecurityPolicy:{directives:{defaultSrc:["'self'"],scriptSrc:["'self'"],styleSrc:["'self'"],imgSrc:["'self'","data:"],connectSrc:["'self'"],objectSrc:["'none'"],upgradeInsecureRequests:process.env.NODE_ENV==='production'?[]:null}}}));
app.use(express.json({limit:'16kb'}));
app.use('/api/auth', rateLimit({windowMs:15*60*1000, limit:15, standardHeaders:'draft-7',legacyHeaders:false}));
const isProd = process.env.NODE_ENV === 'production';
function cookies(req) { return Object.fromEntries((req.headers.cookie||'').split(';').map(x=>x.trim().split(/=(.*)/s).slice(0,2)).filter(x=>x.length===2)); }
const h = s=>crypto.createHash('sha256').update(s).digest('hex');
const cookieOpts = `HttpOnly; Path=/; SameSite=Strict${isProd?'; Secure':''}`;
function session(req,res,next){
 const token = cookies(req).session;
 if (!token) return res.status(401).json({error:'Please sign in.'});
 const r=db.prepare('SELECT member_id FROM sessions WHERE token_hash=? AND expires_at>?').get(h(token), Date.now());
 if(!r) return res.status(401).json({error:'Session expired. Please sign in again.'});
 req.userId=r.member_id; next();
}
function fail(res,status,message){return res.status(status).json({error:message});}
app.get('/api/members',(_req,res)=>res.json(db.prepare('SELECT id,name,role FROM members ORDER BY id').all()));
app.post('/api/auth/login',async(req,res)=>{
 const id=Number(req.body?.memberId),pin=req.body?.pin;
 if(!Number.isSafeInteger(id)||typeof pin!=='string'||pin.length<6||pin.length>128) return fail(res,400,'Invalid member or PIN.');
 const member=db.prepare('SELECT * FROM members WHERE id=?').get(id);
 // All PINs must be initialized through setup.js.
 if(!member || member.role==='child' || !(await argon2.verify(member.pin_hash,pin))) return fail(res,401,'Incorrect PIN.');
 const token=crypto.randomBytes(32).toString('base64url');
 db.prepare('INSERT INTO sessions (token_hash,member_id,expires_at) VALUES (?,?,?)').run(h(token),id,Date.now()+1000*60*60*24*14);
 res.setHeader('Set-Cookie',`session=${token}; ${cookieOpts}; Max-Age=1209600`);
 res.json({id:member.id,name:member.name,role:member.role});
});
app.post('/api/auth/logout',session,(req,res)=>{
 const token=cookies(req).session;
 db.prepare('DELETE FROM sessions WHERE token_hash=?').run(h(token));
 res.setHeader('Set-Cookie',`session=; ${cookieOpts}; Max-Age=0`);
 res.json({ok:true});
});
app.get('/api/me',session,(req,res)=>res.json(db.prepare('SELECT id,name,role FROM members WHERE id=?').get(req.userId)));
app.get('/api/gifts/:ownerId',session,(req,res)=>{
 const ownerId=Number(req.params.ownerId);
 if(!Number.isSafeInteger(ownerId)||!db.prepare('SELECT id FROM members WHERE id=?').get(ownerId)) return fail(res,404,'Member not found.');
 // SECURITY: Recipient gets no claims JOIN and no buyer/status fields at all.
 if(ownerId===req.userId) return res.json(db.prepare('SELECT id,owner_id,title,url,price,notes FROM gifts WHERE owner_id=? ORDER BY id DESC').all(ownerId));
 return res.json(db.prepare(`SELECT g.id,g.owner_id,g.title,g.url,g.price,g.notes,
 c.status,m.name AS claimed_by,c.buyer_id
 FROM gifts g LEFT JOIN claims c ON c.gift_id=g.id
 LEFT JOIN members m ON m.id=c.buyer_id
 WHERE g.owner_id=? ORDER BY g.id DESC`).all(ownerId));
});
function fields(body){
 const title=typeof body?.title==='string'?body.title.trim():'';
 const url=typeof body?.url==='string'?body.url.trim():'';
 const price=typeof body?.price==='string'?body.price.trim():'';
 const notes=typeof body?.notes==='string'?body.notes.trim():'';
 if(!title||title.length>140||url.length>1500||price.length>80||notes.length>600) return null;
 if(url){try{const u=new URL(url);if(!['https:','http:'].includes(u.protocol)) return null;}catch{return null;}}
 return {title,url,price,notes};
}
app.post('/api/gifts',session,(req,res)=>{
 const v=fields(req.body);if(!v)return fail(res,400,'Enter a title and valid optional details.');
 const ownerId=req.body?.ownerId===undefined?req.userId:Number(req.body.ownerId);
 if(!canEdit(req.userId,ownerId)) return fail(res,403,'You cannot edit this wish list.');
 const result=db.prepare('INSERT INTO gifts(owner_id,title,url,price,notes) VALUES(?,?,?,?,?)').run(ownerId,v.title,v.url,v.price,v.notes);
 res.status(201).json({id:Number(result.lastInsertRowid)});
});
app.put('/api/gifts/:id',session,(req,res)=>{
 const v=fields(req.body);if(!v)return fail(res,400,'Invalid gift details.');
 const gift=db.prepare('SELECT owner_id FROM gifts WHERE id=?').get(req.params.id);
 if(!gift||!canEdit(req.userId,gift.owner_id))return fail(res,403,'You cannot edit this wish list.');
 const r=db.prepare('UPDATE gifts SET title=?,url=?,price=?,notes=? WHERE id=?').run(v.title,v.url,v.price,v.notes,req.params.id);
 return r.changes?res.json({ok:true}):fail(res,403,'Only the gift owner can edit this.');
});
app.delete('/api/gifts/:id',session,(req,res)=>{
 const gift=db.prepare('SELECT owner_id FROM gifts WHERE id=?').get(req.params.id);
 if(!gift||!canEdit(req.userId,gift.owner_id))return fail(res,403,'You cannot edit this wish list.');
 const r=db.prepare('DELETE FROM gifts WHERE id=?').run(req.params.id);
 return r.changes?res.json({ok:true}):fail(res,403,'Only the gift owner can delete this.');
});
app.post('/api/gifts/:id/claim',session,(req,res)=>{
 const gift=db.prepare('SELECT owner_id FROM gifts WHERE id=?').get(req.params.id);
 if(!gift)return fail(res,404,'Gift not found.');
 if(gift.owner_id===req.userId)return fail(res,403,'You cannot claim your own gift.');
 try{
  db.prepare('INSERT INTO claims(gift_id,buyer_id,status) VALUES(?,?,?)').run(req.params.id,req.userId,'claimed');
  res.status(201).json({ok:true});
 }catch(err){if(err.code?.startsWith('SQLITE_CONSTRAINT'))return fail(res,409,'Someone already claimed this gift. Refresh to see who.');throw err;}
});
app.patch('/api/gifts/:id/claim',session,(req,res)=>{
 if(!['claimed','purchased'].includes(req.body?.status))return fail(res,400,'Invalid status.');
 const r=db.prepare('UPDATE claims SET status=? WHERE gift_id=? AND buyer_id=?').run(req.body.status,req.params.id,req.userId);
 return r.changes?res.json({ok:true}):fail(res,403,'Only the person who claimed this gift can update it.');
});
app.delete('/api/gifts/:id/claim',session,(req,res)=>{
 const r=db.prepare('DELETE FROM claims WHERE gift_id=? AND buyer_id=?').run(req.params.id,req.userId);
 return r.changes?res.json({ok:true}):fail(res,403,'Only the person who claimed this gift can release it.');
});
// Family photo storage: original bytes in SQLite, capped at 32 images / 2 MB each.
app.get('/api/photos',session,(_req,res)=>res.json(db.prepare('SELECT id,uploader_id,created_at FROM family_photos ORDER BY id DESC LIMIT 32').all()));
app.get('/api/photos/:id/image',session,(req,res)=>{
 const row=db.prepare('SELECT image,mime FROM family_photos WHERE id=?').get(req.params.id);
 if(!row)return fail(res,404,'Photo not found.');
 res.setHeader('Content-Type',row.mime);
 res.setHeader('Cache-Control','private, max-age=3600');
 res.setHeader('X-Content-Type-Options','nosniff');
 res.send(row.image);
});
const photoLimit=rateLimit({windowMs:60*60*1000,limit:20,standardHeaders:'draft-7',legacyHeaders:false});
app.post('/api/photos',session,photoLimit,express.raw({type:['image/jpeg','image/png','image/webp'],limit:'2mb'}),(req,res)=>{
 const buf=req.body, mime=req.headers['content-type'];
 if(!Buffer.isBuffer(buf)||buf.length<50||buf.length>2*1024*1024)return fail(res,400,'Choose a JPG, PNG or WebP under 2 MB.');
 const jpg=buf[0]===0xff&&buf[1]===0xd8&&buf[2]===0xff;
 const png=buf.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
 const webp=buf.toString('ascii',0,4)==='RIFF'&&buf.toString('ascii',8,12)==='WEBP';
 if(!((mime==='image/jpeg'&&jpg)||(mime==='image/png'&&png)||(mime==='image/webp'&&webp)))return fail(res,400,'Unrecognized image format.');
 if(db.prepare('SELECT COUNT(*) AS count FROM family_photos').get().count>=32)return fail(res,409,'Photo gallery limit of 32 reached. Delete a photo first.');
 const r=db.prepare('INSERT INTO family_photos(uploader_id,image,mime) VALUES(?,?,?)').run(req.userId,buf,mime);
 res.status(201).json({id:Number(r.lastInsertRowid)});
});
app.delete('/api/photos/:id',session,(req,res)=>{
 const r=db.prepare('DELETE FROM family_photos WHERE id=? AND uploader_id=?').run(req.params.id,req.userId);
 return r.changes?res.json({ok:true}):fail(res,403,'Only the uploader can remove this photo.');
});
app.use(express.static(path.join(root,'public'),{index:'index.html'}));
app.use((err,req,res,next)=>{console.error(err);res.status(500).json({error:'Something went wrong.'});});
const port=Number(process.env.PORT||3000);
app.listen(port,()=>console.log(`Family Gifts running at http://localhost:${port}`));
