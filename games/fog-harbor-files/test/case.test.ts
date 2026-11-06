import {describe,it,expect} from 'vitest';
import {evidence,persons,statements,deductions,locations,timeline,chapters} from '../src/content';
import {initialState,apply,evidenceOpen,canProve,decodeState,REPORT_QUESTIONS,type GameState} from '../src/engine';
function collectAvailable(s:GameState){for(let pass=0;pass<40;pass++){let changed=false;for(const e of evidence)if(!s.collected.includes(e.id)&&evidenceOpen(s,e.id)){const r=apply(s,{type:'collect',id:e.id});expect(r.ok,e.id).toBe(true);s=r.state;changed=true;}if(!changed)return s;}throw new Error('Evidence dependency cycle');}
function solveAvailable(s:GameState,old=true){for(let pass=0;pass<12;pass++){let changed=false;for(const d of deductions)if((old||!['D07','D08'].includes(d.id))&&!s.solved.includes(d.id)&&canProve(s,d.id)){const r=apply(s,{type:'deduce',id:d.id,option:d.options.find(o=>o.correct)!.id,supports:s.collected});expect(r.ok,d.id+': '+r.message).toBe(true);s=r.state;changed=true;}if(!changed)return s;}throw new Error('Deduction dependency cycle');}
function finish(old=true,reverse=false){let s=initialState('case-test-001',1);for(let i=0;i<5;i++){if(reverse){for(let pass=0;pass<32;pass++)for(const e of [...evidence].reverse())if(evidenceOpen(s,e.id))s=apply(s,{type:'collect',id:e.id}).state;}else s=collectAvailable(s);s=solveAvailable(s,old);if(s.chapter<5){const r=apply(s,{type:'advance'});expect(r.ok,r.message).toBe(true);s=r.state;}}return s;}
const answers=Object.fromEntries(REPORT_QUESTIONS.map(q=>[q.id,q.correct]));
describe('authored case integrity',()=>{
 it('contains substantive documents and complete linked content, without dangling IDs',()=>{
  expect(evidence).toHaveLength(32);expect(statements).toHaveLength(24);expect(deductions).toHaveLength(8);expect(locations).toHaveLength(7);expect(persons).toHaveLength(6);expect(chapters).toHaveLength(5);
  const ids=new Set(evidence.map(e=>e.id));expect(ids.size).toBe(32);const dIds=new Set(deductions.map(d=>d.id)),sIds=new Set(statements.map(s=>s.id));
  expect(evidence.every(e=>e.body.length>1)).toBe(true);
  for(const e of evidence){expect(e.body.join('').length,e.id).toBeGreaterThan(80);for(const id of e.requires||[])expect(ids.has(id),e.id+' dependency '+id).toBe(true);}
  const hotIds=locations.flatMap(l=>l.hotspots.flatMap(h=>h.evidence));expect(new Set(hotIds)).toEqual(ids);for(const id of hotIds)expect(ids.has(id)).toBe(true);
  for(const d of deductions){expect(d.options.filter(o=>o.correct),d.id).toHaveLength(1);expect(d.requiredSets.length).toBeGreaterThan(0);for(const set of d.requiredSets)for(const id of set)expect(ids.has(id),d.id+' evidence '+id).toBe(true);for(const id of d.prerequisites)expect(dIds.has(id)).toBe(true);expect(d.hints).toHaveLength(3);}
  const heard=new Set(persons.flatMap(p=>p.topics.flatMap(t=>t.statement?[t.statement]:[])));expect(heard).toEqual(sIds);for(const p of persons)for(const t of p.topics){for(const id of [...t.requires||[],...t.evidence||[]])expect(ids.has(id)).toBe(true);}
  for(const event of timeline)for(const id of event.requires)expect(ids.has(id)||dIds.has(id)).toBe(true);
 });
 it('reaches every evidence and both formal results without confessions or optional letters',()=>{
  for(const reverse of [false,true]){const s=finish(true,reverse);expect(new Set(s.collected).size).toBe(32);expect(new Set(s.solved).size).toBe(8);const full=apply(s,{type:'report',answers,supports:s.collected.filter(id=>!['E31','E32'].includes(id))});expect(full.ok,full.message).toBe(true);expect(full.ending).toBe('full');}
  const s=finish(false);expect(s.solved).not.toContain('D07');const current=apply(s,{type:'report',answers,supports:s.collected.filter(id=>!['E25','E26','E27','E28','E29','E30'].includes(id))});expect(current.ok,current.message).toBe(true);expect(current.ending).toBe('current');
 });
 it('requires evidence, rejects unsupported guesses, and preserves state after failed commands',()=>{
  const s=initialState('case-test-002',1),d=deductions[0];const guessed=apply(s,{type:'deduce',id:d.id,option:d.options.find(o=>o.correct)!.id,supports:[]});expect(guessed.ok).toBe(false);expect(guessed.state).toBe(s);expect(apply(s,{type:'advance'}).ok).toBe(false);expect(apply(s,{type:'collect',id:'E22'}).ok).toBe(false);
  const finished=finish();for(const culprit of ['xu','shen','luo','tang','he']){const r=apply(finished,{type:'report',answers:{...answers,culprit},supports:finished.collected});expect(r.ok).toBe(false);expect(r.state.endings).toEqual([]);}
  const noProof=apply({...finished,solved:[]},{type:'report',answers,supports:['E06']});expect(noProof.ok).toBe(false);
 });
 it('does not confuse hearing a voice with proving live speech or card ownership with bearer identity',()=>{
  const s={...finish(),solved:[]};expect(canProve(s,'D01',['E06'])).toBe(false);expect(canProve(s,'D03',['E09'])).toBe(false);expect(canProve(s,'D06',['E18'])).toBe(false);
  const d=deductions.find(d=>d.id==='D01')!;expect(apply(s,{type:'deduce',id:d.id,option:d.options.find(o=>o.correct)!.id,supports:d.requiredSets[0]}).ok).toBe(true);
 });
 it('keeps investigation commands idempotent and survives save JSON round trips',()=>{
  const s=finish(),once=apply(s,{type:'collect',id:'E01'});expect(once.state).toBe(s);expect(decodeState(JSON.parse(JSON.stringify(s)))).toEqual(s);
  for(const bad of [null,{}, {...s,contentVersion:'future'}, {...s,collected:['E99']},{...s,chapter:7},{...s,settings:{...s.settings,fontSize:99}}])expect(()=>decodeState(bad)).toThrow();
 });
 it('provides full truth using collected evidence even without clicking every intermediate deduction',()=>{
  const s={...finish(),solved:[]};const r=apply(s,{type:'report',answers,supports:s.collected});expect(r.ok,r.message).toBe(true);expect(r.ending).toBe('full');
 });
 it('allows all testimony and challenges to be reached without using an uncollected card',()=>{
  let s=finish();for(const p of persons)for(const t of p.topics)s=apply(s,{type:'topic',person:p.id,id:t.id}).state;expect(new Set(s.heard).size).toBe(24);for(const st of statements)if(st.challengeEvidence.length){const r=apply(s,{type:'challenge',id:st.id,supports:[st.challengeEvidence[0]]});expect(r.ok,st.id).toBe(true);s=r.state;}expect(s.challenged.length).toBeGreaterThan(10);
 });
});
