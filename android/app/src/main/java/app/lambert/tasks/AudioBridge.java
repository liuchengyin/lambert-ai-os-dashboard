package app.lambert.tasks;
import android.app.Activity;
import android.content.Intent;
import android.webkit.JavascriptInterface;
import org.json.JSONObject;

/** Only attached to the local WebView; no remote frames or navigation are allowed. */
final class AudioBridge {
 private final Activity activity;private final AudioFiles files;
 AudioBridge(Activity a){activity=a;files=new AudioFiles(a);}
 @JavascriptInterface public void setOwner(String owner){if(!AudioFiles.validOwner(owner))return;files.owner(owner);activity.runOnUiThread(()->AudioPlaybackService.changeOwner(owner));}
 @JavascriptInterface public boolean hasFile(String owner,String id){try{return files.file(owner,id).isFile();}catch(Exception e){return false;}}
 @JavascriptInterface public String beginImport(String owner,String id,long size){try{return files.begin(owner,id,size);}catch(Exception e){return "";}}
 @JavascriptInterface public boolean appendImport(String owner,String token,String chunk){return files.append(owner,token,chunk);}
 @JavascriptInterface public boolean finishImport(String owner,String token){return files.finish(owner,token);}
 @JavascriptInterface public void cancelImport(String owner,String token){files.cancel(owner,token);}
 @JavascriptInterface public String state(String owner){if(!files.matches(owner))return "{}";try{JSONObject s=new JSONObject(AudioPlaybackService.snapshot);return owner.equals(s.optString("owner"))?s.toString():"{}";}catch(Exception e){return "{}";}}
 @JavascriptInterface public String progress(String owner,String id){if(!files.matches(owner)||!AudioFiles.validId(id))return "{}";return activity.getSharedPreferences("audio-progress",Activity.MODE_PRIVATE).getString(owner+":"+id,"{}");}
 @JavascriptInterface public void command(String value){if(value==null||value.length()>100000)return;try{JSONObject q=new JSONObject(value);long epoch=files.epoch();String owner=q.getString("owner"),action=q.getString("action");if(!files.matches(owner)||!action.matches("play|pause|stop|seek|rate|loop"))return;activity.runOnUiThread(()->{if(!files.matches(owner)||epoch!=files.epoch()||activity.isFinishing()||activity.isDestroyed())return;try{q.put("epoch",AudioPlaybackService.selectedEpoch);}catch(Exception e){return;}Intent intent=new Intent(activity,AudioPlaybackService.class).putExtra("command",q.toString());if(AudioPlaybackService.active==null&&!"play".equals(action))return;try{activity.startService(intent);}catch(Exception ignored){}});}catch(Exception ignored){}}
 void close(){files.cancelAll();}
}
