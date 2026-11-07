import {it,expect,vi,afterEach} from 'vitest';
import {initialState} from '../src/engine';
import {serializeCase,deserializeCase,encodeCase,decodeCase,caseFingerprint} from '../src/save-codec';
afterEach(()=>vi.unstubAllGlobals());
it('losslessly restores every field, a full notebook and additional future fields',async()=>{
 const state={...initialState('compact-case-001',100),chapter:5,seq:99,notes:'雾港的调查笔记与证据。'.repeat(1000),collected:['E01','E02'],heard:['S01'],readEvidence:['E01'],solved:['D01'],hints:{D01:3},endings:['full'],additional:{kept:['完整保留',123]}};
 const encoded=await encodeCase(state);expect(encoded.gzip).toBeInstanceOf(ArrayBuffer);expect(encoded.json).toBeUndefined();
 expect(await decodeCase(encoded)).toEqual(state);expect(deserializeCase(JSON.parse(serializeCase(state)))).toEqual(state);
 expect(serializeCase(state).length).toBeLessThan(JSON.stringify(state).length);expect(await caseFingerprint(state)).not.toBe(await caseFingerprint({...state,notes:state.notes+'一'}));
});
it('reads original JSON/gzip snapshots and keeps local fallback storage usable without compression',async()=>{
 const state=initialState('legacy-case-001');state.notes='原有笔记';
 expect(await decodeCase({json:JSON.stringify(state)})).toEqual(state);
 const gzip=await new Response(new Blob([JSON.stringify(state)]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer();
 expect(await decodeCase({gzip})).toEqual(state);vi.stubGlobal('CompressionStream',undefined);
 const fallback=await encodeCase(state);expect(fallback.json).toBeTypeOf('string');expect(await decodeCase(fallback)).toEqual(state);
});
it('rejects unsupported, truncated and oversized expanded snapshots',async()=>{
 const packed=JSON.parse(serializeCase(initialState('invalid-case-001')));
 expect(()=>deserializeCase({...packed,version:2})).toThrow('版本');expect(()=>deserializeCase({...packed,values:[]})).toThrow('损坏');
 expect(()=>deserializeCase({...packed,extra:{notes:'override'}})).toThrow('损坏');
 const gzip=await new Response(new Blob(['a'.repeat(4*1024*1024+1)]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer();
 await expect(decodeCase({gzip})).rejects.toThrow('展开');await expect(decodeCase({gzip:new ArrayBuffer(5)})).rejects.toThrow();
});
