import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {categories,clock,kindNames,watchPath} from '../../cinema/src/api';
import type {Media} from '../../cinema/src/api';
import {cleanMedia,exportLibrary,getLibrary,importLibrary,saveProgress,toggleFavorite,updateSettings} from '../../cinema/src/library';

const media:Media={id:'bf-800',mediaKind:'movie',source:'bf',sourceName:'暴风',title:'测试电影',aliases:'',cover:'/api/cover/bf-800',category:'剧情片',year:'2026',area:'中国',language:'国语',tags:[],remark:'正片',completed:true,updatedAt:null,score:null,episodeCount:1};
const defaults={theme:'light',rate:1,autonext:true,skipIntro:0,volume:.8};
const progress=(seconds:number,savedAt:number,item:Media=media)=>({media:item,lineId:'1',episodeId:'0',episodeTitle:'正片',seconds,duration:7200,savedAt});
const backup=(history:unknown[]=[],favorites:unknown[]=[])=>JSON.stringify({app:'yukino-cinema',version:1,favorites,history});

beforeEach(()=>{
  localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-19T08:00:00Z'));
  localStorage.setItem('yukino:cinema:v1',JSON.stringify({version:1,favorites:[],history:[],settings:defaults}));
});
afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks();});

describe('cinema library and progress',()=>{
  it('merges backups without replacing a newer local resume position',()=>{
    saveProgress(progress(120,200));
    toggleFavorite(media);
    importLibrary(backup([progress(30,100)]));
    expect(getLibrary().history).toHaveLength(1);
    expect(getLibrary().history[0]).toMatchObject({seconds:120,savedAt:200});
    expect(getLibrary().favorites).toHaveLength(1);
    toggleFavorite(media);
    expect(getLibrary().favorites).toHaveLength(0);
    expect(getLibrary().history).toHaveLength(1);
  });

  it('accepts a newer imported resume position and keeps duplicate imports idempotent',()=>{
    saveProgress(progress(30,100));
    const data=backup([progress(120,200)],[{media,savedAt:200}]);
    importLibrary(data);
    importLibrary(data);
    expect(getLibrary().history).toHaveLength(1);
    expect(getLibrary().history[0]).toMatchObject({seconds:120,savedAt:200});
    expect(getLibrary().favorites).toHaveLength(1);
  });

  it('keeps the same numeric title ID from independent sources separate',()=>{
    const other:Media={...media,id:'ff-800',source:'ff',sourceName:'非凡'};
    toggleFavorite(media);
    toggleFavorite(other);
    saveProgress(progress(120,100));
    saveProgress({...progress(60,200,other),lineId:'2',episodeId:'3'});
    expect(getLibrary().favorites.map(f=>f.media.id)).toEqual(expect.arrayContaining(['bf-800','ff-800']));
    expect(getLibrary().history).toHaveLength(2);
    expect(getLibrary().history.find(p=>p.media.id==='bf-800')).toMatchObject({lineId:'1',episodeId:'0',seconds:120});
    expect(getLibrary().history.find(p=>p.media.id==='ff-800')).toMatchObject({lineId:'2',episodeId:'3',seconds:60});
  });

  it('rejects invalid IDs and kinds, restores safe cover URLs, and derives the source from the ID',()=>{
    for(const id of ['https://localhost/x','../bf-800','bf-0','unknown-800','bf-1234567890'])expect(cleanMedia({...media,id})).toBeNull();
    for(const mediaKind of ['anime','comic','',null])expect(cleanMedia({...media,mediaKind})).toBeNull();
    expect(cleanMedia({...media,title:'  '})).toBeNull();
    expect(cleanMedia({...media,cover:'https://evil.example/a',source:'ff'})).toMatchObject({cover:'/api/cover/bf-800',source:'bf'});
    for(const mediaKind of ['movie','series','variety','doc'])expect(cleanMedia({...media,mediaKind})?.mediaKind).toBe(mediaKind);
  });

  it('rejects another application backup without altering the current library',()=>{
    saveProgress(progress(120,200));
    const current=localStorage.getItem('yukino:cinema:v1');
    for(const app of ['yukino-comic','yukino-novel',undefined])expect(()=>importLibrary(JSON.stringify({app,version:1,favorites:[],history:[]}))).toThrow('格式');
    expect(()=>importLibrary('{wrong')).toThrow('JSON');
    expect(()=>importLibrary(JSON.stringify({app:'yukino-cinema',version:2,favorites:[],history:[]}))).toThrow('格式');
    expect(localStorage.getItem('yukino:cinema:v1')).toBe(current);
  });

  it('bounds playback preferences and retains supported values',()=>{
    updateSettings({rate:800,skipIntro:1000,volume:-10});
    expect(getLibrary().settings).toEqual({...defaults,skipIntro:180,volume:0});
    updateSettings({rate:1.5,skipIntro:-30,volume:10,theme:'dark',autonext:false});
    expect(getLibrary().settings).toEqual({theme:'dark',rate:1.5,autonext:false,skipIntro:0,volume:1});
    updateSettings({rate:Number.NaN,skipIntro:Number.POSITIVE_INFINITY,volume:Number.NaN});
    expect(getLibrary().settings).toMatchObject({rate:1,skipIntro:0,volume:.8});
  });

  it('clamps corrupt playback times and timestamps and drops unsafe episode links',()=>{
    const now=Date.now();
    importLibrary(backup([
      {...progress(9000,now+86400000),duration:7200},
      {...progress(-30,-100,{...media,id:'ff-800',source:'ff'}),duration:-1},
      {...progress(50,200,{...media,id:'lz-800',source:'lz'}),lineId:'../play'},
      {...progress(50,200,{...media,id:'ikun-800',source:'ikun'}),episodeId:'https://evil.example'},
    ]));
    expect(getLibrary().history).toHaveLength(2);
    expect(getLibrary().history.find(p=>p.media.id==='bf-800')).toMatchObject({seconds:7200,duration:7200,savedAt:now+60000});
    expect(getLibrary().history.find(p=>p.media.id==='ff-800')).toMatchObject({seconds:0,duration:0,savedAt:0});
    saveProgress({...progress(Number.NaN,now),duration:Number.POSITIVE_INFINITY});
    expect(getLibrary().history.find(p=>p.media.id==='bf-800')).toMatchObject({seconds:0,duration:0});
  });

  it('exports an identifiable cinema backup with media fields and can restore it',()=>{
    toggleFavorite(media);
    saveProgress(progress(120,200));
    const exported=exportLibrary(),parsed=JSON.parse(exported);
    expect(parsed).toMatchObject({app:'yukino-cinema',version:1,exportedAt:'2026-10-19T08:00:00.000Z'});
    expect(parsed.favorites[0].media).toMatchObject({id:'bf-800',mediaKind:'movie'});
    expect(parsed.history[0]).toMatchObject({media:{id:'bf-800'},seconds:120});
    localStorage.clear();
    expect(importLibrary(exported)).toEqual({favorites:1,history:1});
    expect(getLibrary().history[0].seconds).toBe(120);
    expect(localStorage.getItem('yukino:comic:v1')).toBeNull();
  });
});

describe('cinema navigation and display helpers',()=>{
  it('provides the four cinema categories and preserves long movie playback times',()=>{
    expect(categories.map(([id])=>id)).toEqual(['all','movie','series','variety','doc']);
    expect(kindNames).toEqual({movie:'电影',series:'电视剧',variety:'综艺',doc:'纪录片'});
    expect(clock(7384.9)).toBe('2:03:04');
    expect(clock(Number.NaN)).toBe('00:00');
    expect(clock(-1)).toBe('00:00');
    expect(watchPath('bf-800','1','0')).toBe('/watch/bf-800/1/0');
    expect(watchPath('bf-800/other','1?at=4','0#play')).toBe('/watch/bf-800%2Fother/1%3Fat%3D4/0%23play');
  });
});
