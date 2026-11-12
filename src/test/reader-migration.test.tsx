import {afterEach,expect,it,vi} from 'vitest';
import {act,cleanup,render,screen} from '@testing-library/react';
import {LibraryMigration} from '../../novel/src/Migration';
import {history,saveProgress,shelf} from '../../novel/src/library';
import type {Book} from '../../novel/src/api';
const book:Book={id:'wenku-1973',title:'测试轻小说',author:'测试作者',illustrator:'',description:'',cover:'',tags:[],status:'ongoing',updatedAt:null,sourceFetchedAt:null,sourceUrl:'https://www.wenku8.net/book/1973.htm'};
afterEach(()=>{cleanup();localStorage.clear();document.querySelector('meta[name="reader-kind"]')?.remove();vi.restoreAllMocks();});
it('accepts only the original domain, exact iframe and nonce, merging without losing newer progress',()=>{
  localStorage.clear();saveProgress({book,volumeId:'11',chapterId:'22',chapterTitle:'新进度',percent:80,updatedAt:300});
  render(<LibraryMigration/>);const frame=document.querySelector('iframe')!,nonce=new URL(frame.src).hash.slice(1);
  const payload={version:1,site:'ln',shelf:[{book,savedAt:100}],history:[{book,volumeId:'11',chapterId:'21',chapterTitle:'旧进度',percent:10,updatedAt:100}],settings:{theme:'dark',fontSize:22}};
  const send=(origin:string,source:MessageEventSource|null,messageNonce=nonce)=>act(()=>{window.dispatchEvent(new MessageEvent('message',{origin,source,data:{type:'yukino-light-library',nonce:messageNonce,payload}}));});
  send('https://evil.test',frame.contentWindow);send('https://novel.yukino.bond',window);send('https://novel.yukino.bond',frame.contentWindow,'wrong');expect(shelf()).toHaveLength(0);
  send('https://novel.yukino.bond',frame.contentWindow);expect(shelf()[0].book.id).toBe(book.id);expect(history()[0].chapterId).toBe('22');expect(history()[0].percent).toBe(80);expect(document.querySelector('iframe')).toBeNull();expect(screen.getByRole('status').textContent).toContain('合并');
});
it('ordinary books use separate storage and refuse a light backup, preserving original records',async()=>{
  vi.resetModules();const meta=document.createElement('meta');meta.name='reader-kind';meta.content='fiction';document.head.appendChild(meta);
  const original=JSON.stringify([{book,savedAt:100}]);localStorage.setItem('novel:shelf',original);
  const library=await import('../../novel/src/library');const api=await import('../../novel/src/api');
  expect(library.shelf()).toHaveLength(0);expect(()=>library.importLibrary(JSON.stringify({version:1,shelf:[{book,savedAt:100}],history:[]}))).toThrow('另一个书房');
  const ordinary={...book,id:'zongheng-672340',title:'测试普通小说',source:'zongheng' as const};library.toggleSaved(ordinary);
  expect(library.shelf()[0].book.id).toBe('zongheng-672340');expect(JSON.parse(localStorage.getItem('fiction:shelf')!)[0].book.id).toBe('zongheng-672340');expect(localStorage.getItem('novel:shelf')).toBe(original);
  expect(api.directId('https://www.zongheng.com/detail/672340')).toBe('zongheng-672340');expect(api.directId('https://www.wenku8.net/book/1973.htm')).toBe('');
});
