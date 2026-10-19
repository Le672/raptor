import {useEffect,useRef,useState} from 'react';
import Hls from 'hls.js';
import {AlertCircle,LoaderCircle,Maximize,PictureInPicture2,RotateCcw} from 'lucide-react';
import {request,clock} from './api';
import type {Detail,Episode,Line,PlayResponse} from './api';
import {getLibrary,saveProgress,updateSettings} from './library';
import type {Settings} from './library';

export default function Player({anime,line,episode,start,autoPlay=false,settings,onEnded,onTime,onReady}:{anime:Detail;line:Line;episode:Episode;start:number;autoPlay?:boolean;settings:Settings;onEnded:()=>void;onTime:(seconds:number)=>void;onReady:()=>void}){
  const video=useRef<HTMLVideoElement>(null),callbacks=useRef({onEnded,onTime,onReady}),prefs=useRef(settings);
  callbacks.current={onEnded,onTime,onReady};prefs.current=settings;
  const[error,setError]=useState(''),[state,setState]=useState('正在连接番源'),[retry,setRetry]=useState(0),[playing,setPlaying]=useState(false),[position,setPosition]=useState(0),[quality,setQuality]=useState(''),lastSaved=useRef(0);
  useEffect(()=>{
    const element=video.current;if(!element)return;const abort=new AbortController();let hls:Hls|undefined,disposed=false,recovered=false;
    setError('');setState('正在连接番源');setPlaying(false);setQuality('');setPosition(0);
    function persist(){if(!element||element.readyState===0||!Number.isFinite(element.currentTime))return;saveProgress({anime,lineId:line.id,episodeId:episode.id,episodeTitle:episode.title,seconds:element.currentTime,duration:Number.isFinite(element.duration)?element.duration:0,savedAt:Date.now()});}
    function metadata(){if(!element)return;const old=getLibrary().history.find(p=>p.anime.id===anime.id&&p.lineId===line.id&&p.episodeId===episode.id);const resume=start>=0?start:old?.seconds||0;const target=resume||prefs.current.skipIntro;if(target>0&&Number.isFinite(element.duration)&&target<element.duration-3)element.currentTime=target;element.playbackRate=prefs.current.rate;element.volume=prefs.current.volume;setState('已准备好，点击播放');persist();callbacks.current.onReady();if(autoPlay)void element.play().catch(()=>setState('已准备好，点击播放'));}
    function time(){if(!element)return;setPosition(element.currentTime);callbacks.current.onTime(element.currentTime);if(Date.now()-lastSaved.current>5000){lastSaved.current=Date.now();persist();}}
    function play(){setPlaying(true);setState('');}
    function pause(){setPlaying(false);persist();}
    function ended(){persist();callbacks.current.onEnded();}
    function failed(){setError('视频暂时无法播放，请重试或选择其他番源');}
    element.addEventListener('loadedmetadata',metadata);element.addEventListener('timeupdate',time);element.addEventListener('playing',play);element.addEventListener('pause',pause);element.addEventListener('ended',ended);element.addEventListener('error',failed);window.addEventListener('pagehide',persist);
    void request<PlayResponse>(`/api/anime/${anime.id}/play?line=${line.id}&episode=${episode.id}`,abort.signal).then(result=>{
      if(disposed)return;
      if(result.data.kind==='hls'&&Hls.isSupported()){
        hls=new Hls({enableWorker:true,maxBufferLength:30,backBufferLength:30});
        hls.on(Hls.Events.ERROR,(_event,data)=>{if(!data.fatal)return;if(data.type===Hls.ErrorTypes.MEDIA_ERROR&&!recovered){recovered=true;hls?.recoverMediaError();return;}setError(data.response?.code?`视频线路返回 HTTP ${data.response.code}，请切换其他番源`:'当前线路加载失败，请重试或选择其他番源');hls?.destroy();});
        hls.on(Hls.Events.LEVEL_SWITCHED,(_event,data)=>{const level=hls?.levels[data.level];if(level?.height)setQuality(level.height+'P');});
        hls.loadSource(result.data.url);hls.attachMedia(element);
      }else if(result.data.kind==='mp4'||element.canPlayType('application/vnd.apple.mpegurl'))element.src=result.data.url;
      else setError('当前浏览器不支持该视频格式，请使用新版 Chrome 或 Safari');
    }).catch(e=>{if(!abort.signal.aborted)setError(e.message);});
    return()=>{persist();disposed=true;abort.abort();element.removeEventListener('loadedmetadata',metadata);element.removeEventListener('timeupdate',time);element.removeEventListener('playing',play);element.removeEventListener('pause',pause);element.removeEventListener('ended',ended);element.removeEventListener('error',failed);window.removeEventListener('pagehide',persist);hls?.destroy();element.removeAttribute('src');element.load();};
    // A keyed Player consumes the incoming seek/autoplay once. Clearing those URL hints must not reload the video.
  },[anime.id,line.id,episode.id,retry]);
  useEffect(()=>{if(video.current){video.current.playbackRate=settings.rate;video.current.volume=settings.volume;}},[settings.rate,settings.volume]);
  async function pip(){try{if(document.pictureInPictureElement)await document.exitPictureInPicture();else await video.current?.requestPictureInPicture();}catch{setState('画中画暂时不可用，可使用视频控件中的全屏');}}
  return <div className="player" data-playing={playing}>
    <div className="video-stage"><video ref={video} controls playsInline preload="metadata" aria-label={`${anime.title} ${episode.title}`} onVolumeChange={()=>{if(video.current&&Math.abs(video.current.volume-getLibrary().settings.volume)>.01)updateSettings({volume:video.current.volume});}} />
      {!playing&&state&&!error&&<div className="player-notice" aria-live="polite"><span className="player-orbit"><img src="/screen.svg" alt=""/></span><p>{state}</p><span>{anime.title} · {episode.title}</span>{state==='已准备好，点击播放'&&<button className="button" onClick={()=>void video.current?.play().catch(()=>setError('播放未能开始，请使用视频下方的播放控件重试'))}>开始播放</button>}</div>}
      {error&&<div className="player-error" role="alert"><AlertCircle size={32}/><h3>这条线路暂时没连上</h3><p>{error}</p><button className="button" onClick={()=>setRetry(v=>v+1)}><RotateCcw size={14}/>重新连接</button><small>也可以在下方更换番源，接着当前进度看。</small></div>}
    </div>
    <div className="player-status"><span><i className={playing?'dot live':'dot'}/>{playing?'正在播放':error?'线路不可用':'准备播放'}<b>{quality}</b></span><span className="player-time">{clock(position)}<span> / </span>{clock(video.current?.duration||0)}</span><button onClick={pip} aria-label="画中画"><PictureInPicture2 size={16}/></button><button onClick={()=>void video.current?.requestFullscreen().catch(()=>{})} aria-label="全屏播放"><Maximize size={16}/></button></div>
    {!error&&state==='正在连接番源'&&<span className="player-loading"><LoaderCircle className="spin" size={13}/> 正在获取播放清单…</span>}
  </div>;
}
