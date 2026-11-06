import { runAiRound } from './ai';
self.onmessage=({data})=>{try{const state=runAiRound(data.state,player=>self.postMessage({type:'progress',player}));self.postMessage({type:'done',state});}catch{self.postMessage({type:'error'});}};
