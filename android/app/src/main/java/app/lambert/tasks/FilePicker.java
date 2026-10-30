package app.lambert.tasks;
import android.content.Intent;
import android.webkit.WebChromeClient;
import java.util.Locale;
/** Pick only user-selected documents. Text subtitle providers often report octet-stream. */
final class FilePicker {
 static Intent create(String[] accept,int mode){
  boolean audio=false,other=false;
  if(accept!=null)for(String item:accept){if(item==null)continue;for(String token:item.toLowerCase(Locale.ROOT).split(",")){String t=token.trim();if(t.isEmpty())continue;if(t.startsWith("audio/")||t.matches("\\.(mp3|m4a|wav)"))audio=true;else other=true;}}
  return new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE)
   .setType(audio&&!other?"audio/*":"*/*")
   .putExtra(Intent.EXTRA_ALLOW_MULTIPLE,mode==WebChromeClient.FileChooserParams.MODE_OPEN_MULTIPLE);
 }
}
