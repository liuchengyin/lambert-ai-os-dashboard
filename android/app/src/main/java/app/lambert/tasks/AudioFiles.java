package app.lambert.tasks;
import android.content.Context;
import java.io.*;
import java.util.*;

/** App-private files only. No arbitrary path, URL, or external storage access. */
final class AudioFiles {
 static final long MAX=200L*1024*1024;
 private final File root;
 private final Map<String,Pending> pending=new HashMap<>();
 private String owner="guest";private long epoch;
 synchronized long epoch(){return epoch;}
 private static final class Pending {String owner,id;long expected,written;File file;FileOutputStream out;}
 AudioFiles(Context c){root=new File(c.getFilesDir(),"learning-audio");}
 static boolean validOwner(String s){return "guest".equals(s)||s!=null&&s.matches("[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}");}
 static boolean validId(String s){return s!=null&&s.matches("[a-fA-F0-9-]{36}");}
 synchronized void owner(String next){if(!validOwner(next))throw new IllegalArgumentException();if(!owner.equals(next)){cancelAll();owner=next;epoch++;}}
 synchronized boolean matches(String value){return owner.equals(value);}
 synchronized File file(String value,String id){if(!matches(value)||!validId(id))throw new IllegalArgumentException();return new File(new File(root,owner),id+".audio");}
 synchronized String begin(String value,String id,long size)throws IOException{
  if(!matches(value)||size<=0||size>MAX||pending.size()>=1)throw new IOException("invalid_import");
  File target=file(value,id);if(target.exists())throw new IOException("already_exists");File dir=target.getParentFile();if(!dir.exists()&&!dir.mkdirs())throw new IOException("storage_unavailable");
  File[] stale=dir.listFiles((d,n)->n.endsWith(".part"));if(stale!=null)for(File f:stale)f.delete();
  File[] files=dir.listFiles((d,n)->n.endsWith(".audio"));long total=0;if(files!=null)for(File f:files)total+=f.length();if(total+size>4L*1024*1024*1024)throw new IOException("audio_quota");
  if(files!=null&&files.length>=200)throw new IOException("audio_limit");
  if(dir.getUsableSpace()<size+8L*1024*1024)throw new IOException("storage_full");
  Pending p=new Pending();p.owner=value;p.id=id;p.expected=size;p.file=new File(dir,id+".part");p.out=new FileOutputStream(p.file);String token=UUID.randomUUID().toString();pending.put(token,p);return token;
 }
 synchronized boolean append(String value,String token,String base64){Pending p=pending.get(token);if(p==null||!matches(value)||!p.owner.equals(value)||base64==null||base64.length()>140000)return false;try{byte[] b=android.util.Base64.decode(base64,android.util.Base64.NO_WRAP);if(p.written+b.length>p.expected)throw new IOException();p.out.write(b);p.written+=b.length;return true;}catch(Exception e){cancel(value,token);return false;}}
 synchronized boolean finish(String value,String token){Pending p=pending.get(token);if(p==null||!matches(value)||!p.owner.equals(value))return false;try{if(p.written!=p.expected)throw new IOException();p.out.getFD().sync();p.out.close();File target=file(value,p.id);if(target.exists()||!p.file.renameTo(target))throw new IOException();pending.remove(token);return true;}catch(Exception e){cancel(value,token);return false;}}
 synchronized void cancel(String value,String token){Pending p=pending.get(token);if(p==null||!p.owner.equals(value))return;pending.remove(token);try{p.out.close();}catch(IOException ignored){}p.file.delete();}
 synchronized void cancelAll(){for(Pending p:pending.values()){try{p.out.close();}catch(IOException ignored){}p.file.delete();}pending.clear();}
}
