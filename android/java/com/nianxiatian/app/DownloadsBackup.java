package com.nianxiatian.app;

import android.content.ContentResolver;
import android.content.ContentUris;
import android.content.ContentValues;
import android.content.Context;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.net.Uri;
import android.provider.MediaStore;
import android.provider.MediaStore.MediaColumns;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/** Android 10+ public Downloads. Unpublished rows can be reused after an interrupted write. */
final class DownloadsBackup {
    private static final String DIRECTORY = "Download/那年夏天备份/";
    private static final String FIRST = "nianxiatian-backup.json";
    private static final String SECOND = "nianxiatian-backup-2.json";
    private static final String[] COLUMNS = {MediaColumns._ID, MediaColumns.DISPLAY_NAME, MediaColumns.IS_PENDING, MediaColumns.DATE_MODIFIED};
    private final ContentResolver resolver;
    private final SharedPreferences prefs;
    private final Uri collection = MediaStore.Downloads.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY);

    DownloadsBackup(Context context) {
        resolver = context.getContentResolver();
        prefs = context.getSharedPreferences("downloads-backup", Context.MODE_PRIVATE);
    }

    String save(String json) throws IOException {
        Entry first = new Entry(FIRST), second = new Entry(SECOND);
        boolean firstIsLatest = first.modified == second.modified
            ? FIRST.equals(prefs.getString("latest", FIRST)) : first.modified > second.modified;
        Entry saved = RollingBackup.save(first, second, firstIsLatest, json.getBytes(StandardCharsets.UTF_8));
        prefs.edit().putString("latest", saved.slotName).putString(saved.slotName + ".name", saved.displayName).commit();
        return saved.displayName;
    }

    private final class Entry implements RollingBackup.Slot {
        private final String slotName;
        private Uri uri;
        private String displayName;
        private boolean complete;
        private long modified;

        @SuppressWarnings("deprecation")
        Entry(String name) throws IOException {
            slotName = name;
            displayName = prefs.getString(name + ".name", name);
            // After reinstall MediaStore may append "(1)" to a new row's display name.
            // Match the remembered row, or discover the canonical file from an older version.
            String where = MediaColumns.RELATIVE_PATH + "=? AND (" + MediaColumns.DISPLAY_NAME + "=? OR (" +
                MediaColumns._ID + "=? AND (" + MediaColumns.DISPLAY_NAME + "=? OR " + MediaColumns.IS_PENDING + "=1)))";
            String[] args = {DIRECTORY, name, Long.toString(prefs.getLong(name + ".id", -1)), displayName};
            try (Cursor rows = resolver.query(MediaStore.setIncludePending(collection), COLUMNS, where, args, MediaColumns._ID + " DESC")) {
                if (rows == null) throw new IOException("无法读取下载目录");
                if (rows.moveToFirst()) {
                    uri = ContentUris.withAppendedId(collection, rows.getLong(0));
                    displayName = rows.getString(1);
                    complete = rows.getInt(2) == 0;
                    modified = rows.getLong(3);
                }
            }
        }

        public boolean complete() { return complete; }

        public OutputStream stage() throws IOException {
            ContentValues values = new ContentValues();
            values.put(MediaColumns.IS_PENDING, 1);
            if (uri == null) {
                values.put(MediaColumns.DISPLAY_NAME, slotName);
                values.put(MediaColumns.MIME_TYPE, "application/json");
                values.put(MediaColumns.RELATIVE_PATH, DIRECTORY);
                uri = resolver.insert(collection, values);
                if (uri == null) throw new IOException("无法创建备份文件");
                prefs.edit().putLong(slotName + ".id", ContentUris.parseId(uri)).commit();
            } else if (complete && resolver.update(uri, values, null, null) != 1) {
                throw new IOException("无法准备备份文件");
            }
            OutputStream stream = resolver.openOutputStream(uri, "wt");
            if (stream == null) throw new IOException("无法写入备份文件");
            return stream;
        }

        public InputStream readStaged() throws IOException {
            InputStream stream = resolver.openInputStream(uri);
            if (stream == null) throw new IOException("无法核对备份文件");
            return stream;
        }

        public void publish() throws IOException {
            ContentValues values = new ContentValues();
            values.put(MediaColumns.IS_PENDING, 0);
            if (resolver.update(uri, values, null, null) != 1) throw new IOException("无法完成备份");
            try (Cursor row = resolver.query(uri, COLUMNS, null, null, null)) {
                if (row == null || !row.moveToFirst()) throw new IOException("无法确认备份文件名");
                displayName = row.getString(1);
            }
        }
    }
}
