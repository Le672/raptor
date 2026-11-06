const token=process.env.CLOUDFLARE_API_TOKEN,account=process.env.CLOUDFLARE_ACCOUNT_ID;
if(!token||!account)throw new Error('Cloudflare deployment credentials are required');
const endpoint=`https://api.cloudflare.com/client/v4/accounts/${account}/r2/buckets`;
const headers={Authorization:`Bearer ${token}`,'Content-Type':'application/json'};
const existing=await fetch(endpoint+'/yukino-games-saves',{headers});
if(existing.ok){console.log('Private game save bucket is already configured.');}
else{const status=await existing.json();const missing=existing.status===404||status.errors?.some(e=>e.code===10006||e.code===10007);
  if(!missing)throw new Error(`Cannot inspect R2 storage (HTTP ${existing.status}); the deployment token needs R2 read/write and R2 must be enabled.`);
  const created=await fetch(endpoint,{method:'POST',headers,body:JSON.stringify({name:'yukino-games-saves'})});const data=await created.json();if(!created.ok||!data.success)throw new Error(`Cannot create private game storage (HTTP ${created.status}); enable R2 or grant the deployment token R2 read/write. No public bucket endpoint is needed.`);
  console.log('Created private game save storage.');
}
