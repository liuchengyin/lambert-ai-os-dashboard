// Keep the Vercel entry free of SDK/module initialization at import time.
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  try{
    const {default:archive}=await import('../lib/feishu-review-handler.js');
    return await archive(req,res);
  }catch(error){
    const kind=String(error?.code||error?.name||'UNKNOWN').replace(/[^A-Za-z0-9_]/g,'').slice(0,70);
    console.error('review archive initialization failed',{kind});
    return res.status(503).json({ok:false,code:'ARCHIVE_INITIALIZATION_FAILED',reason:kind,message:'复盘归档服务暂不可用，原复盘已保留'});
  }
}
