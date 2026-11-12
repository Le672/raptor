import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {gzipSync} from 'node:zlib';
const directory=new URL('../.wrangler/nations-saves/',import.meta.url);await mkdir(directory,{recursive:true});
const module=new URL('runtime.mjs',directory);
await build({stdin:{contents:"export * from './games/age-of-nations/src/core.ts';export * from './games/age-of-nations/src/ai.ts';export * from './games/age-of-nations/src/store.ts';export * from './games/age-of-nations/src/save-codec.ts';",resolveDir:fileURLToPath(new URL('../',import.meta.url)),loader:'ts'},bundle:true,platform:'node',format:'esm',outfile:fileURLToPath(module)});
const {createGame,execute,projectView,planPlayer,runAiRound,encodeSave,decodeSave,stateHash,serializeSave}=await import(module.href);
const samples=[];
async function measure(state,label){
  const legacy=JSON.stringify(state),packed=serializeSave(state),before=performance.now(),encoded=await encodeSave(state),milliseconds=Math.round((performance.now()-before)*100)/100,restored=await decodeSave(encoded);
  if(stateHash(restored)!==stateHash(state))throw new Error('Save round-trip mismatch');
  const entry={label,turn:state.turn,commands:state.commands.length,jsonBytes:Buffer.byteLength(legacy),packedBytes:Buffer.byteLength(packed),oldGzipBytes:gzipSync(legacy).byteLength,newGzipBytes:encoded.gzip.byteLength,encodeMilliseconds:milliseconds};
  entry.gzipReductionPercent=Math.round((1-entry.newGzipBytes/entry.oldGzipBytes)*1000)/10;samples.push(entry);console.log(JSON.stringify(entry));
}
for(const size of ['small','standard','large']){
  let state=createGame({seed:'storage-benchmark-v1',size,map:'continents',difficulty:'standard',civ:'eastern',turnLimit:150,wrap:false});await measure(state,`${size}-start`);
  if(size!=='large')continue;
  while(!state.winner&&state.turn<101){
    if(state.pendingEvent){const result=execute(state,0,{type:'EVENT',option:1});if(result.ok)state=result.state;}
    for(const command of planPlayer(projectView(state,0),0)){const result=execute(state,0,command);if(result.ok)state=result.state;if(state.winner)break;}
    if(!state.winner)state=runAiRound(state);
    if(state.turn%25===0)console.log(`Large-world sample reached turn ${state.turn}`);
  }
  await measure(state,'large-developed');
}
await writeFile(new URL('benchmark.json',directory),JSON.stringify({seed:'storage-benchmark-v1',samples},null,2)+'\n');
