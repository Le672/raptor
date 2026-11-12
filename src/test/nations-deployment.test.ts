import {describe,it,expect,vi} from 'vitest';
import {ensureGameStorage,withoutGameStorage} from '../../scripts/lib/nations-deployment.mjs';

const response=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status});
const base={token:'test-private-token',account:'test-account'};
describe('optional game storage during website releases',()=>{
  it('keeps an existing private bucket enabled without recreating it',async()=>{
    const fetcher=vi.fn(async()=>response(200,{success:true}));
    await expect(ensureGameStorage({...base,allowUnavailable:true,fetcher})).resolves.toEqual({ready:true,created:false});expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('creates only the missing named bucket',async()=>{
    const fetcher=vi.fn().mockResolvedValueOnce(response(404,{errors:[{code:10006}]})).mockResolvedValueOnce(response(200,{success:true}));
    await expect(ensureGameStorage({...base,fetcher})).resolves.toEqual({ready:true,created:true});
    expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({name:'yukino-games-saves'});
  });
  it('permits a local release only for the explicit R2-not-enabled response',async()=>{
    for(const status of [400,403]){
      const fetcher=vi.fn(async()=>response(status,{errors:[{code:10042}]}));
      await expect(ensureGameStorage({...base,allowUnavailable:true,fetcher})).resolves.toEqual({ready:false,reason:'R2_NOT_ENABLED'});
      await expect(ensureGameStorage({...base,fetcher})).rejects.toThrow('R2 is not enabled');
    }
  });
  it('handles an activation error during bucket creation',async()=>{
    const fetcher=vi.fn().mockResolvedValueOnce(response(404,{})).mockResolvedValueOnce(response(400,{errors:[{code:10042}]}));
    await expect(ensureGameStorage({...base,allowUnavailable:true,fetcher})).resolves.toEqual({ready:false,reason:'R2_NOT_ENABLED'});
  });
  it('fails closed for token, transport and malformed-response errors without logging secrets',async()=>{
    for(const body of [{errors:[{code:10000,message:base.token}]},{success:false},null]){
      const fetcher=vi.fn(async()=>response(403,body));
      await expect(ensureGameStorage({...base,allowUnavailable:true,fetcher})).rejects.toThrow();
    }
    await expect(ensureGameStorage({...base,allowUnavailable:true,fetcher:async()=>{throw new Error('network');}})).rejects.toThrow('network');
    try{await ensureGameStorage({...base,allowUnavailable:true,fetcher:async()=>response(403,{errors:[{code:10000,message:base.token}]})});}catch(error){expect(String(error)).not.toContain(base.token);}
  });
  it('omits only the optional binding and preserves the website database, AI and other buckets',()=>{
    const config='name = "raptor"\n[[d1_databases]]\nbinding = "DB"\n\n[ai]\nbinding = "AI"\n\n[[r2_buckets]]\nbinding = "GAMES_SAVES"\nbucket_name = "yukino-games-saves"\n\n# Keep secret instructions\n[[r2_buckets]]\nbinding = "OTHER"\nbucket_name = "other"\n';
    const output=withoutGameStorage(config);expect(output).not.toContain('GAMES_SAVES');expect(output).not.toContain('yukino-games-saves');expect(output).toContain('[ai]\nbinding = "AI"');expect(output).toContain('binding = "DB"');expect(output).toContain('binding = "OTHER"');expect(output).toContain('# Keep secret instructions');expect(()=>withoutGameStorage(output)).toThrow('exactly one');
  });
});
