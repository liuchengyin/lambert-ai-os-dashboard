// Keep the SDK's original URL/session key; change only its HTTP transport.
export function createCloudFetch(config,configUrl,fetcher=globalThis.fetch){
  if(config.transport!=='relay')return fetcher;
  const upstream=new URL(config.url).origin;
  return async(input,init={})=>{
    const request=new Request(input,init),url=new URL(request.url);
    if(url.origin!==upstream||!/^\/(auth|rest)\/v1\//.test(url.pathname))throw Error('cloud_route_not_allowed');
    const relay=new URL(configUrl,globalThis.location?.href||config.siteUrl);
    relay.searchParams.set('resource',url.pathname+url.search);
    return fetcher(relay.href,{method:request.method,headers:request.headers,
      body:['GET','HEAD'].includes(request.method)?undefined:await request.text(),
      credentials:'omit',cache:'no-store',redirect:'error',signal:request.signal});
  };
}
