import {writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {gzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const root=fileURLToPath(new URL('../',import.meta.url)),out=new URL('../.wrangler/fog-saves/',import.meta.url);
await mkdir(out,{recursive:true});
await build({stdin:{contents:"export * from './games/fog-harbor-files/src/engine.ts';export * from './games/fog-harbor-files/src/content.ts';export * from './games/fog-harbor-files/src/save-codec.ts';",resolveDir:root,loader:'ts'},bundle:true,platform:'node',format:'esm',outfile:fileURLToPath(new URL('codec.mjs',out))});
const {initialState,apply,evidence,evidenceOpen,deductions,canProve,persons,statements,serializeCase,encodeCase,decodeCase}=await import(new URL('codec.mjs',out));
const initial=initialState('fog-benchmark-001',1);let complete=initial;
for(let chapter=1;chapter<=5;chapter++){
 for(let pass=0;pass<32;pass++)for(const item of evidence)if(!complete.collected.includes(item.id)&&evidenceOpen(complete,item.id))complete=apply(complete,{type:'collect',id:item.id},complete.updatedAt+1).state;
 for(let pass=0;pass<8;pass++)for(const item of deductions)if(!complete.solved.includes(item.id)&&canProve(complete,item.id))complete=apply(complete,{type:'deduce',id:item.id,option:item.options.find(o=>o.correct).id,supports:complete.collected},complete.updatedAt+1).state;
 if(chapter<5)complete=apply(complete,{type:'advance'},complete.updatedAt+1).state;
}
for(const person of persons)for(const topic of person.topics)complete=apply(complete,{type:'topic',person:person.id,id:topic.id},complete.updatedAt+1).state;
for(const statement of statements)if(statement.challengeEvidence.length)complete=apply(complete,{type:'challenge',id:statement.id,supports:[statement.challengeEvidence[0]]},complete.updatedAt+1).state;
complete={...complete,endings:['current','full']};
let random=7;
const notes=Array.from({length:20000},()=>{random=(Math.imul(random,1664525)+1013904223)>>>0;return String.fromCharCode(0x4e00+random%3000);}).join(''),samples=[];
for(const [label,state] of [['initial',initial],['completed-case',complete],['full-notebook',{...complete,notes}]]){
 const old=JSON.stringify(state),packed=serializeCase(state),encoded=await encodeCase(state);assert.deepEqual(await decodeCase(encoded),state);
 const oldGzip=gzipSync(old).byteLength,newGzip=encoded.gzip.byteLength;
 samples.push({label,notesCharacters:state.notes.length,jsonBytes:Buffer.byteLength(old),packedBytes:Buffer.byteLength(packed),oldGzipBytes:oldGzip,newGzipBytes:newGzip,gzipReductionPercent:Math.round((1-newGzip/oldGzip)*1000)/10});
}
const result={note:'The full-notebook sample uses 20,000 deterministic varied CJK characters to exercise hard-to-compress notes.',samples};
await writeFile(new URL('benchmark.json',out),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
