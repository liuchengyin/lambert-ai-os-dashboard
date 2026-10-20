package app.lambert.tasks;
import android.webkit.WebView;
import android.view.*;
import androidx.test.core.app.ActivityScenario;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicReference;

@RunWith(AndroidJUnit4.class)
public class CloudAccountTest {
 private WebView web;
 private WebView find(View v){if(v instanceof WebView)return (WebView)v;if(v instanceof ViewGroup){ViewGroup g=(ViewGroup)v;for(int i=0;i<g.getChildCount();i++){WebView w=find(g.getChildAt(i));if(w!=null)return w;}}return null;}
 private String js(String code)throws Exception{CountDownLatch latch=new CountDownLatch(1);AtomicReference<String> value=new AtomicReference<>();InstrumentationRegistry.getInstrumentation().runOnMainSync(()->web.evaluateJavascript(code,x->{value.set(x);latch.countDown();}));assertTrue("JS callback",latch.await(5,TimeUnit.SECONDS));return value.get();}
 private void waitFor(String condition)throws Exception{for(int i=0;i<160;i++){if("true".equals(js(condition)))return;Thread.sleep(250);}fail("Timed out: "+condition+" state="+js("JSON.stringify({url:location.href,body:document.body.innerText,config:localStorage.getItem('lambert_public_config_v1')})"));}
 @Test public void bundledAccountReadsProductionConfigAndRetainsOfflineGuest()throws Exception{
  try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
   scenario.onActivity(a->web=find(a.getWindow().getDecorView()));assertNotNull(web);
   waitFor("!!window.LambertAccount");
   waitFor("JSON.parse(localStorage.getItem('lambert_public_config_v1')||'{}').configured===true");
   js("window.LambertAccount.open();true");
   waitFor("!!document.querySelector('.lambert-account input[type=email]')");
   assertEquals("Registration code assets render on actual Android","true",js("(()=>{const b=[...document.querySelectorAll('.lambert-account button')].find(b=>b.textContent==='注册账号');b.click();return [...document.querySelectorAll('.lambert-account button')].some(b=>b.textContent==='发送验证码')&&!document.querySelector('.lambert-account input[type=password]')})()"));
   assertEquals("No implicit activation","null",js("localStorage.getItem('lambert_active_account_v1')"));
   js("localStorage.setItem('lambert_cloud_smoke_original',localStorage.getItem('tasks')||'[]');localStorage.setItem('tasks',JSON.stringify([{id:'cloud-offline-smoke',title:'offline retained',status:'进行中'}]));true");
   scenario.onActivity(a->web.getSettings().setBlockNetworkLoads(true));js("location.reload();true");
   waitFor("!!window.LambertAccount");waitFor("!!document.querySelector('#tabs button')");
   assertEquals("Offline guest retained","true",js("JSON.parse(localStorage.tasks).some(t=>t.id==='cloud-offline-smoke')"));
   js("localStorage.setItem('tasks',localStorage.getItem('lambert_cloud_smoke_original'));localStorage.removeItem('lambert_cloud_smoke_original');true");
  }
 }
}
