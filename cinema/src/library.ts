import {useEffect,useState} from 'react';
import type {Media} from './api';
export type Favorite={media:Media;savedAt:number};
export type Progress={media:Media;lineId:string;episodeId:string;episodeTitle:string;seconds:number;duration:number;savedAt:number};
export type Settings={theme:'light'|'dark';rate:number;autonext:boolean;skipIntro:number;volume:number};
export type Library={version:1;favorites:Favorite[];history:Progress[];settings:Settings};
const defaults:Settings={theme:'light',rate:1,autonext:true,skipIntro:0,volume:.8};
let memory:Library={version:1,favorites:[],history:[],settings:defaults},failed=false;
const validId=(v:unknown):v is string=>typeof v==='string'&&/^(bf|ff|lz|ikun)-[1-9]\d{0,8}$/.test(v);
const clamp=(v:unknown,min:number,max:number,fallback:number)=>typeof v==='number'&&Number.isFinite(v)?Math.max(min,Math.min(max,v)):fallback;
export function cleanMedia(v:unknown):Media|null{
  if(!v||typeof v!=='object')return null;const x=v as Record<string,unknown>;
  if(!validId(x.id)||typeof x.title!=='string'||!x.title.trim()||!['movie','series','variety','doc'].includes(String(x.mediaKind)))return null;
  const text=(key:string,max=200)=>typeof x[key]==='string'?(x[key] as string).slice(0,max):'';
  return {id:x.id,mediaKind:x.mediaKind as Media['mediaKind'],source:x.id.split('-')[0],sourceName:text('sourceName',20),title:text('title'),aliases:text('aliases'),cover:'/api/cover/'+x.id,category:text('category',40),year:text('year',10),area:text('area',40),language:text('language',40),tags:Array.isArray(x.tags)?x.tags.filter((t):t is string=>typeof t==='string').slice(0,10).map(t=>t.slice(0,40)):[],remark:text('remark',100),completed:x.completed===true,updatedAt:typeof x.updatedAt==='string'&&Number.isFinite(Date.parse(x.updatedAt))?x.updatedAt:null,score:typeof x.score==='number'?clamp(x.score,0,10,0):null,episodeCount:clamp(x.episodeCount,0,5000,0)};
}
function sanitize(v:unknown):Library{
  const x=(v&&typeof v==='object'?v:{}) as Partial<Library>;
  const favorites=(Array.isArray(x.favorites)?x.favorites:[]).slice(0,1000).flatMap(f=>{const media=cleanMedia(f?.media);return media?[{media,savedAt:clamp(f.savedAt,0,Date.now()+60000,Date.now())}]:[];});
  const history=(Array.isArray(x.history)?x.history:[]).slice(0,1000).flatMap(p=>{
    const media=cleanMedia(p?.media);if(!media||!/^\d{1,5}$/.test(p.lineId)||!/^\d{1,5}$/.test(p.episodeId)||typeof p.episodeTitle!=='string')return [];
    const duration=clamp(p.duration,0,86400,0);return [{media,lineId:p.lineId,episodeId:p.episodeId,episodeTitle:p.episodeTitle.slice(0,100),seconds:clamp(p.seconds,0,duration||86400,0),duration,savedAt:clamp(p.savedAt,0,Date.now()+60000,Date.now())}];
  });
  const s=x.settings||defaults;
  return {version:1,favorites:dedupe(favorites),history:dedupe(history),settings:{theme:s.theme==='dark'?'dark':'light',rate:[.5,.75,1,1.25,1.5,1.75,2].includes(s.rate)?s.rate:1,autonext:typeof s.autonext==='boolean'?s.autonext:true,skipIntro:clamp(s.skipIntro,0,180,0),volume:clamp(s.volume,0,1,.8)}};
}
function dedupe<T extends {media:Media;savedAt:number}>(items:T[]):T[]{const map=new Map<string,T>();for(const item of items)if(!map.has(item.media.id)||map.get(item.media.id)!.savedAt<item.savedAt)map.set(item.media.id,item);return [...map.values()].sort((a,b)=>b.savedAt-a.savedAt);}
export function getLibrary():Library{try{const value=localStorage.getItem('yukino:cinema:v1');memory=value?sanitize(JSON.parse(value)):{version:1,favorites:[],history:[],settings:{...defaults}};}catch{failed=true;}return memory;}
function save(value:Library){memory=value;try{localStorage.setItem('yukino:cinema:v1',JSON.stringify(value));failed=false;}catch{failed=true;}window.dispatchEvent(new Event('cinema-library'));}
export function storageFailed(){return failed;}
export function toggleFavorite(media:Media){const value=getLibrary(),safe=cleanMedia(media);if(!safe)return;save({...value,favorites:value.favorites.some(f=>f.media.id===safe.id)?value.favorites.filter(f=>f.media.id!==safe.id):[{media:safe,savedAt:Date.now()},...value.favorites].slice(0,1000)});}
export function saveProgress(progress:Progress){const value=getLibrary(),safe=sanitize({...value,history:[progress]}).history[0];if(!safe)return;save({...value,history:[safe,...value.history.filter(p=>p.media.id!==safe.media.id)].slice(0,500)});}
export function removeHistory(id:string){const value=getLibrary();save({...value,history:value.history.filter(p=>p.media.id!==id)});}
export function updateSettings(patch:Partial<Settings>){const value=getLibrary();save({...value,settings:sanitize({...value,settings:{...value.settings,...patch}}).settings});}
export function exportLibrary(){return JSON.stringify({...getLibrary(),app:'yukino-cinema',exportedAt:new Date().toISOString()},null,2);}
export function importLibrary(text:string){if(text.length>3*1024*1024)throw new Error('备份超过 3 MB');let raw;try{raw=JSON.parse(text);}catch{throw new Error('不是有效的 JSON 备份');}if(raw?.app!=='yukino-cinema'||raw?.version!==1||!Array.isArray(raw.favorites)||!Array.isArray(raw.history))throw new Error('备份格式不正确');const imported=sanitize(raw),old=getLibrary();save({...old,favorites:dedupe([...old.favorites,...imported.favorites]),history:dedupe([...old.history,...imported.history])});return {favorites:imported.favorites.length,history:imported.history.length};}
export function useLibrary(){const[value,setValue]=useState(getLibrary);useEffect(()=>{const changed=()=>setValue({...getLibrary()});window.addEventListener('cinema-library',changed);window.addEventListener('storage',changed);return()=>{window.removeEventListener('cinema-library',changed);window.removeEventListener('storage',changed);};},[]);return value;}
