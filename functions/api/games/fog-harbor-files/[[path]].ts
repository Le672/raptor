import {getCurrentUser} from '../../../_utils/auth';
import {handleSaves,reply} from '../../../../games/fog-harbor-files/cloud/service.mjs';
import {ensureSchema} from '../../../../games/fog-harbor-files/cloud/schema.mjs';
export async function onRequest(context:{request:Request;env:any;waitUntil:(p:Promise<unknown>)=>void}){
 const{request,env}=context;
 if(request.method==='OPTIONS')return reply({code:'METHOD_NOT_ALLOWED'},405);
 try{const user=await getCurrentUser(request,env);if(env.DB)await ensureSchema(env.DB);if(!user)return reply({code:'LOGIN_REQUIRED',available:!!env.DB,storage:'d1'},401);return await handleSaves(request,env,user);}catch{return reply({code:'CLOUD_UNAVAILABLE'},503);}
}
