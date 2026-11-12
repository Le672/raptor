export function withoutGameStorage(config){
  let removed=0;
  const result=config.split(/(?=^\[)/m).map(section=>{
    if(!section.startsWith('[[r2_buckets]]')||!/^binding\s*=\s*"GAMES_SAVES"\s*$/m.test(section))return section;
    removed++;
    return section.split(/\r?\n/).filter(line=>!line.trim()||line.trim().startsWith('#')).join('\n');
  }).join('');
  if(removed!==1)throw new Error('Expected exactly one optional GAMES_SAVES binding');
  return result;
}

export async function ensureGameStorage({token,account,allowUnavailable=false,fetcher=fetch}){
  if(!token||!account)throw new Error('Cloudflare deployment credentials are required');
  const endpoint=`https://api.cloudflare.com/client/v4/accounts/${account}/r2/buckets`;
  const headers={Authorization:`Bearer ${token}`,'Content-Type':'application/json'};
  async function request(url,options={}){
    const response=await fetcher(url,{...options,headers,signal:AbortSignal.timeout(20000)});
    const data=await response.json().catch(()=>({}));return{response,data};
  }
  function failure(action,{response,data}){
    const codes=(data.errors??[]).map(error=>Number(error.code)).filter(Number.isFinite);
    // Only this explicit account-not-activated response permits a local-only release.
    // Permission errors, network failures and malformed responses still fail deployment.
    if(allowUnavailable&&codes.includes(10042))return{ready:false,reason:'R2_NOT_ENABLED'};
    const reason=codes.includes(10042)?'R2 is not enabled for this account. Complete the R2 activation in the Cloudflare dashboard before retrying.':'Check that the deployment token has Account > Workers R2 Storage > Edit for the deployment account and that R2 is enabled.';
    throw new Error(`Cannot ${action} private game storage (HTTP ${response.status}; Cloudflare codes: ${codes.join(', ')||'unavailable'}). ${reason}`);
  }
  const existing=await request(endpoint+'/yukino-games-saves');
  if(existing.response.ok&&existing.data.success)return{ready:true,created:false};
  const missing=existing.response.status===404||existing.data.errors?.some(error=>Number(error.code)===10006);
  if(!missing)return failure('inspect',existing);
  const created=await request(endpoint,{method:'POST',body:JSON.stringify({name:'yukino-games-saves'})});
  if(!created.response.ok||!created.data.success)return failure('create',created);
  return{ready:true,created:true};
}
