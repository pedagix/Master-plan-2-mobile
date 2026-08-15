package __PACKAGE__;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.UriPermission;
import android.database.Cursor;
import android.net.Uri;
import android.provider.DocumentsContract;
import android.provider.OpenableColumns;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;

@CapacitorPlugin(name = "MasterPlanBackup")
public class MasterPlanBackupPlugin extends Plugin {
    private static final String PREFS = "master_plan_backup";
    private static final String PREF_TREE_URI = "tree_uri";
    private static final String PREF_FOLDER_NAME = "folder_name";
    private static final String BACKUP_PREFIX = "MasterPlan-";
    private static final String BACKUP_SUFFIX = ".mpbackup";
    private static final String BACKUP_MIME = "application/json";

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences(PREFS, 0);
    }

    private ContentResolver resolver() {
        return getContext().getContentResolver();
    }

    private Uri savedTreeUri() {
        String raw = prefs().getString(PREF_TREE_URI, null);
        if (raw == null || raw.isEmpty()) return null;
        try {
            return Uri.parse(raw);
        } catch (Exception ignored) {
            return null;
        }
    }

    private boolean hasPersistedAccess(Uri uri) {
        if (uri == null) return false;
        for (UriPermission permission : resolver().getPersistedUriPermissions()) {
            if (uri.equals(permission.getUri()) && permission.isReadPermission() && permission.isWritePermission()) {
                return true;
            }
        }
        return false;
    }

    private Uri requireTreeUri(PluginCall call) {
        Uri uri = savedTreeUri();
        if (uri == null || !hasPersistedAccess(uri)) {
            call.reject("Google Drive backup folder is not connected. Choose the folder again in Master Plan settings.");
            return null;
        }
        return uri;
    }

    private String queryDisplayName(Uri uri) {
        if (uri == null) return null;
        Cursor cursor = null;
        try {
            cursor = resolver().query(uri, new String[]{OpenableColumns.DISPLAY_NAME}, null, null, null);
            if (cursor != null && cursor.moveToFirst()) {
                for (int i = 0; i < cursor.getColumnCount(); i++) {
                    String value = cursor.getString(i);
                    if (value != null && !value.trim().isEmpty()) return value;
                }
            }
        } catch (Exception ignored) {
            // Some cloud providers expose only part of the metadata contract.
        } finally {
            if (cursor != null) cursor.close();
        }
        return null;
    }

    private Uri rootDocumentUri(Uri treeUri) {
        return DocumentsContract.buildDocumentUriUsingTree(treeUri, DocumentsContract.getTreeDocumentId(treeUri));
    }

    private static class BackupEntry {
        String id;
        String name;
        long lastModified;
        long size;

        JSObject toJs() {
            JSObject object = new JSObject();
            object.put("id", id);
            object.put("name", name);
            object.put("lastModified", lastModified);
            object.put("size", size);
            return object;
        }
    }

    private List<BackupEntry> listEntries(Uri treeUri) throws Exception {
        String treeDocumentId = DocumentsContract.getTreeDocumentId(treeUri);
        Uri childrenUri = DocumentsContract.buildChildDocumentsUriUsingTree(treeUri, treeDocumentId);
        String[] projection = new String[]{
            DocumentsContract.Document.COLUMN_DOCUMENT_ID,
            DocumentsContract.Document.COLUMN_DISPLAY_NAME,
            DocumentsContract.Document.COLUMN_LAST_MODIFIED,
            DocumentsContract.Document.COLUMN_SIZE,
            DocumentsContract.Document.COLUMN_MIME_TYPE
        };
        List<BackupEntry> entries = new ArrayList<>();
        Cursor cursor = resolver().query(childrenUri, projection, null, null, null);
        if (cursor == null) return entries;
        try {
            int idColumn = cursor.getColumnIndex(DocumentsContract.Document.COLUMN_DOCUMENT_ID);
            int nameColumn = cursor.getColumnIndex(DocumentsContract.Document.COLUMN_DISPLAY_NAME);
            int modifiedColumn = cursor.getColumnIndex(DocumentsContract.Document.COLUMN_LAST_MODIFIED);
            int sizeColumn = cursor.getColumnIndex(DocumentsContract.Document.COLUMN_SIZE);
            int mimeColumn = cursor.getColumnIndex(DocumentsContract.Document.COLUMN_MIME_TYPE);
            while (cursor.moveToNext()) {
                String mime = mimeColumn >= 0 ? cursor.getString(mimeColumn) : null;
                if (DocumentsContract.Document.MIME_TYPE_DIR.equals(mime)) continue;
                String name = nameColumn >= 0 ? cursor.getString(nameColumn) : null;
                if (name == null || !name.startsWith(BACKUP_PREFIX) || !name.endsWith(BACKUP_SUFFIX)) continue;
                BackupEntry entry = new BackupEntry();
                entry.id = idColumn >= 0 ? cursor.getString(idColumn) : null;
                entry.name = name;
                entry.lastModified = modifiedColumn >= 0 && !cursor.isNull(modifiedColumn) ? cursor.getLong(modifiedColumn) : 0L;
                entry.size = sizeColumn >= 0 && !cursor.isNull(sizeColumn) ? cursor.getLong(sizeColumn) : 0L;
                if (entry.id != null) entries.add(entry);
            }
        } finally {
            cursor.close();
        }

        // The timestamp is encoded into every file name, so name ordering is
        // dependable even when a cloud provider does not expose LAST_MODIFIED.
        Collections.sort(entries, Comparator.comparing((BackupEntry entry) -> entry.name).reversed());
        return entries;
    }

    private JSArray toJsArray(List<BackupEntry> entries) {
        JSArray array = new JSArray();
        for (BackupEntry entry : entries) array.put(entry.toJs());
        return array;
    }

    private JSObject statusObject() {
        Uri uri = savedTreeUri();
        boolean connected = uri != null && hasPersistedAccess(uri);
        JSObject result = new JSObject();
        result.put("native", true);
        result.put("connected", connected);
        result.put("folderName", connected ? prefs().getString(PREF_FOLDER_NAME, "Selected Google Drive folder") : null);
        return result;
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        JSObject result = statusObject();
        Uri uri = savedTreeUri();
        boolean connected = uri != null && hasPersistedAccess(uri);
        if (connected) {
            try {
                result.put("backups", toJsArray(listEntries(uri)));
            } catch (Exception ignored) {
                result.put("backups", new JSArray());
            }
        } else {
            result.put("backups", new JSArray());
        }
        call.resolve(result);
    }

    @PluginMethod
    public void chooseBackupFolder(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION
            | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
            | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION
            | Intent.FLAG_GRANT_PREFIX_URI_PERMISSION);
        Uri existing = savedTreeUri();
        if (existing != null) intent.putExtra(DocumentsContract.EXTRA_INITIAL_URI, existing);
        startActivityForResult(call, intent, "chooseBackupFolderResult");
    }

    @ActivityCallback
    private void chooseBackupFolderResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        Intent data = result.getData();
        if (result.getResultCode() != Activity.RESULT_OK || data == null || data.getData() == null) {
            JSObject cancelled = new JSObject();
            cancelled.put("native", true);
            cancelled.put("connected", false);
            cancelled.put("cancelled", true);
            call.resolve(cancelled);
            return;
        }

        Uri uri = data.getData();
        int takeFlags = data.getFlags() & (Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
        if (takeFlags == 0) takeFlags = Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION;
        try {
            resolver().takePersistableUriPermission(uri, takeFlags);
            String folderName = queryDisplayName(uri);
            if (folderName == null || folderName.isEmpty()) folderName = "Selected Google Drive folder";
            prefs().edit().putString(PREF_TREE_URI, uri.toString()).putString(PREF_FOLDER_NAME, folderName).apply();
            JSObject response = statusObject();
            response.put("cancelled", false);
            call.resolve(response);
        } catch (Exception error) {
            call.reject("Master Plan could not keep access to that folder. Please choose a writable Google Drive folder.", error);
        }
    }

    @PluginMethod
    public void disconnect(PluginCall call) {
        Uri uri = savedTreeUri();
        if (uri != null) {
            try {
                resolver().releasePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
            } catch (Exception ignored) {
                // The permission may already have been revoked outside the app.
            }
        }
        prefs().edit().remove(PREF_TREE_URI).remove(PREF_FOLDER_NAME).apply();
        call.resolve(statusObject());
    }

    @PluginMethod
    public void listBackups(PluginCall call) {
        Uri treeUri = requireTreeUri(call);
        if (treeUri == null) return;
        try {
            JSObject result = statusObject();
            result.put("backups", toJsArray(listEntries(treeUri)));
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Could not read backups from the selected Drive folder.", error);
        }
    }

    @PluginMethod
    public void writeBackup(PluginCall call) {
        Uri treeUri = requireTreeUri(call);
        if (treeUri == null) return;
        String fileName = call.getString("fileName");
        String content = call.getString("content");
        Integer requestedMax = call.getInt("maxBackups");
        int maxBackups = requestedMax == null ? 3 : Math.max(1, Math.min(10, requestedMax));
        if (fileName == null || content == null) {
            call.reject("Backup file name or content is missing.");
            return;
        }

        Uri createdUri = null;
        try {
            createdUri = DocumentsContract.createDocument(resolver(), rootDocumentUri(treeUri), BACKUP_MIME, fileName);
            if (createdUri == null) throw new IllegalStateException("Cloud provider did not create the backup file.");
            try (OutputStream output = resolver().openOutputStream(createdUri, "wt")) {
                if (output == null) throw new IllegalStateException("Could not open the backup file for writing.");
                output.write(content.getBytes(StandardCharsets.UTF_8));
                output.flush();
            }

            List<BackupEntry> entries = listEntries(treeUri);
            while (entries.size() > maxBackups) {
                BackupEntry oldest = entries.remove(entries.size() - 1);
                Uri oldestUri = DocumentsContract.buildDocumentUriUsingTree(treeUri, oldest.id);
                try {
                    DocumentsContract.deleteDocument(resolver(), oldestUri);
                } catch (Exception ignored) {
                    // Do not fail a successful new backup just because an old cloud
                    // copy could not be pruned. The next backup will try again.
                }
            }
            entries = listEntries(treeUri);
            JSObject result = statusObject();
            result.put("saved", true);
            result.put("backups", toJsArray(entries));
            call.resolve(result);
        } catch (Exception error) {
            if (createdUri != null) {
                try { DocumentsContract.deleteDocument(resolver(), createdUri); } catch (Exception ignored) {}
            }
            call.reject("Google Drive backup failed. Your local Master Plan data is unchanged.", error);
        }
    }

    @PluginMethod
    public void readBackup(PluginCall call) {
        Uri treeUri = requireTreeUri(call);
        if (treeUri == null) return;
        String id = call.getString("id");
        if (id == null || id.isEmpty()) {
            call.reject("Backup id is missing.");
            return;
        }
        try {
            Uri documentUri = DocumentsContract.buildDocumentUriUsingTree(treeUri, id);
            JSObject result = new JSObject();
            result.put("content", readUtf8(documentUri));
            result.put("fileName", queryDisplayName(documentUri));
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Could not read that Drive backup.", error);
        }
    }

    @PluginMethod
    public void exportBackup(PluginCall call) {
        String fileName = call.getString("fileName");
        String content = call.getString("content");
        if (fileName == null || content == null) {
            call.reject("Backup file name or content is missing.");
            return;
        }
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(BACKUP_MIME);
        intent.putExtra(Intent.EXTRA_TITLE, fileName);
        startActivityForResult(call, intent, "exportBackupResult");
    }

    @ActivityCallback
    private void exportBackupResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        Intent data = result.getData();
        if (result.getResultCode() != Activity.RESULT_OK || data == null || data.getData() == null) {
            JSObject cancelled = new JSObject();
            cancelled.put("cancelled", true);
            call.resolve(cancelled);
            return;
        }
        try {
            Uri uri = data.getData();
            String content = call.getString("content");
            try (OutputStream output = resolver().openOutputStream(uri, "wt")) {
                if (output == null) throw new IllegalStateException("Could not open selected file.");
                output.write(content.getBytes(StandardCharsets.UTF_8));
                output.flush();
            }
            JSObject response = new JSObject();
            response.put("saved", true);
            response.put("cancelled", false);
            response.put("fileName", queryDisplayName(uri));
            call.resolve(response);
        } catch (Exception error) {
            call.reject("Could not save the exported backup file.", error);
        }
    }

    @PluginMethod
    public void pickBackupFile(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        // Accept any user-selected file here and let Master Plan's own
        // validator decide whether it is a valid backup. This also keeps
        // restore compatible with older .json exports whose provider may not
        // report application/json consistently.
        intent.setType("*/*");
        startActivityForResult(call, intent, "pickBackupFileResult");
    }

    @ActivityCallback
    private void pickBackupFileResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        Intent data = result.getData();
        if (result.getResultCode() != Activity.RESULT_OK || data == null || data.getData() == null) {
            call.reject("Backup file selection canceled.");
            return;
        }
        try {
            Uri uri = data.getData();
            JSObject response = new JSObject();
            response.put("content", readUtf8(uri));
            response.put("fileName", queryDisplayName(uri));
            call.resolve(response);
        } catch (Exception error) {
            call.reject("Could not read the selected backup file.", error);
        }
    }

    private String readUtf8(Uri uri) throws Exception {
        try (InputStream input = resolver().openInputStream(uri); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            if (input == null) throw new IllegalStateException("Could not open backup file.");
            byte[] buffer = new byte[16 * 1024];
            int count;
            while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
            return output.toString(StandardCharsets.UTF_8.name());
        }
    }
}
