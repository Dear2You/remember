package com.nianxiatian.app;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;

/** Host JVM regression for the write/verify/publish sequence; no device storage is accessed. */
public class RollingBackupTest {
    private static class Slot implements RollingBackup.Slot {
        byte[] bytes;
        String failure = "";
        boolean published;
        int writes;

        Slot(byte[] existing) { bytes = existing; published = existing != null; }
        public boolean complete() { return published; }
        public OutputStream stage() {
            writes++;
            published = false;
            return new ByteArrayOutputStream() {
                @Override public void close() throws IOException {
                    bytes = toByteArray();
                    if (failure.equals("space")) {
                        bytes = Arrays.copyOf(bytes, 2);
                        throw new IOException("simulated full disk");
                    }
                }
            };
        }
        public InputStream readStaged() {
            if (failure.equals("truncate")) return new ByteArrayInputStream(Arrays.copyOf(bytes, 3));
            if (failure.equals("corrupt")) bytes[0] ^= 1;
            return new ByteArrayInputStream(bytes);
        }
        public void publish() throws IOException {
            if (failure.equals("publish")) throw new IOException("simulated provider failure");
            published = true;
        }
    }

    private static void check(boolean condition) {
        if (!condition) throw new AssertionError();
    }

    public static void main(String[] args) throws Exception {
        byte[] old = "previous JSON".getBytes(StandardCharsets.UTF_8);
        byte[] next = "next valid JSON".getBytes(StandardCharsets.UTF_8);
        for (String failure : new String[]{"space", "truncate", "corrupt", "publish"}) {
            Slot legacy = new Slot(old), second = new Slot(null);
            second.failure = failure;
            try {
                RollingBackup.save(legacy,second,true,next);
                throw new AssertionError("failure was not reported");
            } catch (IOException expected) { /* The previous public file remains intact. */ }
            check(legacy.complete() && Arrays.equals(legacy.bytes,old) && legacy.writes == 0 && !second.complete());
            second.failure = "";
            check(RollingBackup.save(legacy,second,true,next) == second && second.complete() && Arrays.equals(second.bytes,next));
            check(RollingBackup.save(legacy,second,false,old) == legacy && Arrays.equals(second.bytes,next));
        }
        Slot emptyA = new Slot(null), emptyB = new Slot(null);
        check(RollingBackup.save(emptyA,emptyB,false,next) == emptyA);
        check(RollingBackup.save(new Slot(null),emptyA,true,old) != emptyA && Arrays.equals(emptyA.bytes,next));
        System.out.println("Local backup slot selection, failed writes, verification and retry passed.");
    }
}
