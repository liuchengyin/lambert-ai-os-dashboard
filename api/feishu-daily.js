// Vercel Serverless Function: secure Feishu archive boundary.
// Frontend never receives Feishu credentials. This endpoint is intentionally
// configuration-gated until FEISHU_APP_ID / FEISHU_APP_SECRET are added in Vercel.

const DAILY_WIKI_TOKEN='IH63wL0oKi6Dp2kU4cncE8gUnig';

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST') return res.status(405).json({ok:false,message:'Method not allowed'});

  const appId=process.env.FEISHU_APP_ID;
  const appSecret=process.env.FEISHU_APP_SECRET;
  if(!appId||!appSecret){
    return res.status(503).json({
      ok:false,
      code:'FEISHU_NOT_CONFIGURED',
      message:'飞书服务端凭证尚未配置。编辑器已经就绪；配置 Vercel 服务端凭证后即可开启完整归档。'
    });
  }

  const body=req.body||{};
  const date=String(body.date||'').trim();
  const title=String(body.title||`${date||'今日'}｜每日记录`).trim();
  const markdown=String(body.markdown||'');
  const targetWikiToken=String(body.targetWikiToken||DAILY_WIKI_TOKEN).trim();
  if(!markdown.trim()) return res.status(400).json({ok:false,message:'记录内容为空'});
  if(targetWikiToken!==DAILY_WIKI_TOKEN) return res.status(400).json({ok:false,message:'归档目标不匹配'});

  // The remaining Feishu flow is kept server-side by design:
  // 1) get tenant_access_token;
  // 2) resolve the wiki node -> space/document tokens;
  // 3) create a child docx under the Daily Record wiki node;
  // 4) convert Markdown structure to Docx blocks;
  // 5) upload embedded images and replace image placeholders with Feishu image blocks;
  // 6) return the created Wiki URL.
  //
  // We do not silently downgrade to text-only: images and document structure must
  // be preserved before this endpoint reports success.
  return res.status(501).json({
    ok:false,
    code:'FEISHU_ARCHIVE_ENGINE_PENDING',
    message:'飞书凭证已检测到，但完整 Markdown + 图片归档引擎尚未完成，当前不会生成残缺文档。',
    targetWikiToken,
    title
  });
}
