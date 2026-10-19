package app.lambert.tasks;
import android.webkit.WebView;
import android.view.*;
import android.view.inputmethod.InputMethodManager;
import android.content.Context;
import androidx.test.core.app.ActivityScenario;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicReference;

@RunWith(AndroidJUnit4.class)
public class KeyboardTest {
 private WebView web;
 private WebView find(View v){if(v instanceof WebView)return (WebView)v;if(v instanceof ViewGroup){ViewGroup g=(ViewGroup)v;for(int i=0;i<g.getChildCount();i++){WebView w=find(g.getChildAt(i));if(w!=null)return w;}}return null;}
 private String js(String code)throws Exception{CountDownLatch latch=new CountDownLatch(1);AtomicReference<String> value=new AtomicReference<>();InstrumentationRegistry.getInstrumentation().runOnMainSync(()->web.evaluateJavascript(code,x->{value.set(x);latch.countDown();}));assertTrue("JS callback",latch.await(5,TimeUnit.SECONDS));return value.get();}
 @Test public void keyboardDoesNotCoverCreationOrHeader()throws Exception{
  try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
   scenario.onActivity(a->web=find(a.getWindow().getDecorView()));assertNotNull(web);
   for(int i=0;i<60&&!"true".equals(js("!!document.querySelector('#tabs button')"));i++)Thread.sleep(250);
   js("document.querySelectorAll('#tabs button')[1].click(); document.querySelector('.task-fab').click(); true");
   scenario.onActivity(a->{web.requestFocus();((InputMethodManager)a.getSystemService(Context.INPUT_METHOD_SERVICE)).showSoftInput(web,InputMethodManager.SHOW_IMPLICIT);});
   boolean visible=false;
   for(int i=0;i<40;i++){AtomicReference<Boolean> v=new AtomicReference<>(false);scenario.onActivity(a->{WindowInsets insets=a.getWindow().getDecorView().getRootWindowInsets();v.set(insets!=null&&insets.isVisible(WindowInsets.Type.ime()));});if(v.get()){visible=true;break;}Thread.sleep(250);}
   assertTrue("Software keyboard must actually open",visible);Thread.sleep(700);
   java.io.File shot=new java.io.File(InstrumentationRegistry.getInstrumentation().getTargetContext().getExternalFilesDir(null),"keyboard.png");
   try(java.io.FileOutputStream out=new java.io.FileOutputStream(shot)){InstrumentationRegistry.getInstrumentation().getUiAutomation().takeScreenshot().compress(android.graphics.Bitmap.CompressFormat.PNG,100,out);}
   scenario.onActivity(a->{int[] location=new int[2];web.getLocationOnScreen(location);WindowInsets insets=a.getWindow().getDecorView().getRootWindowInsets();int bottom=insets.getInsets(WindowInsets.Type.ime()).bottom;assertTrue("WebView above IME",location[1]+web.getHeight()<=a.getWindow().getDecorView().getHeight()-bottom+2);assertTrue("WebView below status bar",location[1]>=insets.getInsets(WindowInsets.Type.statusBars()).top);});
   assertEquals("Input visible above keyboard","true",js("(()=>{const r=document.querySelector('#mobileTaskTitle').getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight})()"));
   assertEquals("Submit accessible above keyboard","true",js("(()=>{const b=document.querySelector('dialog button[type=submit]');b.scrollIntoView({block:'nearest'});const r=b.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight})()"));
   js("document.querySelector('#mobileTaskTitle').value='keyboard test';document.querySelector('dialog form').requestSubmit();true");
   assertEquals("Task saved","true",js("JSON.parse(localStorage.tasks).some(t=>t.title==='keyboard test')"));
  }
 }
}
