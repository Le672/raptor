import { createReaderWorker } from '../../shared/reader-worker.mjs';
import * as service from './service.mjs';
import { bookIdValid as lightId,sourceInfo as lightSource } from '../../novel/shared/sources.mjs';
async function beforeFetch(request,env){
  const url=new URL(request.url),legacy=url.pathname.match(/^\/(?:book|read)\/([^/]+)/);
  if(legacy&&lightId(legacy[1])||url.pathname==='/'&&lightSource(url.searchParams.get('source'))){return Response.redirect('https://ln.yukino.bond'+url.pathname+url.search,307);}
  if(url.pathname==='/migration/export'){
    let response=await env.ASSETS.fetch(new Request(new URL('/migration-export',url),request));
    if(response.status===404)response=await env.ASSETS.fetch(new Request(new URL('/migration-export.html',url),request));
    const headers=new Headers(response.headers);
    headers.set('Cache-Control','no-store');headers.set('Content-Security-Policy',"default-src 'none'; script-src 'self'; frame-ancestors https://ln.yukino.bond; base-uri 'none'");headers.set('Referrer-Policy','no-referrer');headers.delete('X-Frame-Options');
    return new Response(response.body,{status:response.status,headers});
  }
}
export default createReaderWorker({site:'novel',origin:'https://novel.yukino.bond',...service,beforeFetch});
