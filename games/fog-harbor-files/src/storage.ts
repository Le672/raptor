import {decodeState,type GameState} from './engine';
import {encodeCase,decodeCase,caseFingerprint,type EncodedCase} from './save-codec';
export type Saved={id:string;name:string;kind:'auto'|'chapter'|'manual'|'backup';updated:number;chapter:number;state:GameState};
type Stored=Omit<Saved,'state'>&{state?:GameState;encoded?:EncodedCase;fingerprint?:string};
const DB='yukino.fog-harbor-files',STORE='records';
export class CaseStore{
 private writes:Promise<unknown>=Promise.resolve();private snapshots:Promise<unknown>=Promise.resolve();private db?:Promise<IDBDatabase>;
 private pendingAuto?:{state:GameState;name:string;result:Promise<Saved>};
 open(){return this.db??=new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open(DB,1);request.onupgradeneeded=()=>{request.result.createObjectStore(STORE);};request.onsuccess=()=>resolve(request.result);request.onerror=()=>{this.db=undefined;reject(new Error('本机存储未能打开，请导出调查备份。'));};request.onblocked=()=>reject(new Error('另一页面阻止了存储更新，请关闭旧页面后重试。'));});}
 async get<T>(key:string):Promise<T|undefined>{const db=await this.open();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readonly'),request=tx.objectStore(STORE).get(key);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
 put<T>(key:string,value:T){const job=async()=>{const db=await this.open();await new Promise<void>((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(value,key);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('保存中断，请重试。'));});};const result=this.writes.then(job,job);this.writes=result.catch(()=>{});return result;}
 remove(key:string){const job=async()=>{const db=await this.open();await new Promise<void>((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).delete(key);tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);tx.onerror=()=>reject(tx.error);});};const result=this.writes.then(job,job);this.writes=result.catch(()=>{});return result;}
 private async hydrate(row:Stored):Promise<Saved>{const {encoded,fingerprint,...meta}=row;return{...meta,state:encoded?await decodeCase(encoded):decodeState(row.state)};}
 save(state:GameState,kind:Saved['kind']='auto',name=''){
  const snapshot=structuredClone(state),id=kind==='auto'?'current':kind==='chapter'?`chapter-${snapshot.playthroughId}-${snapshot.chapter}`:crypto.randomUUID();
  const title=name||({auto:'当前调查',chapter:'章节检查点',manual:'手动档案',backup:'覆盖前备份'}[kind]);
  if(kind==='auto'&&this.pendingAuto?.state.playthroughId===snapshot.playthroughId&&this.pendingAuto.name===title){this.pendingAuto.state=snapshot;return this.pendingAuto.result;}
  // Merge only auto saves that have not started. Checkpoints and manual saves
  // form an ordering boundary and retain their explicitly requested snapshots.
  const batch={state:snapshot,name:title,result:undefined as unknown as Promise<Saved>};
  this.pendingAuto=kind==='auto'?batch:undefined;
  const job=async()=>{
   if(this.pendingAuto===batch)this.pendingAuto=undefined;const snapshot=batch.state;
   const fingerprint=await caseFingerprint(snapshot);
   if(kind==='auto'||kind==='chapter'){const existing=await this.get<Stored>(`save:${id}`);if(existing?.fingerprint===fingerprint&&existing.kind===kind&&existing.name===title)return this.hydrate(existing);}
   const row:Stored={id,name:title,kind,updated:snapshot.updatedAt,chapter:snapshot.chapter,encoded:await encodeCase(snapshot),fingerprint};
   await this.put(`save:${id}`,row);return{...row,state:snapshot} as Saved;
  };
  const result=this.snapshots.then(job,job);batch.result=result;this.snapshots=result.catch(()=>{});return result;
 }
 async list():Promise<Saved[]>{await this.snapshots;const db=await this.open();const rows=await new Promise<Stored[]>((resolve,reject)=>{const tx=db.transaction(STORE,'readonly'),request=tx.objectStore(STORE).openCursor(),rows:Stored[]=[];request.onsuccess=()=>{const c=request.result;if(c){if(String(c.key).startsWith('save:'))rows.push(c.value);c.continue();}else resolve(rows.sort((a,b)=>b.updated-a.updated));};request.onerror=()=>reject(request.error);});return Promise.all(rows.map(row=>this.hydrate(row)));}
 async current(){await this.snapshots;const row=await this.get<Stored>('save:current');return row?(await this.hydrate(row)).state:null;}
 async flush(){await this.snapshots;await this.writes;}
}
export function exportCase(state:GameState){const blob=new Blob([JSON.stringify({format:'fog-harbor-files',exportedAt:new Date().toISOString(),state},null,2)],{type:'application/json;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`fog-harbor-files-ch${state.chapter}-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export async function importCase(file:File){if(file.size>2*1024*1024)throw new Error('文件超过 2 MB，不能作为调查存档导入。');const data=JSON.parse(await file.text());if(data.format!=='fog-harbor-files')throw new Error('请选择雾港档案导出的 JSON 文件。');return decodeState(data.state);}
