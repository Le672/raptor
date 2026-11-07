import {expect,it} from 'vitest';
import {createGame,stateHash,execute,projectView,replay} from '../src/core';
import {planPlayer,runAiRound} from '../src/ai';
import {serializeSave,deserializeSave} from '../src/save-codec';
import {encodeSave,decodeSave,validateState} from '../src/store';
it('compressed local snapshots round-trip with their complete deterministic state',async()=>{const s=createGame({seed:'compressed-save',size:'small',map:'continents',difficulty:'standard',civ:'eastern',turnLimit:150,wrap:false});const record=await encodeSave(s);expect(record.gzip).toBeInstanceOf(ArrayBuffer);expect(record.gzip!.byteLength).toBeLessThan(JSON.stringify(s).length);const restored=await decodeSave(record);expect(stateHash(restored)).toBe(stateHash(s));const broken=structuredClone(s)as any;broken.pendingEvent={id:'unknown-event',player:0,city:'missing'};expect(()=>validateState(broken)).toThrow();});
it('keeps the original JSON and gzip snapshots readable',async()=>{
  const state=createGame({seed:'legacy-save',size:'large',map:'continents',difficulty:'standard',civ:'eastern',turnLimit:150,wrap:false}),json=JSON.stringify(state);
  expect(stateHash(await decodeSave({json}))).toBe(stateHash(state));
  const gzip=await new Response(new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer();expect(stateHash(await decodeSave({json:'',gzip}))).toBe(stateHash(state));
});
it('retains a developed world, remembered terrain and the entire replay in compact storage',async()=>{
  let state=createGame({seed:'packed-history',size:'small',map:'continents',difficulty:'standard',civ:'eastern',turnLimit:150,wrap:false});
  for(let i=0;i<12&&!state.winner;i++){
    if(state.pendingEvent){const result=execute(state,0,{type:'EVENT',option:1});if(result.ok)state=result.state;}
    for(const command of planPlayer(projectView(state,0),0)){const result=execute(state,0,command);if(result.ok)state=result.state;}
    state=runAiRound(state);
  }
  const restored=await decodeSave(await encodeSave(state));expect(stateHash(restored)).toBe(stateHash(state));expect(restored.commands).toEqual(state.commands);expect(stateHash(replay(restored.config,restored.commands))).toBe(stateHash(state));
  expect(serializeSave(state).length).toBeLessThan(JSON.stringify(state).length*.65);
});
it('rejects malformed compact tables and unsupported storage versions',()=>{
  const state=createGame({seed:'malformed',size:'small',map:'continents',difficulty:'standard',civ:'eastern',turnLimit:150,wrap:false}),packed=JSON.parse(serializeSave(state));
  expect(()=>deserializeSave({...packed,version:2})).toThrow('save.newer');packed.state.tiles.rows[0][0]=Number.MAX_SAFE_INTEGER;expect(()=>deserializeSave(packed)).toThrow('save.invalid');
});
