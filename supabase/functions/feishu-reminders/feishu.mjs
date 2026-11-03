const BASE='https://open.feishu.cn/open-apis';
const result=(state,code,retryable=false,messageId=null)=>({state,code,retryable,messageId});
export function createFeishu({appId,appSecret,fetcher=fetch}){
 let access,expires=0;
 async function token(){
  if(access&&Date.now()<expires)return access;
  const r=await fetcher(BASE+'/auth/v3/tenant_access_token/internal',{method:'POST',redirect:'error',headers:{'Content-Type':'application/json'},body:JSON.stringify({app_id:appId,app_secret:appSecret}),signal:AbortSignal.timeout(10000)});
  const value=await r.json();if(!r.ok||value.code!==0||typeof value.tenant_access_token!=='string'||!value.tenant_access_token)throw Error('bot_auth_failed');
  access=value.tenant_access_token;expires=Date.now()+Math.max(0,(Number(value.expire)||0)-60)*1000;return access;
 }
 return async({receiveId,messageUuid,title,text,link})=>{
  let bearer;try{if(!appId||!appSecret)throw Error();bearer=await token();}catch{return result('rejected','bot_auth_failed',true);}
  try{
   const content={zh_cn:{title,content:[[{tag:'text',text}],[{tag:'a',text:'打开 Lambert AI OS',href:link}]]}};
   const response=await fetcher(BASE+'/im/v1/messages?receive_id_type=open_id',{method:'POST',redirect:'error',headers:{Authorization:'Bearer '+bearer,'Content-Type':'application/json'},body:JSON.stringify({receive_id:receiveId,msg_type:'post',content:JSON.stringify(content),uuid:messageUuid}),signal:AbortSignal.timeout(10000)});
   let value;try{value=await response.json();}catch{return result('unknown','message_response_unreadable');}
   if(response.ok&&value.code===0&&typeof value.data?.message_id==='string'&&value.data.message_id.length>0&&value.data.message_id.length<=200)return result('sent','0',false,value.data.message_id);
   if(response.status>=500)return result('unknown','provider_5xx');
   if(Number.isInteger(value.code)&&value.code!==0&&(response.ok||response.status>=400&&response.status<500))return result('rejected','provider_'+value.code,true);
   return result('unknown','message_unconfirmed');
  }catch{return result('unknown','message_transport_unknown');}
 };
}
