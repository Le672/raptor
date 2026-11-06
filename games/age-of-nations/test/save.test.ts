import {expect,it} from 'vitest';
import {createGame,stateHash} from '../src/core';
import {encodeSave,decodeSave,validateState} from '../src/store';
it('compressed local snapshots round-trip with their complete deterministic state',async()=>{const s=createGame({seed:'compressed-save',size:'small',map:'continents',difficulty:'standard',civ:'eastern',turnLimit:150,wrap:false});const record=await encodeSave(s);expect(record.gzip).toBeInstanceOf(ArrayBuffer);expect(record.gzip!.byteLength).toBeLessThan(JSON.stringify(s).length);const restored=await decodeSave(record);expect(stateHash(restored)).toBe(stateHash(s));const broken=structuredClone(s)as any;broken.pendingEvent={id:'unknown-event',player:0,city:'missing'};expect(()=>validateState(broken)).toThrow();});
