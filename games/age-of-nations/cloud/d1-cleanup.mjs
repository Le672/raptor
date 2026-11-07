import {cleanSaves} from './service.mjs';
export default{async scheduled(_controller,env){await cleanSaves(env);},fetch(){return new Response('Not found',{status:404});}};
