import { buildings, civs, improvements, techs, unitTypes } from './content';
import { canProduce, cityYields, distance, era, execute, hasTech, neighbors, passableLand, pathfind, predictBattle, projectView, settleWorld, tileAt, visible, type Command, type GameState, type Item, type Unit } from './core';

function legal(s:GameState,player:number,cmd:Command):GameState {const r=execute(s,player,cmd,false,true);return r.ok?r.state:s;}
// This planner receives only a player-specific projection, never the authoritative world.
export function planPlayer(view:GameState,player:number):Command[] {
  let s=view;const commands:Command[]=[];
  const act=(cmd:Command)=>{const next=legal(s,player,cmd);if(next!==s){commands.push(cmd);s=next;return true;}return false;};
  const p=s.players[player], personality=civs[p.civ].ai;
  if(!p.alive)return[{type:'END_TURN'}];
  for(const u of [...s.units.filter(u=>u.owner===player&&u.type==='settler')])act({type:'FOUND',unit:u.id});
  if(!p.research.length){const known=new Set(p.techs),queue:string[]=[];for(let i=0;i<3;i++){const available=Object.values(techs).filter(t=>!known.has(t.id)&&t.requires.every(id=>known.has(id)));available.sort((a,b)=>{const weight=(id:string)=>['steam','metallurgy','education','scientific_method','electronics','space','fusion','ai','deep_space'].includes(id)?(personality.science>.6?4:2):['mobilization','combustion','chemistry'].includes(id)?personality.aggression*4:1;return weight(b.id)-weight(a.id)||a.era-b.era;});if(available[0]){queue.push(available[0].id);known.add(available[0].id);}}if(queue.length)act({type:'RESEARCH',ids:queue});}
  const owned=s.cities.filter(c=>c.owner===player),troops=s.units.filter(u=>u.owner===player&&!unitTypes[u.type].civilian);
  const wars=Object.entries(p.relations).filter(([,r])=>r.war);
  // All evaluations here use visible units/cities; difficulty changes planning, not vision.
  if(!wars.length&&troops.length>=2&&s.turn>18){const enemy=s.cities.filter(c=>c.owner>=0&&c.owner!==player).sort((a,b)=>distance(tileAt(s,owned[0]?.tile||'')||tileAt(s,a.tile)!,tileAt(s,a.tile)!)-distance(tileAt(s,owned[0]?.tile||'')||tileAt(s,b.tile)!,tileAt(s,b.tile)!))[0];if(enemy&&personality.aggression>.45&&p.relations[enemy.owner]?.truce===0){const theirs=s.units.filter(u=>u.owner===enemy.owner&&!unitTypes[u.type].civilian);if(troops.length>theirs.length||s.turn>70)act({type:'DIPLOMACY',target:enemy.owner,action:'war'});}}
  for(const [other]of wars)if(p.fatigue>20)act({type:'DIPLOMACY',target:Number(other),action:'peace',gold:Math.max(0,Math.min(35,p.treasury))});
  for(const c of owned){if(c.queue.length)continue;const units=s.units.filter(u=>u.owner===player);let desired:[Item['kind'],string]|undefined;
    if(owned.length<Math.min(7,2+Math.floor(s.turn/20))&&!units.some(u=>u.type==='settler'))desired=['unit','settler'];
    else if(!units.some(u=>u.type==='engineer')||units.filter(u=>u.type==='engineer').length<Math.ceil(owned.length/2))desired=['unit','engineer'];
    else if(troops.length<owned.length+(wars.length?3:1)){const ids=['mechanized','tank','rifle','guard','infantry'];desired=['unit',ids.find(id=>canProduce(s,c,'unit',id))||'infantry'];}
    else {const project=['moon','station','colony'].find(id=>canProduce(s,c,'project',id));if(project)desired=['project',project];else {const priority=personality.science>.6?['workshop','granary','academy','university','national_lab','lab','data_center','fusion_plant','factory','bank','hospital','power','rail_hub','harbor','airport']:['workshop','granary','factory','bank','academy','university','arsenal','hospital','rail_hub','power','lab','data_center','harbor','airport'];const id=priority.find(id=>canProduce(s,c,'building',id));if(id)desired=['building',id];else desired=['unit',canProduce(s,c,'unit','artillery')?'artillery':'infantry'];}}
    if(desired&&!act({type:'PRODUCE',city:c.id,kind:desired[0],id:desired[1]})){const other=Object.values(buildings).find(b=>canProduce(s,c,'building',b.id));if(other)act({type:'PRODUCE',city:c.id,kind:'building',id:other.id});}
    if(p.treasury>200&&c.queue[0])act({type:'BUY',city:c.id});
  }
  for(const original of [...s.units.filter(u=>u.owner===player)]){
    const u=s.units.find(u=>u.id===original.id);if(!u||u.moves<=0)continue;const at=tileAt(s,u.tile)!;if(!at)continue;
    if(u.type==='engineer'){
      const target=s.tiles.filter(t=>t.owner===player&&passableLand(t)&&!t.city&&!t.improvement).sort((a,b)=>Number(!!b.resource)-Number(!!a.resource)||distance(a,at)-distance(b,at))[0];
      if(at.owner===player&&!at.city&&!at.improvement){const res=at.resource;const imp=res?(['coal','iron','wood','aluminium','uranium'].includes(res)?'mine':res==='oil'?'well':['wheat','cattle'].includes(res)?'farm':'plantation'):at.terrain==='hills'?'mine':'farm';if(act({type:'IMPROVE',unit:u.id,improvement:imp}))continue;}
      if(target){moveToward(s,u,target.id,act);continue;}
      if(at.owner===player&&!at.rail&&hasTech(p,'railway'))act({type:'IMPROVE',unit:u.id,improvement:'rail'});continue;
    }
    if(u.type==='settler'){
      const candidates=s.tiles.filter(t=>passableLand(t)&&t.terrain!=='marsh'&&(t.owner===undefined||t.owner===player)&&s.cities.every(c=>distance(t,tileAt(s,c.tile)!)>=3));candidates.sort((a,b)=>{const quality=(t:typeof a)=>neighbors(s,t).reduce((n,x)=>n+(x.resource?3:0)+(x.terrain==='grass'?2:0)+(x.terrain==='hills'?2:0),0)-distance(t,at)*1.4;return quality(b)-quality(a);});if(candidates[0])moveToward(s,u,candidates[0].id,act);continue;
    }
    const enemies=s.units.filter(e=>e.owner!==player&&(e.owner<0||p.relations[e.owner]?.war)).map(e=>e.tile).concat(s.cities.filter(c=>c.owner!==player&&(c.owner<0||p.relations[c.owner]?.war)).map(c=>c.tile));
    const hit=enemies.map(id=>({id,b:predictBattle(s,u,id)})).filter(x=>x.b).sort((a,b)=>b.b!.damage[0]-a.b!.damage[0])[0];if(hit&&act({type:'ATTACK',unit:u.id,target:hit.id}))continue;
    if(u.hp<40){act({type:'STATUS',unit:u.id,status:'fortify'});continue;}
    const enemy=enemies.map(id=>tileAt(s,id)!).filter(Boolean).sort((a,b)=>distance(a,at)-distance(b,at))[0];
    if(enemy){const approaches=neighbors(s,enemy).filter(passableLand).sort((a,b)=>distance(a,at)-distance(b,at));if(approaches.some(t=>moveToward(s,u,t.id,act)))continue;}
    // Explore boundaries of the known map, rather than selecting hidden world tiles.
    const candidates=s.tiles.filter(t=>passableLand(t)&&neighbors(s,t).length<6).sort((a,b)=>distance(a,at)-distance(b,at));if(!candidates.slice(0,s.config.difficulty==='casual'?4:12).some(t=>moveToward(s,u,t.id,act)))act({type:'STATUS',unit:u.id,status:'fortify'});
  }
  commands.push({type:'END_TURN'});return commands;
}
function moveToward(s:GameState,u:Unit,target:string,act:(c:Command)=>boolean):boolean {const route=pathfind(s,u,target);if(!route)return false;for(let i=route.path.length-1;i>=0;i--){const possible=pathfind(s,u,route.path[i],u.moves);if(possible)return act({type:'MOVE',unit:u.id,target:route.path[i]});}return false;}
export function runAiRound(initial:GameState,onProgress?:(player:number)=>void):GameState {let s=initial;for(let i=Math.max(1,s.currentPlayer);i<s.players.length;i++){s={...s,currentPlayer:i};if(s.players[i].alive){const view=projectView(s,i);for(const cmd of planPlayer(view,i)){const result=execute(s,i,cmd);if(result.ok)s=result.state;if(s.winner)break;}}onProgress?.(i);if(s.winner)break;}return s.winner?s:settleWorld(s);}
