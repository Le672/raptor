import {describe,it,expect} from 'vitest';
import {canonicalPageUrl} from '../lib/site-routing';
import {safeAuthReturn} from '../lib/auth-return';
import {onRequest} from '../../functions/_middleware';
describe('Fog Harbor Files independent game path',()=>{
 it('keeps its own game path, preserves search/fragments and leaves static assets alone',()=>{
  const target='https://games.yukino.bond/fog-harbor-files/?from=games#case';for(const url of ['https://www.yukino.bond/fog-harbor-files?from=games#case','https://www.yukino.bond/games/fog-harbor-files/?from=games#case',target])expect(canonicalPageUrl(url)).toBe(target);
  expect(canonicalPageUrl('https://games.yukino.bond/fog-harbor-files/art/archive.svg')).toBeNull();expect(canonicalPageUrl('https://games.yukino.bond/age-of-nations/')).toBe('https://games.yukino.bond/age-of-nations/');
 });
 it('redirects only the document and allows return from trusted portal login',async()=>{
  const next=async()=>new Response('mystery document');expect((await onRequest({request:new Request('https://games.yukino.bond/fog-harbor-files/'),next})).status).toBe(200);
  const r=await onRequest({request:new Request('https://www.yukino.bond/games/fog-harbor-files'),next});expect(r.status).toBe(308);expect(r.headers.get('Location')).toBe('https://games.yukino.bond/fog-harbor-files/');expect(safeAuthReturn('https://games.yukino.bond/fog-harbor-files/')).toBe('https://games.yukino.bond/fog-harbor-files/');
 });
});
