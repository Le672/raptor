import React,{Component,type ReactNode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import './style.css';
class Boundary extends Component<{children:ReactNode},{failed:boolean}>{state={failed:false};static getDerivedStateFromError(){return{failed:true};}render(){return this.state.failed?<main className="fatal"><h1>调查暂时中断</h1><p>页面未能继续显示，本机档案不会被主动删除。</p><button onClick={()=>location.reload()}>重新打开</button><a href="https://games.yukino.bond/">返回游戏中心</a></main>:this.props.children;}}
createRoot(document.getElementById('root')!).render(<React.StrictMode><Boundary><App/></Boundary></React.StrictMode>);
