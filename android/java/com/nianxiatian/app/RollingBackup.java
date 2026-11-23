package com.nianxiatian.app;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;

/** The last published copy is never opened for writing while its replacement is staged. */
final class RollingBackup {
    interface Slot {
        boolean complete();
        OutputStream stage() throws IOException;
        InputStream readStaged() throws IOException;
        void publish() throws IOException;
    }

    static <T extends Slot> T save(T first, T second, boolean lastWasFirst, byte[] json) throws IOException {
        T target = first;
        if (first.complete() && (!second.complete() || lastWasFirst)) target = second;
        try (OutputStream out = target.stage()) {
            out.write(json);
        }
        try (InputStream in = target.readStaged()) {
            int offset = 0;
            byte[] buffer = new byte[8192];
            int n;
            while ((n = in.read(buffer)) != -1) {
                if (n > json.length - offset) throw new IOException("备份长度不符");
                for (int i = 0; i < n; i++) {
                    if (buffer[i] != json[offset++]) throw new IOException("备份内容不符");
                }
            }
            if (offset != json.length) throw new IOException("备份写入不完整");
        }
        target.publish();
        return target;
    }
}
