// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
import { createPortalDb } from './fixtures/portal-db';
import { handleSpeed } from '../../speed/cloudflare/api.mjs';
import { syncLegacySpeed } from '../../speed/src/legacy-sync.mjs';
function storage() {
  const value: any = {};
  Object.defineProperties(value, {length:{get:()=>Object.keys(value).length},key:{value:(index:number)=>Object.keys(value)[index]},getItem:{value:(key:string)=>value[key]??null},setItem:{value:(key:string,entry:string)=>{value[key]=entry;}},removeItem:{value:(key:string)=>{delete value[key];}}}); return value;
}
afterEach(()=>vi.unstubAllGlobals());
it('recovers old-origin flow with original credentials and no double count, retaining local history',async () => {
  const DB = createPortalDb(), local = storage(), tab = storage(), id = crypto.randomUUID(), token = crypto.randomUUID()+crypto.randomUUID();
  const record = {id,bytes:1000000,elapsedMs:1000,status:'stopped',startedAt:'2026-10-11T10:00:00Z'};
  local.setItem('yukino-speed:run:'+id,JSON.stringify(record)); local.setItem('yukino-speed:identity:'+id,token);
  vi.stubGlobal('fetch',async (url:string,options:any)=>handleSpeed(new Request(url,{...options,headers:{...options.headers,Origin:'https://ip.yukino.bond'}}),{DB}));
  try {
    expect(await syncLegacySpeed(local,tab)).toMatchObject({bytes:1000000,sessions:1});
    await syncLegacySpeed(local,tab);
    const total = await (await handleSpeed(new Request('https://speed.yukino.bond/api/speed/totals'),{DB})).json();
    expect(total).toMatchObject({bytes:1000000,sessions:1}); expect(JSON.parse(local.getItem('yukino-speed:run:'+id))).toEqual(record);
    expect(local.getItem('yukino-speed:identity:'+id)).toBe(token); expect(local.getItem('yukino-speed:report:'+id)).toBeNull();
  } finally {DB.sqlite.close();}
});
it('keeps pending bytes and task identity when every statistics endpoint is unavailable',async () => {
  const local=storage(),tab=storage(),id=crypto.randomUUID();local.setItem('yukino-speed:run:'+id,JSON.stringify({id,bytes:100,elapsedMs:1000,status:'stopped'}));
  vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('offline')));
  await expect(syncLegacySpeed(local,tab)).rejects.toThrow('offline');
  expect(JSON.parse(local.getItem('yukino-speed:report:'+id))).toMatchObject({id,bytes:100}); expect(local.getItem('yukino-speed:identity:'+id)).toBeTruthy(); expect(local.getItem('yukino-speed:run:'+id)).toBeTruthy();
});
