import {cleanSaves} from './service.mjs';
import {cleanSaves as cleanMysterySaves} from '../../fog-harbor-files/cloud/service.mjs';
export default{async scheduled(_controller,env){await cleanSaves(env);await cleanMysterySaves(env);},fetch(){return new Response('Not found',{status:404});}};
