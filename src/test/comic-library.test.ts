import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {cleanAnime,exportLibrary,getLibrary,importLibrary,saveProgress,toggleFavorite,updateSettings} from '../../comic/src/library';
import type {Anime} from '../../comic/src/api';
const anime:Anime={id:'bf-800',source:'bf',sourceName:'暴风',title:'测试动漫',aliases:'',cover:'/api/cover/bf-800',category:'日韩动漫',year:'2026',area:'日本',language:'日语',tags:[],remark:'第 2 集',completed:false,updatedAt:null,score:null,episodeCount:2};
beforeEach(()=>{localStorage.clear();localStorage.setItem('yukino:comic:v1',JSON.stringify({version:1,favorites:[],history:[],settings:{theme:'light',rate:1,autonext:true,skipIntro:0,volume:.8}}));});
afterEach(()=>vi.restoreAllMocks());
describe('anime library and progress',()=>{
  it('preserves newer resume positions when importing a backup and keeps favorites separate',()=>{
    saveProgress({anime,lineId:'1',episodeId:'0',episodeTitle:'第01集',seconds:120,duration:1400,savedAt:200});toggleFavorite(anime);
    importLibrary(JSON.stringify({version:1,favorites:[],history:[{anime,lineId:'1',episodeId:'0',episodeTitle:'第01集',seconds:30,duration:1400,savedAt:100}]}));
    expect(getLibrary().history[0].seconds).toBe(120);toggleFavorite(anime);expect(getLibrary().favorites).toHaveLength(0);expect(getLibrary().history).toHaveLength(1);
    const exported=JSON.parse(exportLibrary());expect(exported.history[0].seconds).toBe(120);
  });
  it('validates imported IDs and links, clamps corrupted settings and keeps providers independent',()=>{
    expect(cleanAnime({...anime,id:'https://localhost/x'})).toBeNull();expect(cleanAnime({...anime,cover:'https://evil.example/a'})).toMatchObject({cover:'/api/cover/bf-800'});
    toggleFavorite(anime);toggleFavorite({...anime,id:'ff-800',source:'ff'});expect(getLibrary().favorites).toHaveLength(2);
    updateSettings({rate:800,skipIntro:1000,volume:-10});expect(getLibrary().settings).toMatchObject({rate:1,skipIntro:180,volume:0});
    expect(()=>importLibrary('{wrong')).toThrow('JSON');expect(()=>importLibrary('{"version":2}')).toThrow('格式');
  });
  it('limits resumed positions to the video duration and does not corrupt other episodes',()=>{
    saveProgress({anime,lineId:'1',episodeId:'0',episodeTitle:'第一集',seconds:1500,duration:1400,savedAt:100});
    expect(getLibrary().history[0].seconds).toBe(1400);
    saveProgress({anime:{...anime,id:'ff-800'},lineId:'0',episodeId:'1',episodeTitle:'第二集',seconds:5,duration:1400,savedAt:200});
    expect(getLibrary().history.find(x=>x.anime.id==='bf-800')?.episodeId).toBe('0');expect(getLibrary().history).toHaveLength(2);
  });
});
