import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {act,cleanup,fireEvent,render,renderHook,screen,waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import * as cinemaAccess from '../../cinema/src/access';
import * as comicAccess from '../../comic/src/access';
import {AccountControl as CinemaAccount,AccountNotice as CinemaNotice} from '../../cinema/src/account';
import {AccountControl as ComicAccount,AccountNotice as ComicNotice} from '../../comic/src/account';
import {useResource as useCinemaResource} from '../../cinema/src/useResource';
import {useResource as useComicResource} from '../../comic/src/useResource';
import CinemaPlayer from '../../cinema/src/Player';
import ComicPlayer from '../../comic/src/Player';

const sites=[
  {site:'cinema',kind:'title',access:cinemaAccess,Account:CinemaAccount,Notice:CinemaNotice,useResource:useCinemaResource},
  {site:'comic',kind:'anime',access:comicAccess,Account:ComicAccount,Notice:ComicNotice,useResource:useComicResource},
];
let saved:Map<string,Response>;
let cache:{match:ReturnType<typeof vi.fn>;put:ReturnType<typeof vi.fn>;keys:ReturnType<typeof vi.fn>;delete:ReturnType<typeof vi.fn>};
let open:ReturnType<typeof vi.fn>;
beforeEach(()=>{
  saved=new Map();
  cache={
    match:vi.fn(async(path:string)=>saved.get(path)?.clone()),
    put:vi.fn(async(path:string,response:Response)=>{saved.set(path,response.clone());}),
    keys:vi.fn(async()=>[...saved.keys()]),
    delete:vi.fn(async(path:string)=>saved.delete(path)),
  };
  open=vi.fn(async()=>cache);vi.stubGlobal('caches',{open});
  window.history.replaceState({},'','/');localStorage.clear();
});
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.restoreAllMocks();});
const metadata={data:{title:'保留目录'},meta:{checkedAt:'2026-10-21T00:00:00Z',stale:false,reason:'源站标记'}};

