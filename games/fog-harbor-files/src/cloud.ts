import {decodeState,type GameState} from './engine';
import {CaseStore} from './storage';
import {encodeCase,decodeCase,caseDigest,caseFingerprint,type EncodedCase} from './save-codec';
export type Session={id:number;name:string};
export type CloudMeta={kind?:'auto'|'manual';id:string;name:string;chapter:number;caseId:string;revision:number;hash:string;updated:number;deleted:boolean};
type Pending={id:string;base:number;token:string;state:GameState;kind?:'auto'|'manual';name?:string;encoded?:EncodedCase;fingerprint?:string};
type SyncData={enabled:boolean;device:string;links:Record<string,number>;campaigns:Record<string,string>;pending:Record<string,Pending>;syncedHashes?:Record<string,string>};
export type CloudView={user:Session|null;status:'off'|'checking'|'pending'|'syncing'|'synced'|'offline'|'conflict'|'error';message:string;saves:CloudMeta[];conflict?:{local:Pending;remote:CloudMeta|null};available:boolean;enabled:boolean};
export class SyncError extends Error{constructor(public code:string,public status:number,public remote:CloudMeta|null=null){super(code);}}
const endpoint='/api/games/fog-harbor-files/';
const messages:Record<string,string>={LOGIN_REQUIRED:'登录已过期，本机调查仍已保存。',ACCOUNT_CHANGED:'账号发生变化，已停止此账号的同步。',CLOUD_UNAVAILABLE:'云存档服务暂不可用，本机调查可以继续。',RATE_LIMITED:'同步过于频繁，请稍后重试。',QUOTA_EXCEEDED:'云存档容量已满，请先整理已有档案。',HASH_MISMATCH:'云端文件校验失败，未覆盖本机调查。',INVALID_SAVE:'云端未接受该存档，本机调查仍然保留。',TOO_LARGE:'压缩后的存档超过 2 MiB，本机调查仍然保留，请导出备份。'};
export class CaseSync{
 view:CloudView={user:null,status:'off',message:'本地优先 · 同步未启用',saves:[],available:false,enabled:false};private data?:SyncData;private timer?:ReturnType<typeof setTimeout>;private flushing=false;private writes:Promise<unknown>=Promise.resolve();private epoch=0;
 constructor(private store:CaseStore,private notify:(view:CloudView)=>void){}
 private publish(value:Partial<CloudView>){this.view={...this.view,...value};this.notify({...this.view});}
 private persist(account:number){
  const data=this.data;if(!data||this.view.user?.id!==account)return Promise.resolve();
  const pending=Object.fromEntries(Object.entries(data.pending).map(([id,item])=>{const {state,...packed}=item;return[id,item.encoded?packed:item];}));
  return this.store.put(`sync:${account}`,structuredClone({...data,pending}));
 }
 private async request(path:string,options:RequestInit={},account=this.view.user?.id){if(!account||account!==this.view.user?.id)throw new SyncError('ACCOUNT_CHANGED',401);const headers=new Headers(options.headers);headers.set('X-Fog-Account',String(account));headers.set('X-Fog-Sync','1');let r:Response;try{r=await fetch(endpoint+path,{...options,headers,credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(20000)});}catch{throw new SyncError('CLOUD_UNAVAILABLE',503);}if(this.view.user?.id!==account)throw new SyncError('ACCOUNT_CHANGED',401);if(!r.ok){let body;try{body=await r.json();}catch{}throw new SyncError(body?.code||'CLOUD_UNAVAILABLE',r.status,body?.save||null);}return r;}
 async check(){
  const epoch=++this.epoch;clearTimeout(this.timer);this.data=undefined;this.publish({status:'checking',enabled:false,conflict:undefined});
  try{
   const r=await fetch(endpoint+'session',{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(10000)}),body=await r.json();if(epoch!==this.epoch)return;
   if(r.status===401){this.publish({user:null,status:'off',enabled:false,available:body.available!==false,message:body.available===false?messages.CLOUD_UNAVAILABLE:'登录主站后可自愿启用云同步。',saves:[]});return;}
   if(!r.ok||!body.available)throw new SyncError('CLOUD_UNAVAILABLE',503);
   const user=body.user as Session,data=await this.store.get<SyncData>(`sync:${user.id}`)||{enabled:false,device:crypto.randomUUID(),links:{},campaigns:{},pending:{}};
   for(const item of Object.values(data.pending)){
    item.state=item.state?decodeState(item.state):await decodeCase(item.encoded!);
    item.encoded??=await encodeCase(item.state);item.fingerprint??=await caseFingerprint(item.state);
   }
   if(epoch!==this.epoch)return;this.data=data;
   this.publish({user,available:true,enabled:data.enabled,status:data.enabled?'pending':'off',message:data.enabled?'等待同步本账号的调查':'已登录；云同步未启用。'});
   await this.refresh();if(this.data!==data||this.view.user?.id!==user.id)return;
   if(data.enabled){const latest=await this.store.current();if(latest&&data.campaigns[latest.playthroughId]&&await this.store.get<number>('binding:'+latest.playthroughId)===user.id)await this.queue(latest);await this.flush();}
  }catch(e){if(epoch===this.epoch)this.failed(e);}
 }
 private failed(e:unknown){const code=e instanceof SyncError?e.code:'CLOUD_UNAVAILABLE';if(code==='LOGIN_REQUIRED'||code==='ACCOUNT_CHANGED'){this.data=undefined;this.epoch++;this.publish({user:null,enabled:false,status:'off',message:messages[code],saves:[],conflict:undefined});}else this.publish({status:typeof navigator!=='undefined'&&!navigator.onLine?'offline':'error',message:messages[code]||messages.CLOUD_UNAVAILABLE});}
 async refresh(){if(!this.view.user)return;const account=this.view.user.id,body=await(await this.request('saves',{},account)).json();if(this.view.user?.id===account)this.publish({saves:body.saves});}
 async enable(state:GameState){const user=this.view.user,data=this.data;if(!user||!data)return;await this.store.put('binding:'+state.playthroughId,user.id);if(this.data!==data||this.view.user?.id!==user.id)return;data.enabled=true;await this.persist(user.id);this.publish({enabled:true,status:'pending',message:'本账号同步已启用'});await this.queue(state);await this.flush();}
 async pause(){const user=this.view.user;if(!user||!this.data)return;clearTimeout(this.timer);this.data.enabled=false;await this.persist(user.id);this.publish({enabled:false,status:'off',message:'云同步已暂停，本机保存照常进行。'});}
 queue(state:GameState){
  const user=this.view.user,data=this.data;if(!user||!data?.enabled)return Promise.resolve();const snapshot=structuredClone(state);
  const job=async()=>{
   if(this.view.user?.id!==user.id||this.data!==data||!data.enabled)return;
   if(await this.store.get<number>('binding:'+snapshot.playthroughId)!==user.id)return;
   const id=data.campaigns[snapshot.playthroughId]||crypto.randomUUID(),old=data.pending[id],fingerprint=await caseFingerprint(snapshot);
   if(old?.fingerprint===fingerprint||!old&&data.syncedHashes?.[id]===fingerprint)return;
   const encoded=await encodeCase(snapshot);if(this.view.user?.id!==user.id||this.data!==data||!data.enabled)return;
   data.campaigns[snapshot.playthroughId]=id;data.pending[id]={id,base:old?.base??data.links[id]??0,token:crypto.randomUUID(),state:snapshot,encoded,fingerprint};
   await this.persist(user.id);this.publish({status:this.view.conflict?'conflict':'pending',message:this.view.conflict?'设备间进度存在分歧，等待你选择。':'本地已保存 · 等待同步'});clearTimeout(this.timer);this.timer=setTimeout(()=>void this.flush(),3500);
  };
  const result=this.writes.then(job,job);this.writes=result.catch(()=>{});return result;
 }
 async flush(){
  await this.writes;const user=this.view.user,data=this.data;if(!user||!data?.enabled||this.flushing||this.view.conflict)return;
  if(!navigator.onLine){this.publish({status:'offline',message:'当前离线，等待联网后补传。'});return;}
  this.flushing=true;this.publish({status:'syncing',message:'正在同步调查…'});let active:Pending|undefined;
  try{
   for(const item of Object.values(data.pending)){
    active=item;if(this.data!==data||this.view.user?.id!==user.id||!data.enabled)break;
    const encoded=item.encoded??=await encodeCase(item.state);if(!encoded.gzip)throw new SyncError('CLOUD_UNAVAILABLE',503);
    const bytes=encoded.gzip;if(bytes.byteLength>2*1024*1024)throw new SyncError('TOO_LARGE',413);const digest=await caseDigest(bytes);
    if(this.data!==data||this.view.user?.id!==user.id||!data.enabled)break;
    const r=await this.request('saves/'+item.id,{method:'PUT',headers:{'Content-Type':'application/gzip','If-Match':`"${item.base}"`,'X-State-Hash':digest,'X-Fog-Meta':encodeURIComponent(JSON.stringify({kind:item.kind||'auto',name:item.name||'最后一卷录音 · 第'+item.state.chapter+'章',chapter:item.state.chapter,caseId:item.state.caseId,schemaVersion:item.state.schemaVersion,deviceId:data.device}))},body:bytes},user.id);
    const result=await r.json(),remote=result.save as CloudMeta;
    if((result.unchanged?remote.revision<item.base:remote.revision!==item.base+1)||remote.hash!==digest)throw new SyncError('HASH_MISMATCH',503);
    if(this.data!==data||this.view.user?.id!==user.id)break;
    data.links[item.id]=remote.revision;(data.syncedHashes??={})[item.id]=item.fingerprint||await caseFingerprint(item.state);
    const pending=data.pending[item.id];if(pending?.token===item.token)delete data.pending[item.id];else if(pending)pending.base=remote.revision;await this.persist(user.id);
   }
   if(this.data===data&&this.view.user?.id===user.id&&!this.view.conflict){await this.refresh();this.publish({status:Object.keys(data.pending).length?'pending':'synced',message:Object.keys(data.pending).length?'还有新的本机进度待上传':'本地与云端已同步'});if(data.enabled&&Object.keys(data.pending).length)this.timer=setTimeout(()=>void this.flush(),3500);}
  }catch(e){
   if(this.data!==data||this.view.user?.id!==user.id)return;
   if(e instanceof SyncError&&e.status===409&&active){const pending=data.pending[active.id]||active;this.publish({status:'conflict',message:'两台设备保存了不同进度，未覆盖任何一份。',conflict:{local:pending,remote:e.remote}});}else this.failed(e);
  }finally{this.flushing=false;if(this.data&&this.data!==data&&this.data.enabled&&Object.keys(this.data.pending).length)this.timer=setTimeout(()=>void this.flush(),3500);}
 }
 async download(meta:CloudMeta,revision?:number){
  const account=this.view.user?.id,data=this.data;if(!account||!data)return;
  const r=await this.request('saves/'+meta.id+(revision?'?revision='+revision:''),{},account),bytes=await r.arrayBuffer();
  if(bytes.byteLength>2*1024*1024||await caseDigest(bytes)!==r.headers.get('X-State-Hash'))throw new SyncError('HASH_MISMATCH',503);
  const state=await decodeCase({gzip:bytes});if(revision||meta.kind==='manual')state.playthroughId=crypto.randomUUID();
  if(this.view.user?.id!==account||this.data!==data)throw new SyncError('ACCOUNT_CHANGED',401);
  await this.store.put('binding:'+state.playthroughId,account);if(this.view.user?.id!==account||this.data!==data)throw new SyncError('ACCOUNT_CHANGED',401);
  data.links[meta.id]=meta.revision;if(!revision&&meta.kind!=='manual'){data.campaigns[state.playthroughId]=meta.id;(data.syncedHashes??={})[meta.id]=await caseFingerprint(state);}
  await this.persist(account);return state;
 }
 async resolve(choice:'cloud'|'local'|'both'){
  await this.writes;const user=this.view.user,data=this.data,c=this.view.conflict;if(!user||!data||!c)return;
  const item=data.pending[c.local.id]||c.local;await this.store.save(item.state,'backup','云冲突前本机备份');if(this.data!==data||this.view.user?.id!==user.id)return;
  let state:GameState|undefined;
  if(choice==='cloud'&&c.remote&&!c.remote.deleted){state=await this.download(c.remote);if(this.data!==data)return;delete data.pending[item.id];}
  else if(choice==='local'&&c.remote&&!c.remote.deleted)data.pending[item.id]={...item,base:c.remote.revision,token:crypto.randomUUID()};
  else{const id=crypto.randomUUID();delete data.pending[item.id];data.pending[id]={...item,id,base:0,token:crypto.randomUUID()};data.campaigns[item.state.playthroughId]=id;}
  await this.persist(user.id);this.publish({conflict:undefined,status:'pending',message:'已保存冲突前备份，正在处理你的选择。'});await this.flush();return state;
 }
 async manual(state:GameState,name:string){
  await this.writes;const user=this.view.user,data=this.data;if(!user||!data?.enabled||await this.store.get<number>('binding:'+state.playthroughId)!==user.id)return;
  const snapshot=structuredClone(state),encoded=await encodeCase(snapshot),fingerprint=await caseFingerprint(snapshot);
  if(this.data!==data||this.view.user?.id!==user.id||!data.enabled)return;
  const id=crypto.randomUUID();data.pending[id]={id,base:0,token:crypto.randomUUID(),state:snapshot,kind:'manual',name:name.slice(0,80),encoded,fingerprint};await this.persist(user.id);await this.flush();
 }
 async remove(meta:CloudMeta){const data=this.data,account=this.view.user?.id;await this.request('saves/'+meta.id,{method:'DELETE',headers:{'If-Match':`"${meta.revision}"`}});if(data&&account&&this.data===data&&this.view.user?.id===account){delete data.pending[meta.id];delete data.links[meta.id];delete data.syncedHashes?.[meta.id];for(const[k,v]of Object.entries(data.campaigns))if(v===meta.id)delete data.campaigns[k];await this.persist(account);}await this.refresh();}
 login(){const url=new URL('/login','https://www.yukino.bond');url.searchParams.set('returnTo',location.origin+'/fog-harbor-files/');location.assign(url.href);}
 dispose(){clearTimeout(this.timer);this.epoch++;}
}
