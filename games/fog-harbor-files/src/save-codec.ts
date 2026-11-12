import {decodeState,type GameState} from './engine';

// This storage version is independent of the story and simulation versions.
// Field order replaces repeated names; every value, including notes, is kept.
const fields=['schemaVersion','contentVersion','caseId','playthroughId','chapter','location','collected','heard','readTopics','readEvidence','solved','challenged','notes','timelineOrder','hints','endings','startedAt','updatedAt','seq','settings'] as const;
const known=new Set<string>(fields);
export type EncodedCase={gzip:ArrayBuffer;json?:never}|{json:string;gzip?:never};
export function serializeCase(state:GameState){
 const extra=Object.fromEntries(Object.entries(state).filter(([key])=>!known.has(key)));
 return JSON.stringify({format:'fog-packed',version:1,values:fields.map(key=>state[key]),...(Object.keys(extra).length?{extra}:{})});
}
export function deserializeCase(raw:unknown):GameState{
 if(!raw||typeof raw!=='object'||(raw as any).format!=='fog-packed')return decodeState(raw);
 const packed=raw as any;
 if(packed.version!==1)throw new Error('存档版本不兼容，原文件不会被覆盖。');
 if(!Array.isArray(packed.values)||packed.values.length!==fields.length||packed.extra&&(typeof packed.extra!=='object'||Array.isArray(packed.extra)||Object.keys(packed.extra).some(key=>known.has(key))))throw new Error('存档结构损坏。');
 return decodeState({...packed.extra,...Object.fromEntries(fields.map((key,i)=>[key,packed.values[i]]))});
}
export async function caseDigest(bytes:BufferSource){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(v=>v.toString(16).padStart(2,'0')).join('');}
export function caseFingerprint(state:GameState){return caseDigest(new TextEncoder().encode(serializeCase(state)));}
export async function encodeCase(state:GameState):Promise<EncodedCase>{
 const json=serializeCase(state);
 if(!globalThis.CompressionStream)return{json};
 return{gzip:await new Response(new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer()};
}
export async function decodeCase(encoded:EncodedCase):Promise<GameState>{
 let json:string;
 if(encoded.gzip){
  if(encoded.gzip.byteLength>2*1024*1024)throw new Error('存档超过支持的大小。');
  const reader=new Blob([encoded.gzip]).stream().pipeThrough(new DecompressionStream('gzip')).getReader(),parts:Uint8Array[]=[];let size=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>4*1024*1024){await reader.cancel();throw new Error('存档展开后超过支持的大小。');}parts.push(value);}}finally{reader.releaseLock();}
  json=await new Blob(parts).text();
 }else{json=encoded.json;if(typeof json!=='string'||json.length>4*1024*1024)throw new Error('存档结构损坏。');}
 return deserializeCase(JSON.parse(json));
}
