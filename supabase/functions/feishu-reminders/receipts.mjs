// Existing server-owned archive receipts, not client-editable review flags.
export async function reviewSubmitted(redis,userId,date){
 if(!/^[a-f0-9-]{36}$/i.test(userId)||!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('invalid_receipt_scope');
 const prefix=`feishu:review:v1:${userId}:${date}:`,deadline=Date.now()+15000;let cursor='0',keys=new Set();
 // Redis SCAN is bounded; an incomplete scan is unknown, never "not submitted".
 for(let page=0;page<50;page++){
  if(Date.now()>deadline)throw Error('receipt_query_incomplete');
  const result=await redis(['SCAN',cursor,'MATCH',prefix+'*','COUNT',100]);
  if(!Array.isArray(result)||result.length!==2||!Array.isArray(result[1])||!/^\d+$/.test(String(result[0])))throw Error('receipt_query_failed');
  cursor=String(result[0]);
  for(const key of result[1]){if(typeof key!=='string'||!key.startsWith(prefix)||!/^[a-f0-9]{64}$/.test(key.slice(prefix.length)))throw Error('receipt_scope_mismatch');keys.add(key);}
  if(keys.size>500)throw Error('receipt_query_failed');if(cursor==='0')break;
 }
 if(cursor!=='0')throw Error('receipt_query_incomplete');
 let unconfirmed=false;if(!keys.size)return false;
 if(Date.now()>deadline)throw Error('receipt_query_incomplete');
 const values=await redis(['MGET',...keys]);if(!Array.isArray(values)||values.length!==keys.size)throw Error('receipt_query_failed');
 for(const value of values){if(typeof value!=='string')throw Error('receipt_query_failed');let receipt;try{receipt=JSON.parse(value);}catch{throw Error('receipt_query_failed');}
  if(receipt.state==='done'){
   let url;try{url=new URL(receipt.url);}catch{throw Error('receipt_query_failed');}
   if(url.protocol!=='https:'||!/(^|\.)feishu\.cn$/.test(url.hostname)||url.username||url.password||!Number.isFinite(Date.parse(receipt.archivedAt)))throw Error('receipt_query_failed');
   return true; // A real successful snapshot exists, even if later edits followed.
  }
  unconfirmed=true;
 }
 if(unconfirmed)throw Error('receipt_unconfirmed');
 return false;
}
