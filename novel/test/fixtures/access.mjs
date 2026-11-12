// This is only a syntactically valid test token. The mocked portal verifies it;
// production signature/session verification remains entirely in the portal.
const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
const token=`${encode({alg:'HS256',typ:'JWT'})}.${encode({sub:1,exp:4102444800})}.test_signature`;
export const authenticatedHeaders=()=>({Authorization:`Bearer ${token}`});
export function portalIdentity(url){return String(url)==='https://www.yukino.bond/api/auth/access'?Response.json({user:{id:1,name:'测试读者',role:'user'}}):null;}
