import type {GameState} from './core';

// Store repeated field names once. Every value and command is retained; this is
// a storage format, independent of the simulation's schemaVersion.
type Table={columns:string[];rows:unknown[][]};
function pack(records:Record<string,any>[]):Table|Record<string,any>[]{
  const columns=[...new Set(records.flatMap(Object.keys))];
  if(columns.length>30)return records;
  return{columns,rows:records.map(record=>{let mask=0;const values:unknown[]=[];columns.forEach((key,i)=>{if(record[key]!==undefined){mask+=2**i;values.push(record[key]);}});return[mask,...values];})};
}
function unpack(value:any,limit:number):Record<string,any>[]{
  if(Array.isArray(value)){if(value.length>limit)throw new Error('save.invalid|table');return value;}
  if(!value||!Array.isArray(value.columns)||value.columns.length>30||new Set(value.columns).size!==value.columns.length||!value.columns.every((key:unknown)=>typeof key==='string')||!Array.isArray(value.rows)||value.rows.length>limit)throw new Error('save.invalid|table');
  return value.rows.map((row:unknown[])=>{
    if(!Array.isArray(row)||!Number.isInteger(row[0])||Number(row[0])<0||Number(row[0])>=2**value.columns.length)throw new Error('save.invalid|row');
    let offset=1;const entries:[string,unknown][]=[];
    value.columns.forEach((key:string,i:number)=>{if(Math.floor(Number(row[0])/2**i)%2)entries.push([key,row[offset++]]);});
    if(offset!==row.length)throw new Error('save.invalid|row');
    return Object.fromEntries(entries);
  });
}
export function serializeSave(state:GameState):string{
  const indices=new Map(state.tiles.map((tile,i)=>[tile.id,i]));
  const packed={...state,
    tiles:pack(state.tiles.map(({id,...tile})=>tile)),
    units:pack(state.units),cities:pack(state.cities),logs:pack(state.logs),commands:pack(state.commands),
    players:state.players.map(player=>({...player,explored:player.explored.map(id=>indices.get(id)),memory:Object.entries(player.memory).map(([id,memory])=>[indices.get(id),memory])}))};
  return JSON.stringify({saveFormat:'nations-packed',version:1,state:packed});
}
export function deserializeSave(value:any):unknown{
  if(value?.saveFormat!=='nations-packed')return value; // Original JSON and gzip saves.
  if(value.version!==1)throw new Error('save.newer');
  const state=value.state;
  if(!state||!Array.isArray(state.players)||state.players.length>7)throw new Error('save.invalid|players');
  const tiles=unpack(state.tiles,3840).map(tile=>({...tile,id:`${tile.q},${tile.r}`}));
  const tileId=(index:unknown)=>{if(!Number.isInteger(index)||!tiles[Number(index)])throw new Error('save.invalid|vision');return tiles[Number(index)].id;};
  return{...state,tiles,units:unpack(state.units,2000),cities:unpack(state.cities,500),logs:unpack(state.logs,500),commands:unpack(state.commands,100000),players:state.players.map((player:any)=>{
    if(!Array.isArray(player.explored)||!Array.isArray(player.memory)||player.explored.length>3840||player.memory.length>3840)throw new Error('save.invalid|vision');
    return{...player,explored:player.explored.map(tileId),memory:Object.fromEntries(player.memory.map((entry:any)=>{if(!Array.isArray(entry)||entry.length!==2)throw new Error('save.invalid|memory');return[tileId(entry[0]),entry[1]];}))};
  })};
}
