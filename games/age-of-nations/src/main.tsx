import React,{Component,type ReactNode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import {t} from './i18n';
import './style.css';
import './expedition.css';
class Boundary extends Component<{children:ReactNode},{failed:boolean}>{state={failed:false};static getDerivedStateFromError(){return{failed:true};}render(){return this.state.failed?<main className="fatal"><h1>{t('title')}</h1><p>{t('notSupported')}</p><button onClick={()=>location.reload()}>{t('retry')}</button></main>:this.props.children;}}
createRoot(document.getElementById('root')!).render(<Boundary><App/></Boundary>);
