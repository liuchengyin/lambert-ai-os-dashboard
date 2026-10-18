package app.lambert.tasks;
import android.app.Activity;
import android.app.AlertDialog;
import android.os.Bundle;
import android.webkit.*;
import androidx.webkit.WebViewAssetLoader;
import java.io.ByteArrayInputStream;

public final class MainActivity extends Activity {
 private WebView web;
 private static final String HOST="appassets.androidplatform.net";
 private boolean local(android.net.Uri u){return "https".equals(u.getScheme())&&HOST.equals(u.getHost())&&u.getPath()!=null&&u.getPath().startsWith("/assets/mobile/");}
 @Override public void onCreate(Bundle state){
  super.onCreate(state);
  web=new WebView(this);setContentView(web);
  getWindow().setStatusBarColor(0xff7357d7);getWindow().setNavigationBarColor(0xfff5f3ff);
  WebView.setWebContentsDebuggingEnabled(false);
  WebSettings s=web.getSettings();s.setJavaScriptEnabled(true);s.setDomStorageEnabled(true);
  s.setAllowFileAccess(false);s.setAllowContentAccess(false);s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
  s.setJavaScriptCanOpenWindowsAutomatically(false);s.setSupportMultipleWindows(false);s.setGeolocationEnabled(false);
  final WebViewAssetLoader loader=new WebViewAssetLoader.Builder().addPathHandler("/assets/",new WebViewAssetLoader.AssetsPathHandler(this)).build();
  web.setWebViewClient(new WebViewClient(){
   @Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest r){return !local(r.getUrl());}
   @Override public WebResourceResponse shouldInterceptRequest(WebView v,WebResourceRequest r){
    if(local(r.getUrl())){WebResourceResponse a=loader.shouldInterceptRequest(r.getUrl());if(a!=null)return a;}
    return new WebResourceResponse("text/plain","UTF-8",403,"Blocked",java.util.Collections.emptyMap(),new ByteArrayInputStream(new byte[0]));
   }
  });
  web.setWebChromeClient(new WebChromeClient(){
   @Override public boolean onJsAlert(WebView v,String url,String msg,JsResult result){new AlertDialog.Builder(MainActivity.this).setMessage(msg).setPositiveButton("确定",(d,w)->result.confirm()).setOnCancelListener(d->result.cancel()).show();return true;}
   @Override public void onPermissionRequest(PermissionRequest request){request.deny();}
  });
  web.loadUrl("https://"+HOST+"/assets/mobile/index.html");
 }
 @Override public void onBackPressed(){if(web.canGoBack())web.goBack();else super.onBackPressed();}
 @Override protected void onDestroy(){if(web!=null)web.destroy();super.onDestroy();}
}
