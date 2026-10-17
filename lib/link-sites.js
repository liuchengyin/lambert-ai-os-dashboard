/* Shared, curated site identities. Page titles still come from metadata for deep links. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.LambertLinkSites=api})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const sites=[
    ['deepseek.com','DeepSeek','AI 对话与开放平台','brand/links/deepseek.svg'],
    ['google.com','Google','搜索信息与 Google 服务','brand/links/google.png'],
    ['google.cn','Google','搜索信息与 Google 服务','brand/links/google.png'],
    ['douban.com','豆瓣','电影、图书、音乐与生活社区','brand/links/douban.svg'],
    ['bilibili.com','哔哩哔哩','视频、动画与学习社区','brand/links/bilibili.png'],
    ['b23.tv','哔哩哔哩','哔哩哔哩视频短链接','brand/links/bilibili.png'],
    ['baidu.com','百度','中文搜索与信息服务'],['zhihu.com','知乎','问答与知识分享社区','brand/links/zhihu.svg'],
    ['xiaohongshu.com','小红书','生活经验与兴趣分享'],['xhslink.com','小红书','小红书分享链接'],
    ['weibo.com','微博','热点与社交分享','brand/links/sinaweibo.svg'],['github.com','GitHub','代码托管与开源协作','brand/links/github.svg'],
    ['chatgpt.com','ChatGPT','AI 对话与工作助手'],['feishu.cn','飞书','文档、沟通与协作'],
    ['notion.so','Notion','笔记、文档与知识管理','brand/links/notion.svg'],['notion.com','Notion','笔记、文档与知识管理','brand/links/notion.svg'],
    ['processon.com','ProcessOn','流程图与思维导图'],['modao.cc','墨刀','产品设计与原型协作'],
    ['kimi.com','Kimi','AI 对话与文档助手'],['doubao.com','豆包','AI 对话助手'],
    ['aliyun.com','阿里云','云计算与存储服务','brand/links/alibabacloud.svg'],['youtube.com','YouTube','视频与创作者社区','brand/links/youtube.svg'],
    ['taobao.com','淘宝','商品搜索与购物','brand/links/taobao.svg'],['jd.com','京东','商品搜索与购物'],
    ['1688.com','1688','货源与采购平台'],['163.com','网易','资讯与邮箱服务'],['qq.com','腾讯','腾讯内容与服务']
  ];
  function identify(raw){
    try{const u=new URL(raw);if(!['http:','https:'].includes(u.protocol)||u.username||u.password||u.port)return null;
      const h=u.hostname.toLowerCase(),site=sites.find(s=>h===s[0]||h.endsWith('.'+s[0]));if(!site)return null;
      let title=site[1],description=site[2],direct=/^\/$/.test(u.pathname);
      if(site[0]==='deepseek.com'){title=h==='platform.deepseek.com'?(u.pathname.startsWith('/usage')?'DeepSeek 余额与用量':'DeepSeek 开放平台'):'DeepSeek';direct=true}
      if(site[0].startsWith('google.')){title=h==='myaccount.google.com'?'Google 账号':h==='accounts.google.com'?'Google 登录':'Google';direct=true}
      if(site[0]==='douban.com'){
        if(h==='movie.douban.com'||(h==='m.douban.com'&&/^\/movie(?:\/|$)/.test(u.pathname))){title='豆瓣电影';description='电影信息、评分、影评与片单';direct=direct||/^\/movie\/?$/.test(u.pathname)}
        else if(h==='book.douban.com'||(h==='m.douban.com'&&/^\/book(?:\/|$)/.test(u.pathname))){title='豆瓣读书';description='图书信息、评分、书评与书单';direct=direct||/^\/book\/?$/.test(u.pathname)}
        else if(h==='music.douban.com'){title='豆瓣音乐';description='音乐评分、乐评与唱片信息'}
      }
      // Short URLs must resolve first; a platform name is only a fallback, never a video title.
      if(['b23.tv','xhslink.com'].includes(site[0]))direct=false;
      return {title,description,icon:site[3]||'',direct,source:'catalog'};
    }catch{return null}
  }
  return {identify};
});
