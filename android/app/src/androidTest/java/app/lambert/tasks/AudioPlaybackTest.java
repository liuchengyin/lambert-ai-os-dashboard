package app.lambert.tasks;
import android.content.*;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.*;
import org.junit.runner.RunWith;
import org.json.JSONObject;
import java.io.*;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class AudioPlaybackTest {
 private static final String ID="11111111-1111-4111-8111-111111111111";
 private static final String B="22222222-2222-4222-8222-222222222222";
 private static byte[] wav()throws Exception{ByteArrayOutputStream out=new ByteArrayOutputStream();DataOutputStream d=new DataOutputStream(out);int bytes=16000*2*12;d.writeBytes("RIFF");le(d,bytes+36,4);d.writeBytes("WAVEfmt ");le(d,16,4);le(d,1,2);le(d,1,2);le(d,16000,4);le(d,32000,4);le(d,2,2);le(d,16,2);d.writeBytes("data");le(d,bytes,4);for(int i=0;i<bytes/2;i++)le(d,(int)(Math.sin(i*2*Math.PI*440/16000)*1000),2);return out.toByteArray();}
 private static void le(DataOutputStream d,int value,int n)throws Exception{for(int i=0;i<n;i++)d.writeByte(value>>i*8);}
 private static void awaitPlaying(boolean expected)throws Exception{long until=System.currentTimeMillis()+10000;while(System.currentTimeMillis()<until){if(new JSONObject(AudioPlaybackService.snapshot).optBoolean("playing")==expected)return;Thread.sleep(100);}fail("unexpected playback state: "+AudioPlaybackService.snapshot);}
 @Test public void backgroundPlaybackAndAccountStop()throws Exception{
  Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();AudioFiles files=new AudioFiles(context);File target=files.file("guest",ID);target.getParentFile().mkdirs();try(FileOutputStream out=new FileOutputStream(target)){out.write(wav());}
  try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
   Thread.sleep(1500);
   scenario.onActivity(a->{try{AudioPlaybackService.changeOwner("guest");JSONObject q=new JSONObject("{\"owner\":\"guest\",\"action\":\"play\",\"id\":\""+ID+"\",\"title\":\"background-test\",\"position\":0,\"rate\":1,\"loop\":\"single\",\"queue\":[{\"id\":\""+ID+"\",\"title\":\"test\"}]}");q.put("epoch",AudioPlaybackService.selectedEpoch);a.startService(new Intent(a,AudioPlaybackService.class).putExtra("command",q.toString()));}catch(Exception e){throw new RuntimeException(e);}});
   awaitPlaying(true);double before=new JSONObject(AudioPlaybackService.snapshot).getDouble("position");
   scenario.onActivity(a->a.moveTaskToBack(true));
   InstrumentationRegistry.getInstrumentation().getUiAutomation().executeShellCommand("input keyevent KEYCODE_SLEEP").close();
   Thread.sleep(2500);JSONObject after=new JSONObject(AudioPlaybackService.snapshot);assertTrue(after.toString(),after.getBoolean("playing"));assertTrue(after.getDouble("position")>before+1);
   InstrumentationRegistry.getInstrumentation().runOnMainSync(()->AudioPlaybackService.changeOwner(B));awaitPlaying(false);
  }finally{InstrumentationRegistry.getInstrumentation().getUiAutomation().executeShellCommand("input keyevent KEYCODE_WAKEUP").close();target.delete();}
 }
 @Test public void importIsAtomicAndOwnerScoped()throws Exception{
  Context c=InstrumentationRegistry.getInstrumentation().getTargetContext();AudioFiles files=new AudioFiles(c);String id="33333333-3333-4333-8333-333333333333";File target=files.file("guest",id);target.delete();String token=files.begin("guest",id,4);assertTrue(files.append("guest",token,"AQI="));assertFalse(files.finish("guest",token));assertFalse(target.exists());token=files.begin("guest",id,4);assertTrue(files.append("guest",token,"AQIDBA=="));files.owner(B);assertFalse(files.finish("guest",token));assertFalse(target.exists());assertFalse(files.file(B,id).exists());
 }
}
