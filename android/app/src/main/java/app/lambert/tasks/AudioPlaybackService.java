package app.lambert.tasks;
import android.content.*;
import android.os.*;
import androidx.media3.common.*;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.session.*;
import org.json.*;
import java.io.File;
import java.util.*;

/** Media3 owns the notification, media session, audio focus and foreground lifecycle. */
public final class AudioPlaybackService extends MediaSessionService {
 static volatile String snapshot="{}";
 static volatile AudioPlaybackService active;
 static volatile String selectedOwner="guest";static volatile long selectedEpoch;
 private ExoPlayer player;private MediaSession session;private String owner="guest",loop="single",error="";
 private double a=-1,b=-1;private long lastSaved=0;private final Handler timer=new Handler(Looper.getMainLooper());
 private final Runnable tick=new Runnable(){public void run(){if(player==null)return;try{if("ab".equals(loop)&&b>a&&a>=0&&player.isPlaying()&&player.getCurrentPosition()>=b*1000)player.seekTo((long)(a*1000));publish();}catch(Exception ignored){}timer.postDelayed(this,250);}};
 @Override public void onCreate(){super.onCreate();active=this;player=new ExoPlayer.Builder(this).build();player.setAudioAttributes(new AudioAttributes.Builder().setUsage(C.USAGE_MEDIA).setContentType(C.AUDIO_CONTENT_TYPE_SPEECH).build(),true);player.setHandleAudioBecomingNoisy(true);player.setWakeMode(C.WAKE_MODE_LOCAL);
  session=new MediaSession.Builder(this,player).build();
  player.addListener(new Player.Listener(){@Override public void onPlayerError(PlaybackException e){error="音频无法播放，请检查格式或重新导入。";publish();}@Override public void onIsPlayingChanged(boolean playing){publish();}@Override public void onMediaItemTransition(MediaItem item,int reason){publish();}@Override public void onPlaybackStateChanged(int state){publish();}});
  timer.post(tick);
 }
 @Override public MediaSession onGetSession(MediaSession.ControllerInfo controller){return session;}
 @Override public int onStartCommand(Intent intent,int flags,int startId){int result=super.onStartCommand(intent,flags,startId);if(intent==null)return result;try{JSONObject q=new JSONObject(intent.getStringExtra("command"));String next=q.getString("owner");if(!AudioFiles.validOwner(next)||!next.equals(selectedOwner)||q.optLong("epoch",-1)!=selectedEpoch)return START_NOT_STICKY;
  String action=q.getString("action");if(!"play".equals(action)&&!owner.equals(next))return START_NOT_STICKY;
  switch(action){
   case "play":start(q,next);break;
   case "pause":player.pause();break;
   case "stop":player.stop();player.clearMediaItems();publish();stopSelf();break;
   case "seek":player.seekTo(Math.max(0,Math.min(player.getDuration()>0?player.getDuration():Long.MAX_VALUE,(long)(q.optDouble("position",0)*1000))));break;
   case "rate":player.setPlaybackSpeed((float)Math.max(.5,Math.min(2,q.optDouble("rate",1))));break;
   case "loop":setLoop(q);break;
  }
  publish();
 }catch(Exception e){error="后台播放器未能启动，请重新点击播放。";publish();}return START_NOT_STICKY;}
 private void start(JSONObject q,String next)throws Exception{
  if(!owner.equals(next)){player.stop();player.clearMediaItems();owner=next;}error="";String id=q.getString("id");if(!AudioFiles.validId(id))throw new IllegalArgumentException();
  JSONArray rows=q.getJSONArray("queue");if(rows.length()==0||rows.length()>200)throw new IllegalArgumentException();List<MediaItem> items=new ArrayList<>();int index=-1;
  for(int i=0;i<rows.length();i++){JSONObject row=rows.getJSONObject(i);String key=row.getString("id");if(!AudioFiles.validId(key))throw new IllegalArgumentException();File f=new File(new File(new File(getFilesDir(),"learning-audio"),owner),key+".audio");if(!f.isFile())continue;if(key.equals(id))index=items.size();String title=row.optString("title","音频");if(title.length()>200)title=title.substring(0,200);items.add(new MediaItem.Builder().setMediaId(key).setUri(android.net.Uri.fromFile(f)).setMediaMetadata(new MediaMetadata.Builder().setTitle(title).setArtist("ACHE").build()).build());}
  if(index<0)throw new IllegalArgumentException();
  player.setMediaItems(items,index,(long)(Math.max(0,q.optDouble("position",0))*1000));player.setPlaybackSpeed((float)Math.max(.5,Math.min(2,q.optDouble("rate",1))));setLoop(q);player.prepare();player.play();
 }
 private void setLoop(JSONObject q){loop=q.optString("loop","single");a=q.optDouble("a",-1);b=q.optDouble("b",-1);if("ab".equals(loop)&&(!Double.isFinite(a)||!Double.isFinite(b)||a<0||b-a<.5)){loop="single";a=-1;b=-1;}player.setRepeatMode("all".equals(loop)?Player.REPEAT_MODE_ALL:"single".equals(loop)||"ab".equals(loop)?Player.REPEAT_MODE_ONE:Player.REPEAT_MODE_OFF);}
 private void publish(){if(player==null)return;try{MediaItem item=player.getCurrentMediaItem();String id=item==null?"":item.mediaId;JSONObject s=new JSONObject().put("owner",owner).put("id",id).put("position",Math.max(0,player.getCurrentPosition())/1000.0).put("duration",Math.max(0,player.getDuration())/1000.0).put("rate",player.getPlaybackParameters().speed).put("playing",player.isPlaying()).put("error",error);snapshot=s.toString();long now=SystemClock.elapsedRealtime();if(!id.isEmpty()&&(now-lastSaved>3000||!player.isPlaying())){lastSaved=now;getSharedPreferences("audio-progress",MODE_PRIVATE).edit().putString(owner+":"+id,snapshot).apply();}}catch(JSONException ignored){}}
 static void changeOwner(String owner){selectedOwner=owner;selectedEpoch++;AudioPlaybackService s=active;if(s!=null&&!s.owner.equals(owner)){s.player.stop();s.player.clearMediaItems();snapshot="{}";s.stopSelf();}}
 @Override public void onDestroy(){if(player!=null)player.pause();publish();timer.removeCallbacksAndMessages(null);if(session!=null)session.release();if(player!=null){player.release();player=null;}active=null;super.onDestroy();}
}