describe.each(sites)('$site account and content access',({site,kind,access,Account,Notice,useResource})=>{
  it('returns to the canonical current title/episode and rejects foreign or malformed return paths',()=>{
    const path='/watch/bf-875/1/0?at=30#player';
    expect(new URL(access.loginUrl(path)).searchParams.get('returnTo')).toBe(`https://${site}.yukino.bond${path}`);
    for(const path of ['//evil.example/x','https://evil.example/x','/\\evil.example','/\nredirect']){
      expect(new URL(access.loginUrl(path)).searchParams.get('returnTo')).toBe(`https://${site}.yukino.bond/`);
    }
  });

  it('keeps catalog metadata available offline with its original timestamp and marks the fallback',async()=>{
    const path='/api/catalog?q=星际';
    const fetcher=vi.fn().mockResolvedValueOnce(Response.json(metadata)).mockRejectedValueOnce(new TypeError('offline'));
    vi.stubGlobal('fetch',fetcher);
    expect(await access.request(path)).toEqual(metadata);
    const offline=await access.request<typeof metadata>(path);
    expect(offline.meta).toMatchObject({checkedAt:metadata.meta.checkedAt,stale:true,offline:true});
    expect(offline.data).toEqual(metadata.data);
    expect(fetcher).toHaveBeenCalledWith(path,expect.objectContaining({credentials:'same-origin',cache:'no-store'}));
  });

  it('does not store or fall back to cached playback, media, access status or explicit refresh results',async()=>{
    for(const path of [`/api/${kind}/bf-875/play?line=1&episode=0`,'/api/media?token=signed','/api/access','/api/catalog?refresh=1',`/api/${kind}/bf-875?refresh=1`]){
      saved.set(path,Response.json({data:{url:'old-protected-result'}}));
      vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(Response.json(metadata)).mockRejectedValueOnce(new TypeError('offline')));
      await access.request(path);
      await expect(access.request(path)).rejects.toMatchObject({status:0});
    }
    expect(open).not.toHaveBeenCalled();
  });

  it('surfaces 401 as a login prompt instead of using any stale response, preserving the current route',async()=>{
    const path=`/api/${kind}/bf-875/play?line=1&episode=0`,route='/watch/bf-875/1/0?at=30#player';
    saved.set(path,Response.json({data:{url:'old-protected-result'}}));
    render(<MemoryRouter initialEntries={[route]}><Notice/></MemoryRouter>);
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({error:'请先登录',code:'LOGIN_REQUIRED'},{status:401})));
    await act(async()=>{await expect(access.request(path)).rejects.toMatchObject({status:401,code:'LOGIN_REQUIRED'});});
    expect(screen.getByRole('alert')).toHaveTextContent('请先登录');
    expect(new URL(screen.getByRole('link',{name:'登录 Yukino'}).getAttribute('href')!).searchParams.get('returnTo')).toBe(`https://${site}.yukino.bond${route}`);
    expect(open).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button',{name:'关闭登录提示'}));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows a visible shared account control without caching identity data',async()=>{
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({user:{id:42,name:'已登录用户',role:'user'}})));
    const route=`/${kind}/bf-875?episode=第01集`;
    render(<MemoryRouter initialEntries={[route]}><Account/></MemoryRouter>);
    const link=await screen.findByRole('link',{name:/已登录用户/});
    expect(link).toHaveTextContent('已登录');
    expect(new URL(link.getAttribute('href')!).searchParams.get('returnTo')).toBe(`https://${site}.yukino.bond${new URL(route,'https://local.example').pathname}${new URL(route,'https://local.example').search}`);
    expect(open).not.toHaveBeenCalled();
  });

  it('uses explicit refresh only for one manual action and preserves public data after its login denial',async()=>{
    const first='/api/catalog?q=first',next=`/api/${kind}/bf-875`;
    const fetcher=vi.fn(async(input:string)=>input.includes('refresh=1')?Response.json({error:'请先登录',code:'LOGIN_REQUIRED'},{status:401}):Response.json(metadata));
    vi.stubGlobal('fetch',fetcher);
    const {result,rerender}=renderHook(({path})=>useResource<typeof metadata>(path),{initialProps:{path:first}});
    await waitFor(()=>expect(result.current.data).toEqual(metadata));
    act(()=>result.current.reload());
    await waitFor(()=>expect(result.current.loginRequired).toBe(true));
    expect(result.current.data).toEqual(metadata);
    expect(result.current.error).toBeUndefined();
    expect(fetcher).toHaveBeenCalledWith(first+'&refresh=1',expect.anything());
    rerender({path:next});
    await waitFor(()=>expect(result.current.key).toBe(next));
    await waitFor(()=>expect(result.current.loading).toBe(false));
    expect(fetcher).toHaveBeenLastCalledWith(next,expect.anything());
    expect(fetcher.mock.calls.filter(([path])=>path.includes('refresh=1'))).toHaveLength(1);
    expect(result.current.loginRequired).toBeFalsy();
  });

  it('shows a direct sign-in action when the player receives 401 and retains the current episode',async()=>{
    vi.spyOn(HTMLMediaElement.prototype,'load').mockImplementation(()=>{});
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({error:'登录后即可播放',code:'LOGIN_REQUIRED'},{status:401})));
    const route='/watch/bf-875/1/0?at=30';window.history.replaceState({},'',route);
    const line={id:'1',name:'线路',episodes:[{id:'0',title:'第01集',kind:'hls' as const}]},episode=line.episodes[0];
    const props={line,episode,start:30,settings:{theme:'light' as const,rate:1,autonext:true,skipIntro:0,volume:.8},onEnded:vi.fn(),onTime:vi.fn(),onReady:vi.fn()};
    const detail={id:'bf-875',source:'bf',sourceName:'暴风',title:'测试作品',aliases:'',cover:'/api/cover/bf-875',category:'测试',year:'2026',area:'中国',language:'国语',tags:[],remark:'第01集',completed:false,updatedAt:null,score:null,episodeCount:1,description:'',actors:'',director:'',lines:[line]};
    render(site==='cinema'?<CinemaPlayer {...props} media={{...detail,mediaKind:'series'}}/>:<ComicPlayer {...props} anime={detail}/>);
    const link=await screen.findByRole('link',{name:'登录 Yukino，继续观看'});
    expect(new URL(link.getAttribute('href')!).searchParams.get('returnTo')).toBe(`https://${site}.yukino.bond${route}`);
    expect(screen.queryByRole('button',{name:'重新连接'})).toBeNull();
  });
});
