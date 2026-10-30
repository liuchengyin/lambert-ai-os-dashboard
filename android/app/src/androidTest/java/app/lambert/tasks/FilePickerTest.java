package app.lambert.tasks;
import android.content.Intent;
import android.webkit.WebChromeClient;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;
@RunWith(AndroidJUnit4.class)
public class FilePickerTest {
 @Test public void subtitleFilesAreNotFilteredToAudio(){
  for(String t:new String[]{".srt,.vtt,.lrc","text/vtt","application/x-subrip","text/plain"}){Intent i=FilePicker.create(new String[]{t},WebChromeClient.FileChooserParams.MODE_OPEN);assertEquals("*/*",i.getType());assertFalse(i.getBooleanExtra(Intent.EXTRA_ALLOW_MULTIPLE,true));assertEquals(Intent.ACTION_OPEN_DOCUMENT,i.getAction());assertTrue(i.hasCategory(Intent.CATEGORY_OPENABLE));}
 }
 @Test public void audioAllowsMultipleAndUnknownTypesRemainSelectable(){assertEquals("audio/*",FilePicker.create(new String[]{".mp3,.m4a,.wav,audio/mpeg"},1).getType());assertTrue(FilePicker.create(new String[]{"audio/*"},1).getBooleanExtra(Intent.EXTRA_ALLOW_MULTIPLE,false));assertEquals("*/*",FilePicker.create(new String[]{""},0).getType());assertEquals("*/*",FilePicker.create(new String[]{"audio/*",".srt"},0).getType());}
}
