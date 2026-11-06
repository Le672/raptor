import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
const base=fileURLToPath(new URL('../',import.meta.url));
if(isMainThread){
  const count=Math.min(500,Math.max(1,Number(process.argv[2]||100))),turns=Math.min(300,Math.max(50,Number(process.argv[3]||150)));
  const output=new URL('../.wrangler/nations-sim/core.mjs',import.meta.url);await mkdir(new URL('.',output),{recursive:true});
  await build({stdin:{contents:`export * from './games/age-of-nations/src/core.ts';export * from './games/age-of-nations/src/ai.ts';export * from './games/age-of-nations/src/store.ts';`,resolveDir:base,loader:'ts'},bundle:true,platform:'node',format:'esm',outfile:fileURLToPath(output)});
  const jobs=Array.from({length:Math.min(4,count)},(_,worker)=>new Promise((resolve,reject)=>{const thread=new Worker(new URL(import.meta.url),{workerData:{worker,count,turns,module:output.href}});thread.on('message',data=>data.progress?console.log(`Completed ${data.progress}/${count} seed ${data.seed}`):resolve(data));thread.on('error',reject);thread.on('exit',code=>{if(code)reject(new Error(`Simulation worker exited ${code}`));});}));
  const groups=await Promise.all(jobs),games=groups.flat();const report={games:games.length,turnLimit:turns,crashes:0,victories:games.reduce((out,g)=>(out[g.kind]=(out[g.kind]||0)+1,out),{}),averageTurns:games.reduce((n,g)=>n+g.turn,0)/games.length,averageTechs:games.reduce((n,g)=>n+g.techs,0)/games.length,averageCities:games.reduce((n,g)=>n+g.cities,0)/games.length,maxRoundMilliseconds:Math.max(...games.map(g=>g.maxRound)),results:games};await writeFile(new URL('../.wrangler/nations-sim/results.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify({...report,results:undefined},null,2));
}else{
  const {createGame,execute,projectView,validateState,planPlayer,runAiRound}=await import(workerData.module);const results=[];
  for(let index=workerData.worker;index<workerData.count;index+=Math.min(4,workerData.count)){
    const map=['continents','archipelago','pangaea'][index%3];let state=createGame({seed:`simulation-${index}`,size:'small',map,difficulty:index%2?'challenge':'standard',civ:['eastern','continental','northern','alpine'][index%4],turnLimit:workerData.turns,wrap:index%5===0});let maxRound=0;
    while(!state.winner&&state.turn<=workerData.turns+1){const start=performance.now();if(state.pendingEvent){const r=execute(state,0,{type:'EVENT',option:1});if(!r.ok)throw new Error(r.error);state=r.state;}for(const command of planPlayer(projectView(state,0),0)){const r=execute(state,0,command);if(r.ok)state=r.state;if(state.winner)break;}if(!state.winner)state=runAiRound(state);validateState(state);maxRound=Math.max(maxRound,performance.now()-start);}
    if(!state.winner)throw new Error(`No ending for seed ${index}`);results.push({seed:index,map,turn:state.turn,kind:state.winner.kind,winner:state.winner.player,techs:Math.max(...state.players.map(p=>p.techs.length)),cities:state.cities.filter(c=>c.owner>=0).length,projects:state.players.map(p=>p.projects),maxProduction:Math.max(...state.cities.filter(c=>c.owner>=0).map(c=>c.queue[0]?.progress||0)),maxRound:Math.round(maxRound)});if(index%10===0)parentPort.postMessage({progress:index+1,seed:index});
  }parentPort.postMessage(results);
}
