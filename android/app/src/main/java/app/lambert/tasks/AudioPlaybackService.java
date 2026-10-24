package app.lambert.tasks;

import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Handler;
import android.os.Looper;
import androidx.media3.common.AudioAttributes;
import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.Player;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.session.MediaSession;
import androidx.media3.session.MediaSessionService;

/** Native owner of audio: survives Activity/WebView backgrounding and supplies lock-screen controls. */
public final class AudioPlaybackService extends MediaSessionService {
 private ExoPlayer player;
 private MediaSession session;
 private SharedPreferences progress;
 private String activeKey;
 private final Handler handler=new Handler(Looper.getMainLooper());
 private final Runnable tick=new Runnable(){public void run(){checkpoint();handler.postDelayed(this,5000);}};
 @Override public void onCreate(){
  super.onCreate();progress=getSharedPreferences("audio-checkpoints-v1",MODE_PRIVATE);
  player=new ExoPlayer.Builder(this).build();
  player.setAudioAttributes(new AudioAttributes.Builder().setUsage(C.USAGE_MEDIA).setContentType(C.AUDIO_CONTENT_TYPE_SPEECH).build(),true);
  player.setHandleAudioBecomingNoisy(true);
  player.addListener(new Player.Listener(){
   @Override public void onMediaItemTransition(MediaItem item,int reason){
    activeKey=item==null?null:item.mediaId;
    if(item!=null&&reason!=Player.MEDIA_ITEM_TRANSITION_REASON_REPEAT){
     long cloudPosition=item.mediaMetadata.extras==null?0:item.mediaMetadata.extras.getLong("position",0);long cloudAt=item.mediaMetadata.extras==null?0:item.mediaMetadata.extras.getLong("updatedAt",0);long resume=progress.getLong(activeKey+":at",0)>cloudAt?progress.getLong(activeKey,cloudPosition):cloudPosition;
     if(resume>0)player.seekTo(resume);
    }
   }
   @Override public void onPositionDiscontinuity(Player.PositionInfo oldPosition,Player.PositionInfo newPosition,int reason){
    if(oldPosition.mediaItem!=null&&reason==Player.DISCONTINUITY_REASON_AUTO_TRANSITION)progress.edit().putLong(oldPosition.mediaItem.mediaId,0).apply();
   }
   @Override public void onIsPlayingChanged(boolean playing){checkpoint();}
  });
  session=new MediaSession.Builder(this,player).build();handler.post(tick);
 }
 private void checkpoint(){if(player!=null&&activeKey!=null&&player.getPlaybackState()!=Player.STATE_IDLE)progress.edit().putLong(activeKey,Math.max(0,player.getCurrentPosition())).putLong(activeKey+":at",System.currentTimeMillis()).putFloat(activeKey+":rate",player.getPlaybackParameters().speed).apply();}
 @Override public MediaSession onGetSession(MediaSession.ControllerInfo controller){
  // Own Activity and trusted system media controllers only; no arbitrary app can inject URLs.
  return controller.getPackageName().equals(getPackageName())||controller.isTrusted()?session:null;
 }
 @Override public void onTaskRemoved(Intent rootIntent){if(!player.getPlayWhenReady()){checkpoint();stopSelf();}}
 @Override public void onDestroy(){handler.removeCallbacksAndMessages(null);checkpoint();if(session!=null)session.release();if(player!=null)player.release();super.onDestroy();}
}
