import {describe,it,expect} from 'vitest';
import {safeAuthReturn} from '../lib/auth-return';
import {canonicalPageUrl} from '../lib/site-routing';
import {onRequest} from '../../functions/_middleware';
describe('Age of Nations independent document path',()=>{
  it('returns from portal login only to the trusted game origin',()=>{expect(safeAuthReturn('https://games.yukino.bond/age-of-nations/')).toBe('https://games.yukino.bond/age-of-nations/');expect(safeAuthReturn('https://games.yukino.bond.evil.invalid/')).toBeNull();});
  it('keeps the game at its named path and retains the game catalogue root',()=>{
    const target='https://games.yukino.bond/age-of-nations/?seed=example#map';
    for(const url of ['https://www.yukino.bond/age-of-nations?seed=example#map','https://www.yukino.bond/games/age-of-nations/?seed=example#map',target])expect(canonicalPageUrl(url)).toBe(target);
    expect(canonicalPageUrl('https://games.yukino.bond/')).toBe('https://games.yukino.bond/');
    expect(canonicalPageUrl('https://games.yukino.bond/age-of-nations/assets/index-a.js')).toBeNull();
  });
  it('only redirects the game document when necessary at the edge',async()=>{
    const next=async()=>new Response('game document');
    const correct=await onRequest({request:new Request('https://games.yukino.bond/age-of-nations/'),next});expect(correct.status).toBe(200);
    const old=await onRequest({request:new Request('https://www.yukino.bond/games/age-of-nations'),next});expect(old.status).toBe(308);expect(old.headers.get('Location')).toBe('https://games.yukino.bond/age-of-nations/');
  });
});
