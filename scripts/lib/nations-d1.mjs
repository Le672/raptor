export const GAME_DATABASE='yukino-nations';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function cloudflareD1({token,account,fetcher=fetch}){
  if(!token||!account)throw new Error('Cloudflare deployment credentials are required');
  return async function request(path='',options={}){
    const response=await fetcher(`https://api.cloudflare.com/client/v4/accounts/${account}/d1/database${path}`,{...options,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(30000)});
    const data=await response.json().catch(()=>null);
    if(!response.ok||data?.success!==true){const codes=(data?.errors||[]).map(error=>Number(error.code)).filter(Number.isFinite);throw new Error(`D1 deployment request failed (HTTP ${response.status}; codes ${codes.join(',')||'unavailable'}). The deployment token needs Account > D1 > Edit.`);}
    return data.result;
  };
}
export async function ensureGameDatabase(options){
  const request=cloudflareD1(options),databases=await request(`?name=${GAME_DATABASE}&per_page=100`);
  if(!Array.isArray(databases))throw new Error('Invalid D1 database list');
  const found=databases.filter(db=>db.name===GAME_DATABASE);
  if(found.length>1)throw new Error('Ambiguous game D1 database');
  const database=found[0]||await request('',{method:'POST',body:JSON.stringify({name:GAME_DATABASE,primary_location_hint:'apac'})});
  if(database?.name!==GAME_DATABASE||!uuid.test(database?.uuid||''))throw new Error('Invalid game D1 database response');
  return{id:database.uuid,created:!found.length};
}
export function withGameDatabase(config,id,name=GAME_DATABASE){
  if(!uuid.test(id))throw new Error('Invalid game database ID');
  if(![GAME_DATABASE,'yukino-portal'].includes(name))throw new Error('Invalid game database name');
  let count=0;
  const output=config.split(/(?=^\[)/m).map(section=>{
    if(!section.startsWith('[[d1_databases]]')||!/^binding\s*=\s*"GAMES_DB"\s*$/m.test(section))return section;
    count++;if(!/^database_id\s*=/m.test(section))throw new Error('Game database binding is missing its ID');
    return section.replace(/^database_id\s*=.*$/m,`database_id = "${id}"`).replace(/^database_name\s*=.*$/m,`database_name = "${name}"`);
  }).join('');
  if(count>1)throw new Error('Duplicate game database binding');
  return count?output:output+`\n[[d1_databases]]\nbinding = "GAMES_DB"\ndatabase_name = "${name}"\ndatabase_id = "${id}"\n`;
}

// Copy metadata only, retaining the old private objects as a read fallback.
// This runs once and never deletes or modifies the portal database.
export async function importLegacySaves({source,target,query}){
  const migration='portal-r2-metadata-v1';
  if((await query(target,'SELECT name FROM nations_storage_migrations WHERE name=?',[migration])).length)return{imported:0,alreadyDone:true};
  if((await query(source,"SELECT name FROM sqlite_master WHERE type='table' AND name='nations_save_chunks'")).length&&(await query(source,'SELECT 1 AS present FROM nations_save_chunks LIMIT 1')).length)throw new Error('D1 snapshots already exist in the source; migrate their bytes before selecting an independent database');
  const tables=await query(source,"SELECT name FROM sqlite_master WHERE type='table' AND name IN ('nations_saves','nations_save_versions')");
  let imported=0;
  if(tables.length){
    if(tables.length!==2)throw new Error('Incomplete legacy save schema; refusing to hide old saves');
    const columns={nations_saves:['id','user_id','kind','name','turn','era','schema_version','revision','state_hash','size_bytes','r2_key','device_id','write_token','created_at','updated_at','deleted_at'],nations_save_versions:['save_id','user_id','revision','r2_key','state_hash','size_bytes','created_at']};
    let after='';
    while(true){
      const saves=await query(source,'SELECT * FROM nations_saves WHERE id>? ORDER BY id LIMIT 100',[after]);if(!saves.length)break;
      for(const save of saves){
        const existing=await query(target,'SELECT user_id,revision,state_hash FROM nations_saves WHERE id=?',[save.id]);
        if(existing.length&&existing[0].user_id!==save.user_id)throw new Error('Legacy save ownership mismatch');
        if(existing[0]?.revision>save.revision)continue;
        if(existing.length&&(existing[0].revision!==save.revision||existing[0].state_hash!==save.state_hash))throw new Error('Legacy save revision mismatch');
        if(!existing.length){const keys=columns.nations_saves;await query(target,`INSERT INTO nations_saves(${keys.join(',')}) VALUES(${keys.map(()=>'?').join(',')})`,keys.map(key=>save[key]??null));}
        // Resume safely if a previous deployment stopped between metadata and versions.
        for(const row of await query(source,'SELECT * FROM nations_save_versions WHERE save_id=?',[save.id])){
          if((await query(target,'SELECT revision FROM nations_save_versions WHERE save_id=? AND revision=?',[save.id,row.revision])).length)continue;
          const keys=columns.nations_save_versions;await query(target,`INSERT INTO nations_save_versions(${keys.join(',')}) VALUES(${keys.map(()=>'?').join(',')})`,keys.map(key=>row[key]??null));
        }
        imported++;
      }
      after=saves.at(-1).id;
    }
  }
  await query(target,'INSERT INTO nations_storage_migrations(name,created_at) VALUES(?,?)',[migration,Date.now()]);
  return{imported,alreadyDone:false};
}
