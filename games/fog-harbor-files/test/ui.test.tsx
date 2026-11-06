// @vitest-environment jsdom
import React from 'react';
import {afterEach,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import {locations} from '../src/content';
vi.mock('../src/storage',()=>({CaseStore:class{records=new Map();async current(){return null;}async save(state:any,kind='auto',name=''){this.records.set('current',{id:'current',name,kind,state,chapter:state.chapter,updated:state.updatedAt});}async list(){return [...this.records.values()];}async put(key:string,value:any){this.records.set(key,value);}async get(key:string){return this.records.get(key);}async remove(key:string){this.records.delete(key);}},exportCase:vi.fn(),importCase:vi.fn()}));
vi.mock('../src/cloud',()=>({CaseSync:class{async check(){}async queue(){}async pause(){}dispose(){}login(){}}}));
import App from '../src/App';
afterEach(()=>{cleanup();vi.restoreAllMocks();});
it('takes a guest through the first physical observation and preserves readable evidence',async()=>{
 render(<App/>);await screen.findByRole('heading',{name:'雾港档案'});fireEvent.click(screen.getByRole('button',{name:/开始调查/}));await screen.findByRole('dialog');fireEvent.click(screen.getByRole('button',{name:'继续调查'}));
 fireEvent.click(screen.getByRole('button',{name:'馆内地图'}));fireEvent.click(screen.getByRole('button',{name:/档案室/}));
 const h=locations.find(l=>l.id==='archive')!.hotspots.find(h=>h.evidence.includes('E01'))!;fireEvent.click(screen.getByRole('button',{name:'调查'+h.title}));
 await screen.findByRole('heading',{name:'现场观察'});fireEvent.click(screen.getByRole('button',{name:'收录至证据档案'}));await waitFor(()=>expect(screen.getByText(/已收录 · 可随时复查/)).toBeTruthy());
 fireEvent.click(screen.getByRole('button',{name:'关闭面板'}));fireEvent.click(screen.getByRole('button',{name:'证据档案'}));expect(screen.getByRole('button',{name:/E01/})).toBeTruthy();
});
it('keeps an early wrong report recoverable and offers evidence-based investigation tools',async()=>{
 render(<App/>);await screen.findByRole('heading',{name:'雾港档案'});fireEvent.click(screen.getByRole('button',{name:/开始调查/}));fireEvent.click(await screen.findByRole('button',{name:'继续调查'}));fireEvent.click(screen.getByRole('button',{name:'推理板'}));expect(await screen.findByRole('heading',{name:'推理板'})).toBeTruthy();expect(screen.queryByRole('button',{name:'验证解释'})).toBeNull();expect(screen.getByRole('heading',{name:'先完成现场核查'})).toBeTruthy();
 expect(screen.queryByRole('button',{name:/展开提示/})).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'调查报告'}));expect(await screen.findByRole('heading',{name:'调查报告'})).toBeTruthy();expect(screen.getByRole('button',{name:'提交复核'}).hasAttribute('disabled')).toBe(true);
});
