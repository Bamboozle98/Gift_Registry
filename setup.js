import Database from 'better-sqlite3';
import argon2 from 'argon2';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import {stdin as input,stdout as output} from 'node:process';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const d=process.env.DATA_DIR||path.join(root,'data');
fs.mkdirSync(d,{recursive:true});
const db=new Database(path.join(d,'gifts.sqlite'));
db.exec('CREATE TABLE IF NOT EXISTS members (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE, pin_hash TEXT NOT NULL)');
const rl=readline.createInterface({input,output});
console.log('Choose UNIQUE PINs of at least 6 digits for each person. Do not share them in chat or commit them.');
const names=['Mom','Dad','Brannon','Jackson','Kayla','Ben'];
try{
 for(let i=0;i<names.length;i++){
  const n=names[i];const pin=(await rl.question(`PIN for ${n}: `)).trim();
  if(!/^\d{6,12}$/.test(pin))throw new Error(`PIN for ${n} must be 6–12 digits. Run setup again.`);
  const hash=await argon2.hash(pin,{type:argon2.argon2id});
  db.prepare('INSERT INTO members(id,name,pin_hash) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET pin_hash=excluded.pin_hash').run(i+1,n,hash);
 }
 db.prepare("UPDATE members SET role='child' WHERE name IN ('Harper','Callie')").run();
 console.log('PIN setup complete. Every previous session should be invalidated after rotating a PIN.');
}finally{rl.close();db.close();}
