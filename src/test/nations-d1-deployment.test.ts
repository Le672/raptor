// @vitest-environment node
import {it,expect,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {createPortalDb} from './fixtures/portal-db';
import {ensureGameDatabase,withGameDatabase,importLegacySaves} from '../../scripts/lib/nations-d1.mjs';
import {SCHEMA} from '../../games/age-of-nations/cloud/schema.mjs';
const id='12345678-1234-1234-1234-123456789abc',base={token:'private-test-token',account:'account'};
const response=(result:unknown,status=200)=>new Response(JSON.stringify({success:status===200,result,errors:status===200?[]:[{code:10000,message:base.token}]}),{status});
it('reuses only the exact named D1 database and creates it without R2 or payment APIs',async()=>{
  const existing=vi.fn(async()=>response([{name:'yukino-nations-old',uuid:id},{name:'yukino-nations',uuid:id}]));
  await expect(ensureGameDatabase({...base,fetcher:existing})).resolves.toEqual({id,created:false});expect(existing).toHaveBeenCalledTimes(1);
  const missing=vi.fn().mockResolvedValueOnce(response([])).mockResolvedValueOnce(response({name:'yukino-nations',uuid:id}));
  await expect(ensureGameDatabase({...base,fetcher:missing})).resolves.toEqual({id,created:true});expect(JSON.parse(missing.mock.calls[1][1].body)).toEqual({name:'yukino-nations',primary_location_hint:'apac'});
  expect(missing.mock.calls.every(call=>call[0].includes('/d1/database'))).toBe(true);
});
it('fails deployment for permission errors and malformed results without printing tokens',async()=>{
  for(const result of [null,{},[{name:'yukino-nations',uuid:'invalid'}]])await expect(ensureGameDatabase({...base,fetcher:async()=>response(result)})).rejects.toThrow();
  try{await ensureGameDatabase({...base,fetcher:async()=>response(null,403)});throw new Error('did not reject');}catch(error){expect(String(error)).toContain('D1');expect(String(error)).not.toContain(base.token);}
});
it('updates only the dedicated binding and is safe to run repeatedly',()=>{
  const config='name="raptor"\n[[d1_databases]]\nbinding = "DB"\ndatabase_id = "portal"\n[ai]\nbinding = "AI"\n';
  const once=withGameDatabase(config,id);expect(once).toContain('database_id = "portal"');expect(once).toContain('[ai]');expect(once.match(/binding = "GAMES_DB"/g)).toHaveLength(1);expect(withGameDatabase(once,id)).toBe(once);expect(()=>withGameDatabase(config,'injected\nvalue')).toThrow();
});
it('reuses the existing authorized database and keeps runtime initialization aligned with migrations',()=>{
  const config='name="raptor"\n[[d1_databases]]\nbinding = "DB"\ndatabase_name = "yukino-portal"\ndatabase_id = "'+id+'"\n';
  const shared=withGameDatabase(config,id,'yukino-portal');expect(shared.match(/database_name = "yukino-portal"/g)).toHaveLength(2);expect(shared).not.toContain('yukino-nations');
  const sql=readFileSync(new URL('../../games/age-of-nations/cloud/schema.sql',import.meta.url),'utf8');
  expect(SCHEMA.join('\n').replace(/\s/g,'')).toBe(sql.replace(/\s/g,''));
});
it('imports legacy metadata without modifying portal records, and resumes an interrupted import',async()=>{
  const source=createPortalDb(),target=createPortalDb(),schema=readFileSync(new URL('../../games/age-of-nations/cloud/schema.sql',import.meta.url),'utf8');
  source.sqlite.exec(schema);target.sqlite.exec(schema);
  source.sqlite.exec("INSERT INTO nations_saves VALUES('legacy',1,'auto','archive',1,0,1,1,'hash',6,'private-object','device','token',1,1,NULL);INSERT INTO nations_save_versions VALUES('legacy',1,1,'private-object','hash',6,1)");
  let interrupt=true;
  const query=async(db:string,sql:string,params:any[]=[])=>{if(db==='target'&&sql.startsWith('INSERT INTO nations_save_versions')&&interrupt){interrupt=false;throw new Error('interrupted');}return(db==='source'?source:target).sqlite.prepare(sql).all(...params);};
  try{
    await expect(importLegacySaves({source:'source',target:'target',query})).rejects.toThrow('interrupted');
    await expect(importLegacySaves({source:'source',target:'target',query})).resolves.toMatchObject({imported:1});
    expect(target.sqlite.prepare('SELECT r2_key FROM nations_save_versions').get()).toMatchObject({r2_key:'private-object'});
    expect(source.sqlite.prepare('SELECT COUNT(*) AS n FROM nations_saves').get()).toMatchObject({n:1});
    await expect(importLegacySaves({source:'source',target:'target',query})).resolves.toMatchObject({alreadyDone:true});
  }finally{source.sqlite.close();target.sqlite.close();}
});
