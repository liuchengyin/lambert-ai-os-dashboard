package app.lambert.tasks;

import android.content.*;
import android.media.*;
import android.net.Uri;
import androidx.media3.common.*;
import androidx.media3.session.*;
import androidx.test.core.app.ActivityScenario;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;
import java.io.*;
import java.nio.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.BooleanSupplier;

@RunWith(AndroidJUnit4.class)
public class AudioPlaybackTest {
 private MediaController player;
 private void main(Runnable action){InstrumentationRegistry.getInstrumentation().runOnMainSync(action);}
 private boolean value(BooleanSupplier check){AtomicReference<Boolean> result=new AtomicReference<>(false);main(()->result.set(check.getAsBoolean()));return result.get();}
 private void await(String message,BooleanSupplier check)throws Exception{for(int i=0;i<80;i++){if(value(check))return;Thread.sleep(100);}fail(message);}
 private void shell(String command)throws Exception{try(android.os.ParcelFileDescriptor fd=InstrumentationRegistry.getInstrumentation().getUiAutomation().executeShellCommand(command);InputStream in=new FileInputStream(fd.getFileDescriptor())){while(in.read()!=-1){}}}
 private File fixture(Context context)throws Exception{
  File file=new File(context.getFilesDir(),"audio-instrumentation.wav");int samples=16000*45;ByteBuffer header=ByteBuffer.allocate(44).order(ByteOrder.LITTLE_ENDIAN);header.put("RIFF".getBytes()).putInt(36+samples*2).put("WAVEfmt ".getBytes()).putInt(16).putShort((short)1).putShort((short)1).putInt(16000).putInt(32000).putShort((short)2).putShort((short)16).put("data".getBytes()).putInt(samples*2);
  try(FileOutputStream out=new FileOutputStream(file)){out.write(header.array());ByteBuffer pcm=ByteBuffer.allocate(samples*2).order(ByteOrder.LITTLE_ENDIAN);for(int i=0;i<samples;i++)pcm.putShort((short)(Math.sin(i*2*Math.PI*220/16000)*1000));out.write(pcm.array());}return file;
 }
 @Test public void nativeBackgroundLockScreenAndInterruptions()throws Exception{
  Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();File wav=fixture(context);
  try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
   AtomicReference<com.google.common.util.concurrent.ListenableFuture<MediaController>> future=new AtomicReference<>();main(()->future.set(new MediaController.Builder(context,new SessionToken(context,new ComponentName(context,AudioPlaybackService.class))).buildAsync()));player=future.get().get(15,TimeUnit.SECONDS);
   main(()->{player.setMediaItem(new MediaItem.Builder().setMediaId("instrumentation:lesson").setUri(Uri.fromFile(wav)).setMediaMetadata(new androidx.media3.common.MediaMetadata.Builder().setTitle("Audio test lesson").build()).build());player.prepare();player.play();});
   await("Native file must actually play",()->player.isPlaying()&&player.getCurrentPosition()>300);
   main(()->{player.pause();player.seekTo(20000);player.seekTo(Math.max(0,player.getCurrentPosition()-3000));player.seekTo(Math.max(0,player.getCurrentPosition()-7000));});
   assertTrue("3s + 7s cumulative seek while paused",value(()->Math.abs(player.getCurrentPosition()-10000)<250&&!player.getPlayWhenReady()));
   main(()->player.play());await("Resume",()->player.isPlaying());
   shell("input keyevent KEYCODE_HOME");Thread.sleep(1200);assertTrue("Background playback continues",value(()->player.isPlaying()&&player.getCurrentPosition()>10500));
   shell("input keyevent KEYCODE_SLEEP");Thread.sleep(1200);assertTrue("Screen-off playback continues",value(()->player.isPlaying()));
   String sessions;try(android.os.ParcelFileDescriptor fd=InstrumentationRegistry.getInstrumentation().getUiAutomation().executeShellCommand("dumpsys media_session");InputStream in=new FileInputStream(fd.getFileDescriptor())){sessions=new String(in.readAllBytes());}
   assertTrue("Lock-screen session contains current title",sessions.contains("Audio test lesson"));
   shell("input keyevent KEYCODE_MEDIA_PAUSE");await("System media pause",()->!player.getPlayWhenReady());shell("input keyevent KEYCODE_MEDIA_PLAY");await("System media play",()->player.isPlaying());
   shell("input keyevent KEYCODE_WAKEUP");shell("wm dismiss-keyguard");
   AudioManager manager=(AudioManager)context.getSystemService(Context.AUDIO_SERVICE);AudioFocusRequest focus=new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT).setAudioAttributes(new android.media.AudioAttributes.Builder().setUsage(android.media.AudioAttributes.USAGE_VOICE_COMMUNICATION).build()).setOnAudioFocusChangeListener(change->{}).build();
   assertEquals("Interruption obtains focus",AudioManager.AUDIOFOCUS_REQUEST_GRANTED,manager.requestAudioFocus(focus));await("Transient interruption pauses sound",()->!player.isPlaying());manager.abandonAudioFocusRequest(focus);await("Playback resumes after transient focus loss",()->player.isPlaying());
   shell("am broadcast -a android.media.AUDIO_BECOMING_NOISY");await("Headset disconnect pauses playback",()->!player.getPlayWhenReady());
   assertEquals("No microphone permission in first stage",android.content.pm.PackageManager.PERMISSION_DENIED,context.checkSelfPermission(android.Manifest.permission.RECORD_AUDIO));
  }finally{if(player!=null)main(()->{player.stop();player.clearMediaItems();player.release();});wav.delete();}
 }
}
