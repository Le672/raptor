import { afterEach,describe,it,expect,vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { fireEvent,render,screen,cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TOOLS } from '../lib/toolbox';
import Tools from '../pages/Tools';
import { siteNavigation } from '../data/navigation';
import { APPS } from '../../shared/pwa/sites.mjs';
import { SITE_SECTIONS } from '../lib/site-routing';
import { onRequest } from '../../functions/_middleware';
const run=(id:string,s:string,o?:string)=>{const t=TOOLS.find(t=>t.id===id)!;return t.run!(s,o||t.options?.[0]||'');};
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
describe('independently implemented tool transforms',()=>{
 it.each(TOOLS.filter(t=>t.run&&t.sample))('$label runs its advertised example',async t=>{vi.stubGlobal('crypto',webcrypto);expect(await t.run!(t.sample!,t.options?.[0]||'')).not.toBe('');});
 it('round trips UTF-8, binary and URL-safe Base64 without losing emoji',async()=>{for(const[id,from,to]of [['hex-text','文本转 HEX','HEX 转文本'],['binary-text','文本转二进制','二进制转文本'],['base64url','编码','解码'],['unicode','转义','还原']]){const s='你好 🌸 é\n';expect(await run(id,await run(id,s,from),to)).toBe(s);}});
 it('handles quoted CSV newlines, escaped quotes and hostile object keys',async()=>{const rows=JSON.parse(await run('csv-json','__proto__,message\nhello,"a,""b""\nnext"'));expect(Object.keys(rows[0])).toEqual(['__proto__','message']);expect(rows[0].message).toBe('a,"b"\nnext');expect(JSON.parse(await run('csv-json',await run('json-csv',JSON.stringify(rows))))).toEqual(rows);});
 it('rejects malformed input instead of returning partial conversions',()=>{expect(()=>run('hex-text','xyz','HEX 转文本')).toThrow();expect(()=>run('csv-json','a,b\nx')).toThrow();expect(()=>run('csv-json','a,a\nx,y')).toThrow();expect(()=>run('base-convert','12','二进制')).toThrow();expect(()=>run('temperature','-274')).toThrow();expect(()=>run('xml','<a>')).toThrow();});
 it('keeps duplicate query parameters including constructor names',()=>{expect(JSON.parse(run('query','__proto__=one&__proto__=two&constructor=three') as string)).toEqual(JSON.parse('{"__proto__":["one","two"],"constructor":["three"]}'));});
 it('preserves integers beyond JavaScript number precision',()=>{expect(run('base-convert','18446744073709551615')).toContain('FFFFFFFFFFFFFFFF');});
 it('generates passwords with every character class and secure UUIDs',()=>{vi.stubGlobal('crypto',webcrypto);for(let i=0;i<10;i++){const s=run('password','24') as string;expect(s).toHaveLength(24);expect(s).toMatch(/[A-Z]/);expect(s).toMatch(/[a-z]/);expect(s).toMatch(/[2-9]/);expect(s).toMatch(/[!@#$%&*+\-=?]/);}expect((run('uuid','3') as string).split('\n')).toHaveLength(3);});
 it('marks decoded JWTs as unverified and uses actual date offsets',()=>{const t=TOOLS.find(t=>t.id==='jwt')!;expect(JSON.parse(t.run!(t.sample!,'') as string).signatureVerified).toBe(false);expect(run('date-diff','2026-03-08T01:00:00-05:00\n2026-03-08T04:00:00-04:00')).toContain('小时: 2');});
});
describe('tool directory and complete public navigation',()=>{
 it('searches and favorites tools without persisting user input',()=>{localStorage.clear();render(<MemoryRouter initialEntries={['/tools?tool=base64']}><Tools/></MemoryRouter>);fireEvent.change(screen.getByLabelText('原始文本'),{target:{value:'private input 你好'}});fireEvent.click(screen.getByRole('button',{name:'收藏工具'}));fireEvent.click(screen.getByRole('button',{name:'全部工具'}));fireEvent.change(screen.getByLabelText('搜索工具'),{target:{value:'Base64'}});expect(screen.getAllByRole('article')).toHaveLength(2);expect(localStorage.getItem('yukino-tools:favorites')).toBe('["base64"]');expect(localStorage.getItem('yukino-tools:recent')).toBe('["base64"]');expect(Object.values(localStorage).join('')).not.toContain('private input');});
 it('has one direct sidebar destination per public application with mail first',()=>{expect(siteNavigation[0].to).toBe('/mail');const hosts=siteNavigation.map(n=>n.href?new URL(n.href).hostname:n.to==='/notes'?'www.yukino.bond':n.to==='/'?'www.yukino.bond':(n.to==='/about-me'?'about':n.to.slice(1))+'.yukino.bond');for(const app of APPS)expect(hosts).toContain(app.host);expect(APPS.some(a=>a.id==='dev')).toBe(false);expect(SITE_SECTIONS.some(([p])=>p==='/dev')).toBe(false);});
 it.each(['GET','POST'])('returns 410 for stale dev %s requests without redirecting',async method=>{const next=vi.fn();const r=await onRequest({request:new Request('https://dev.yukino.bond/?tool=json',{method}),next});expect(r.status).toBe(410);expect(r.headers.has('location')).toBe(false);expect(next).not.toHaveBeenCalled();});
});
