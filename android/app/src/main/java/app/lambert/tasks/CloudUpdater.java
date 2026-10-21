package app.lambert.tasks;

import android.content.Context;
import android.webkit.WebResourceResponse;
import org.json.JSONObject;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.*;

public final class CloudUpdater {
 private static final String ORIGIN="https://lambert-ai-os-dashboard.vercel.app";
 private static CloudUpdater instance;
 public static synchronized CloudUpdater get(Context context) throws Exception {if(instance==null)instance=new CloudUpdater(context.getApplicationContext());return instance;}
 private final BundleStore store;
 private final int shell;
 private final ExecutorService worker=Executors.newSingleThreadExecutor();
 private volatile String status="正在检查页面更新";
 private volatile boolean checking;
 private CloudUpdater(Context context) throws Exception {shell=context.getPackageManager().getPackageInfo(context.getPackageName(),0).versionCode;store=new BundleStore(new File(context.getFilesDir(),"web-updates"));store.shell(shell);status=store.pending()?"页面更新已就绪，下次打开自动生效":"当前页面可离线使用";}
 public void start() throws IOException {store.begin();}
 public boolean probation(){return store.probation();}
 public void healthy(){try{store.healthy();}catch(IOException ignored){}}
 public void rollback(){try{store.rollback();status="新页面启动失败，已回退旧版";}catch(IOException ignored){}}
 private static byte[] download(String path,int limit) throws Exception {
  if(!path.matches("/mobile/updates/(?:latest\\.json|[a-f0-9]{64}\\.zip)"))throw new IOException("invalid_update_url");
  HttpURLConnection connection=(HttpURLConnection)new URL(ORIGIN+path).openConnection();connection.setInstanceFollowRedirects(false);connection.setConnectTimeout(8000);connection.setReadTimeout(12000);connection.setRequestProperty("Cache-Control","no-cache");
  try{if(connection.getResponseCode()!=200)throw new IOException("update_unavailable");if(connection.getContentLengthLong()>limit)throw new IOException("update_too_large");
   try(InputStream in=connection.getInputStream();ByteArrayOutputStream out=new ByteArrayOutputStream()){byte[] buf=new byte[8192];int n,total=0;while((n=in.read(buf))!=-1){total+=n;if(total>limit)throw new IOException("update_too_large");out.write(buf,0,n);}return out.toByteArray();}
  }finally{connection.disconnect();}
 }
 public synchronized void check(){if(checking||worker.isShutdown())return;checking=true;status=store.pending()?"页面更新已就绪，下次打开自动生效":"正在检查页面更新";worker.execute(()->{try{
  JSONObject manifest=new JSONObject(new String(download("/mobile/updates/latest.json",16384),StandardCharsets.UTF_8));
  if(manifest.getInt("protocol")!=1||manifest.getInt("minNativeVersion")>shell){status="此更新需要升级安装包，现有页面可继续使用";return;}
  String sha=manifest.getString("sha256"),path=manifest.getString("url");long release=manifest.getLong("release");
  if(!sha.matches("[a-f0-9]{64}")||!path.equals("/mobile/updates/"+sha+".zip")||release<=0)throw new IOException("invalid_manifest");
  if(!store.wants(sha,release)){status=store.pending()?"页面更新已就绪，下次打开自动生效":"当前页面已是最新";return;}
  status="正在后台下载页面更新";store.install(download(path,BundleStore.MAX_ZIP),sha,release);status="页面更新已就绪，下次打开自动生效";
 }catch(Exception ignored){status=store.pending()?"页面更新已就绪，下次打开自动生效":"暂未获取到更新，继续使用本地页面";}finally{checking=false;}});}
 public WebResourceResponse control(String path){
  if(!path.equals("mobile/__updates/status")&&!path.equals("mobile/__updates/check"))return null;
  if(path.endsWith("/check"))check();
  JSONObject data=new JSONObject();try{data.put("message",status);data.put("checking",checking);data.put("ready",store.pending());data.put("release",store.highestRelease());}catch(Exception ignored){}
  return new WebResourceResponse("application/json","UTF-8",new ByteArrayInputStream(data.toString().getBytes(StandardCharsets.UTF_8)));
 }
 public WebResourceResponse asset(String path){try{File f=store.file(path);if(f==null)return null;String mime=path.endsWith(".mjs")||path.endsWith(".js")?"text/javascript":path.endsWith(".css")?"text/css":path.endsWith(".html")?"text/html":path.endsWith(".svg")?"image/svg+xml":path.endsWith(".json")?"application/json":java.net.URLConnection.guessContentTypeFromName(path);return new WebResourceResponse(mime==null?"application/octet-stream":mime,"UTF-8",new FileInputStream(f));}catch(IOException e){return new WebResourceResponse("text/plain","UTF-8",404,"Not found",java.util.Collections.emptyMap(),new ByteArrayInputStream(new byte[0]));}}
}
