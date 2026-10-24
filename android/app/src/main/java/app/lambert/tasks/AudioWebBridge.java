package app.lambert.tasks;

import android.content.ComponentName;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.webkit.WebView;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MediaMetadata;
import androidx.media3.common.Player;
import androidx.media3.session.MediaController;
import androidx.media3.session.SessionToken;
import androidx.webkit.JavaScriptReplyProxy;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import com.google.common.util.concurrent.ListenableFuture;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.Collections;

/** Main-frame, exact-origin bridge. Signed URLs stay in memory and are never logged. */
@androidx.annotation.OptIn(markerClass=androidx.media3.common.util.UnstableApi.class)
final class AudioWebBridge {
 private final MainActivity activity;
 private MediaController controller;
 private ListenableFuture<MediaController> pending;
 private JavaScriptReplyProxy reply;
 private final java.util.ArrayDeque<JSONObject> commands=new java.util.ArrayDeque<>();
 private final Handler handler=new Handler(Looper.getMainLooper());
 private final Runnable tick=new Runnable(){public void run(){emit();handler.postDelayed(this,1000);}};
 AudioWebBridge(MainActivity owner,WebView web){
  activity=owner;
  if(!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER))return;
  WebViewCompat.addWebMessageListener(web,"LambertNativeAudio",Collections.singleton("https://appassets.androidplatform.net"),(view,message,origin,mainFrame,proxy)->{
   if(!mainFrame||message.getData()==null||message.getData().length()>300000)return;
   reply=proxy;
   try{JSONObject command=new JSONObject(message.getData());if(controller==null){connect(command);}else execute(command);}catch(Exception ignored){error();}
  });
  handler.post(tick);
 }
 private void connect(JSONObject command){
  if(commands.size()>=32){error();return;}commands.add(command);if(pending!=null)return;
  pending=new MediaController.Builder(activity,new SessionToken(activity,new ComponentName(activity,AudioPlaybackService.class))).buildAsync();
  pending.addListener(()->{try{controller=pending.get();controller.addListener(new Player.Listener(){@Override public void onPlayerError(androidx.media3.common.PlaybackException failure){error();}@Override public void onEvents(Player p,Player.Events events){emit();}});while(!commands.isEmpty())execute(commands.remove());}catch(Exception ignored){commands.clear();error();}finally{pending=null;}},commandTask->handler.post(commandTask));
 }
 private boolean signed(Uri u){return "https".equals(u.getScheme())&&u.getUserInfo()==null&&(u.getPort()==-1||u.getPort()==443)&&u.getHost()!=null&&u.getHost().matches("[a-z0-9-]+\\.supabase\\.co")&&u.getPath()!=null&&u.getPath().startsWith("/storage/v1/object/sign/lambert-audio-private/");}
 private void execute(JSONObject c){try{
  String action=c.getString("action");
  switch(action){
   case "load":{
    JSONArray list=c.getJSONArray("items");if(list.length()<1||list.length()>200)throw new Exception();ArrayList<MediaItem> items=new ArrayList<>();String user=c.getString("userId");if(!user.matches("[a-f0-9-]{36}"))throw new Exception();
    for(int i=0;i<list.length();i++){
     JSONObject t=list.getJSONObject(i);String id=t.getString("id");if(!id.matches("[a-f0-9-]{36}"))throw new Exception();Uri uri=Uri.parse(t.getString("url"));if(!signed(uri))throw new Exception();
     if(!uri.getPath().startsWith("/storage/v1/object/sign/lambert-audio-private/"+user+"/"))throw new Exception();Bundle extras=new Bundle();extras.putLong("position",Math.max(0,t.optLong("position",0)));extras.putLong("updatedAt",t.optLong("updatedAt",0));
     items.add(new MediaItem.Builder().setMediaId(user+":"+id).setUri(uri).setMediaMetadata(new MediaMetadata.Builder().setTitle(t.getString("title")).setArtist("Lambert · 英语学习").setExtras(extras).build()).build());
    }
    controller.pause();controller.setMediaItems(items,c.optInt("index",0),Math.max(0,c.optLong("position",0)));controller.setPlaybackSpeed((float)c.optDouble("rate",1));controller.prepare();if(c.optBoolean("autoplay"))controller.play();break;
   }
   case "play":controller.play();break;
   case "pause":controller.pause();break;
   case "back":{int seconds=c.getInt("seconds");if(seconds!=3&&seconds!=7)throw new Exception();controller.seekTo(Math.max(0,controller.getCurrentPosition()-seconds*1000L));break;}
   case "seek":controller.seekTo(Math.max(0,c.getLong("position")));break;
   case "rate":{double r=c.getDouble("rate");if(r!=.75&&r!=1&&r!=1.25&&r!=1.5&&r!=2)throw new Exception();controller.setPlaybackSpeed((float)r);break;}
   case "repeat":controller.setRepeatMode(c.optBoolean("one")?Player.REPEAT_MODE_ONE:Player.REPEAT_MODE_OFF);break;
   case "next":if(controller.hasNextMediaItem())controller.seekToNextMediaItem();break;
   case "previous":if(controller.hasPreviousMediaItem())controller.seekToPreviousMediaItem();break;
   case "stop":controller.pause();controller.stop();controller.clearMediaItems();break;
   case "state":break;
   default:throw new Exception();
  }
  emit();
 }catch(Exception ignored){error();}}
 private void error(){if(reply!=null)try{reply.postMessage("{\"error\":\"native_audio_failed\"}");}catch(Exception ignored){}}
 private void emit(){if(reply==null||controller==null)return;try{
  JSONObject data=new JSONObject();MediaItem item=controller.getCurrentMediaItem();data.put("mediaId",item==null?"":item.mediaId);data.put("position",controller.getCurrentPosition());data.put("duration",Math.max(0,controller.getDuration()));data.put("playing",controller.getPlayWhenReady()&&controller.getPlaybackState()!=Player.STATE_ENDED);data.put("rate",controller.getPlaybackParameters().speed);data.put("ended",controller.getPlaybackState()==Player.STATE_ENDED);data.put("repeatOne",controller.getRepeatMode()==Player.REPEAT_MODE_ONE);reply.postMessage(data.toString());
 }catch(Exception ignored){}}
 void close(){handler.removeCallbacksAndMessages(null);reply=null;if(pending!=null)MediaController.releaseFuture(pending);if(controller!=null)controller.release();}
}
