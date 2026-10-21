package app.lambert.tasks;

import java.io.*;
import java.nio.file.*;
import java.security.*;
import java.util.*;
import java.util.zip.*;

/** Page bundles only. This directory never contains WebView databases or account storage. */
public final class BundleStore {
 public static final int MAX_ZIP=8*1024*1024, MAX_CONTENT=20*1024*1024;
 private final File root;
 private Properties state;
 public BundleStore(File root) throws IOException {this.root=root;Files.createDirectories(root.toPath());state=new Properties();File f=new File(root,"state.properties");if(f.isFile())try(InputStream in=new FileInputStream(f)){state.load(in);}}
 private String get(String key){return state.getProperty(key,"");}
 private void save() throws IOException {File tmp=new File(root,"state.tmp");try(FileOutputStream out=new FileOutputStream(tmp)){state.store(out,"Lambert page updates");out.getFD().sync();}move(tmp,new File(root,"state.properties"));}
 private static void move(File from,File to) throws IOException {try{Files.move(from.toPath(),to.toPath(),StandardCopyOption.ATOMIC_MOVE,StandardCopyOption.REPLACE_EXISTING);}catch(AtomicMoveNotSupportedException e){Files.move(from.toPath(),to.toPath(),StandardCopyOption.REPLACE_EXISTING);}}
 public synchronized void shell(int version) throws IOException {if(!get("shell").equals(String.valueOf(version))){state.clear();state.setProperty("shell",String.valueOf(version));save();clean();}}
 public synchronized long highestRelease(){return Math.max(number("release"),number("readyRelease"));}
 private long number(String key){try{return Long.parseLong(get(key));}catch(NumberFormatException e){return 0;}}
 public synchronized boolean wants(String sha,long release){return sha.matches("[a-f0-9]{64}")&&release>highestRelease()&&!sha.equals(get("rejected"))&&!sha.equals(get("active"))&&!sha.equals(get("ready"))&&!sha.equals(get("previous"));}
 public synchronized boolean pending(){return !get("ready").isEmpty();}
 public synchronized String active(){return get("active");}
 public synchronized boolean probation(){return get("booting").equals("true");}
 public synchronized boolean begin() throws IOException {
  boolean rolledBack=false;if(probation()){rollback();rolledBack=true;}
  if(pending()){
   String next=get("ready");if(!new File(root,next+"/mobile/index.html").isFile()){state.remove("ready");state.remove("readyRelease");save();return rolledBack;}
   state.setProperty("previous",get("active"));state.setProperty("previousRelease",get("release"));state.setProperty("active",next);state.setProperty("release",get("readyRelease"));state.remove("ready");state.remove("readyRelease");state.setProperty("booting","true");save();
  }
  clean();return rolledBack;
 }
 public synchronized void healthy() throws IOException {state.remove("booting");save();}
 public synchronized void rollback() throws IOException {state.setProperty("rejected",get("active"));state.setProperty("active",get("previous"));state.setProperty("release",get("previousRelease"));state.remove("booting");state.remove("previous");state.remove("previousRelease");save();clean();}
 public synchronized File file(String path) throws IOException {
  if(active().isEmpty())return null;if(!allowed(path))throw new IOException("invalid_asset");File folder=new File(root,active()),f=new File(folder,path);
  if(!f.getCanonicalPath().startsWith(folder.getCanonicalPath()+File.separator)||!f.isFile())throw new IOException("missing_asset");return f;
 }
 private static boolean allowed(String path){return path.matches("(?:mobile|shared-sync)/[A-Za-z0-9_./-]+\\.(?:html|js|mjs|css|json|svg|png|webp|jpg|jpeg|ico|woff2?)")&&!path.contains("..")&&!path.contains("//")&&!path.startsWith("mobile/updates/")&&!path.startsWith("shared-sync/tooling/");}
 public static String digest(byte[] bytes) throws IOException {try{byte[] hash=MessageDigest.getInstance("SHA-256").digest(bytes);StringBuilder s=new StringBuilder();for(byte b:hash)s.append(String.format(Locale.ROOT,"%02x",b&255));return s.toString();}catch(NoSuchAlgorithmException e){throw new IOException(e);}}
 public synchronized boolean install(byte[] zip,String sha,long release) throws IOException {
  if(!wants(sha,release))return false;if(zip.length>MAX_ZIP||!digest(zip).equals(sha))throw new IOException("invalid_digest");
  File stage=new File(root,"stage-"+UUID.randomUUID());Files.createDirectory(stage.toPath());
  try{
   Set<String> names=new HashSet<>();long total=0;int count=0;
   try(ZipInputStream in=new ZipInputStream(new ByteArrayInputStream(zip))){ZipEntry e;byte[] buf=new byte[8192];while((e=in.getNextEntry())!=null){String name=e.getName();if(e.isDirectory()||!allowed(name)||!names.add(name)||++count>200)throw new IOException("invalid_entry");
     File dest=new File(stage,name);if(!dest.getCanonicalPath().startsWith(stage.getCanonicalPath()+File.separator))throw new IOException("invalid_path");Files.createDirectories(dest.getParentFile().toPath());
     try(OutputStream out=new FileOutputStream(dest)){int n;while((n=in.read(buf))!=-1){total+=n;if(total>MAX_CONTENT)throw new IOException("bundle_too_large");out.write(buf,0,n);}}in.closeEntry();}}
   for(String required:new String[]{"mobile/index.html","mobile/app.js","mobile/store.js","shared-sync/bootstrap.mjs","shared-sync/storage-bridge.js","shared-sync/account-ui.mjs"})if(!names.contains(required))throw new IOException("incomplete_bundle");
   File destination=new File(root,sha);if(destination.exists())remove(destination);move(stage,destination);
   state.setProperty("ready",sha);state.setProperty("readyRelease",String.valueOf(release));save();clean();return true;
  }finally{remove(stage);}
 }
 private void clean() throws IOException {File[] files=root.listFiles();if(files==null)return;for(File f:files)if(f.isDirectory()&&!f.getName().equals(get("active"))&&!f.getName().equals(get("previous"))&&!f.getName().equals(get("ready")))remove(f);}
 private static void remove(File f) throws IOException {if(!f.exists())return;if(Files.isSymbolicLink(f.toPath())){Files.delete(f.toPath());return;}if(f.isDirectory()){File[] list=f.listFiles();if(list!=null)for(File x:list)remove(x);}Files.deleteIfExists(f.toPath());}
}
