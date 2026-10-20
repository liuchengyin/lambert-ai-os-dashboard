// Keep the Vercel entry free of SDK/module initialization at import time.
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  let stage='load';
  try{
    const loaded=await import('../lib/feishu-review-handler.js');
    stage='resolve';
    // Vercel's compiled CommonJS module is wrapped once more by dynamic import.
    const archive=typeof loaded.default==='function'?loaded.default:loaded.default?.default;
    if(typeof archive!=='function')throw Error('invalid_handler_export');
    stage='invoke';
    return await archive(req,res);
  }catch(error){
    const kind=String(error?.code||error?.name||'UNKNOWN').replace(/[^A-Za-z0-9_]/g,'').slice(0,70);
    console.error('review archive initialization failed',{kind,stage});
    return res.status(503).json({ok:false,code:'ARCHIVE_INITIALIZATION_FAILED',reason:kind,stage,message:'复盘归档服务暂不可用，原复盘已保留'});
  }
}
