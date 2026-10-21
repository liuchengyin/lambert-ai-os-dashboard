package app.lambert.tasks;
import java.io.*;import java.nio.file.*;import java.util.*;import java.util.zip.*;
public final class BundleStoreTest {
 static void ok(boolean value,String message){if(!value)throw new AssertionError(message);}
 static byte[] bundle(String extra) throws Exception {ByteArrayOutputStream out=new ByteArrayOutputStream();try(ZipOutputStream z=new ZipOutputStream(out)){for(String name:new String[]{"mobile/index.html","mobile/app.js","mobile/store.js","shared-sync/bootstrap.mjs","shared-sync/storage-bridge.js","shared-sync/account-ui.mjs"}){z.putNextEntry(new ZipEntry(name));z.write((name+extra).getBytes());z.closeEntry();}if(extra.startsWith("bad:")){z.putNextEntry(new ZipEntry(extra.substring(4)));z.write("x".getBytes());z.closeEntry();}}return out.toByteArray();}
 static void reject(BundleStore s,byte[] bytes,String sha,long release) throws Exception {try{s.install(bytes,sha,release);throw new AssertionError("should reject");}catch(IOException expected){}}
 public static void main(String[] args) throws Exception {
  File parent=Files.createTempDirectory("lambert-update-test").toFile(),sentinel=new File(parent,"account-data");Files.write(sentinel.toPath(),"do not touch".getBytes());File root=new File(parent,"updates");BundleStore store=new BundleStore(root);store.shell(17);store.begin();ok(store.file("mobile/index.html")==null,"initial packaged assets");
  byte[] a=bundle("version-a"),b=bundle("version-b"),c=bundle("version-c");String sa=BundleStore.digest(a),sb=BundleStore.digest(b),sc=BundleStore.digest(c);
  reject(store,a,"0".repeat(64),1);ok(store.active().isEmpty(),"bad hash cannot activate");
  ok(store.install(a,sa,1),"download staged");ok(store.active().isEmpty()&&store.pending(),"download cannot replace live pages");
  store=new BundleStore(root);store.shell(17);store.begin();ok(store.active().equals(sa)&&store.probation(),"next launch activates pending");store.healthy();ok(!store.probation(),"ack boot");
  store.install(b,sb,2);store.begin();ok(store.active().equals(sb),"activate b");store.rollback();ok(store.active().equals(sa),"failed boot restores a");ok(!store.wants(sb,2),"rejected digest not retried");ok(!store.install(a,sa,1),"old release ignored");
  store.install(c,sc,3);store.begin();store=new BundleStore(root);store.begin();ok(store.active().equals(sa),"process death before boot ack rolls back");
  for(String entry:new String[]{"../account-data","mobile/../../account-data","mobile/tool.exe","shared-sync/tooling/evil.js","mobile/updates/evil.js","mobile//evil.js"}){byte[] bad=bundle("bad:"+entry);reject(store,bad,BundleStore.digest(bad),5);}
  byte[] incomplete;ByteArrayOutputStream out=new ByteArrayOutputStream();try(ZipOutputStream z=new ZipOutputStream(out)){z.putNextEntry(new ZipEntry("mobile/index.html"));z.write("partial".getBytes());z.closeEntry();}incomplete=out.toByteArray();reject(store,incomplete,BundleStore.digest(incomplete),5);
  byte[] replacement=bundle("orphan-recovery");String sr=BundleStore.digest(replacement);File orphan=new File(root,sr+"/mobile");Files.createDirectories(orphan.toPath());Files.write(new File(orphan,"index.html").toPath(),"corrupt orphan".getBytes());
  store.install(replacement,sr,6);store.begin();ok(Files.readString(store.file("mobile/index.html").toPath()).equals("mobile/index.htmlorphan-recovery"),"orphan directory replaced by verified stage");store.healthy();ok(!store.wants(sr,7),"never replace a running bundle directory");
  ok(Files.readString(sentinel.toPath()).equals("do not touch"),"storage outside updates unchanged");store.shell(18);ok(store.active().isEmpty(),"new shell starts from bundled pages");ok(Files.readString(sentinel.toPath()).equals("do not touch"),"shell upgrade preserves account data");
  System.out.println("BundleStore: hash, staged activation, failed boot, interrupted boot, downgrade, unsafe ZIP paths, incomplete bundles and data preservation passed");
 }
}
