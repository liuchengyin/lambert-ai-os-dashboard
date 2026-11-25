import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
export class Store {
 constructor(file){this.db=new DatabaseSync(file);this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS tasks(id TEXT PRIMARY KEY,owner TEXT NOT NULL,body TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS events(seq INTEGER PRIMARY KEY AUTOINCREMENT,task TEXT NOT NULL,body TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS disabled(provider TEXT PRIMARY KEY);
 `);}
 save(t){t.updatedAt=new Date().toISOString();this.db.prepare('INSERT INTO tasks VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body').run(t.id,t.owner,JSON.stringify(t));return t;}
 get(id){const r=this.db.prepare('SELECT body FROM tasks WHERE id=?').get(id);return r?JSON.parse(r.body):null;}
 list(owner){return this.db.prepare('SELECT body FROM tasks WHERE owner=? ORDER BY rowid DESC LIMIT 100').all(owner).map(r=>JSON.parse(r.body));}
 all(){return this.db.prepare('SELECT body FROM tasks').all().map(r=>JSON.parse(r.body));}
 event(t,type,data={}){this.db.prepare('INSERT INTO events(task,body) VALUES(?,?)').run(t.id,JSON.stringify({at:new Date().toISOString(),type,...data}));}
 events(id){return this.db.prepare('SELECT seq,body FROM events WHERE task=? ORDER BY seq').all(id).map(r=>({seq:r.seq,...JSON.parse(r.body)}));}
 transaction(fn){this.db.exec('BEGIN IMMEDIATE');try{const v=fn();this.db.exec('COMMIT');return v;}catch(e){this.db.exec('ROLLBACK');throw e;}}
 transition(t,type,data={}){this.transaction(()=>{this.save(t);this.event(t,type,data);});}
 create(owner,input){const t={id:randomUUID(),owner,goal:input.goal,constraints:input.constraints||'',acceptance:input.acceptance||'',files:input.files,repository:'liuchengyin/lambert-ai-os-dashboard',branch:'',step:0,status:'paused',provider:'deepseek',next:'resume',calls:0,autoSwitch:['rate_limit','timeout','service','quota'],createdAt:new Date().toISOString()};t.branch='feat/web-studio-'+t.id;this.transition(t,'created');return t;}
 disable(p){this.db.prepare('INSERT OR IGNORE INTO disabled VALUES(?)').run(p);}
 enabled(p){return !this.db.prepare('SELECT 1 FROM disabled WHERE provider=?').get(p);}
 enable(p){this.db.prepare('DELETE FROM disabled WHERE provider=?').run(p);}
 recover(){for(const t of this.all())if(t.status==='running'){t.status='paused';t.next='interrupted: inspect workspace before resume';this.transition(t,'interrupted',{step:t.step});}}
 close(){this.db.close();}
}
