import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { recordDiagnosticError } from './errorDiagnostics';

/**
 * Save/export a text file.
 *
 * - Native (Android APK): the WebView ignores <a download> with blob: URLs, so we write the
 *   file to the app cache and open the system share sheet (Save to Files / Drive / email...).
 * - Web: regular browser download.
 *
 * Returns true if the export completed (or was handed to the share sheet), false on failure.
 * A user dismissing the share sheet is treated as success (the file was still created).
 */
export async function saveTextFile(
  filename: string,
  content: string,
  mimeType: string,
): Promise<boolean> {
  const outcome = await saveTextFileDetailed(filename, content, mimeType);
  return outcome !== 'failed';
}

export type SaveOutcome = 'handed-off' | 'cancelled' | 'failed';

/**
 * Same as saveTextFile but reports what happened:
 * - 'handed-off': the file was created and given to the share sheet / browser download. The OS does not
 *   tell us which destination (if any) the user chose, so this is NOT proof the file was stored safely.
 * - 'cancelled': the user dismissed the share sheet and the platform reported it as a cancel.
 * - 'failed': the file could not be created or shared.
 */
export async function saveTextFileDetailed(
  filename: string,
  content: string,
  mimeType: string,
): Promise<SaveOutcome> {
  if (Capacitor.isNativePlatform()) {
    try {
      const written = await Filesystem.writeFile({
        path: filename,
        data: content,
        directory: Directory.Cache,
        encoding: Encoding.UTF8,
      });
      try {
        await Share.share({
          title: filename,
          dialogTitle: 'Save your backup (Drive, Files, email...)',
          url: written.uri,
        });
      } catch (shareErr) {
        const msg = String((shareErr as Error)?.message ?? shareErr);
        // Cancelling the share sheet is not an error, but it is not a saved backup either.
        if (/cancel/i.test(msg)) return 'cancelled';
        throw shareErr;
      }
      return 'handed-off';
    } catch (err) {
      recordDiagnosticError('native_text_export', err);
      console.error('Native file export failed:', err);
      return 'failed';
    }
  }

  try {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    // Revoke later; revoking immediately can cancel the download in some browsers
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    return 'handed-off';
  } catch (err) {
    recordDiagnosticError('browser_text_export', err);
    console.error('Browser file export failed:', err);
    return 'failed';
  }
}

/**
 * Save a base64-encoded binary file (e.g. a PNG). Native: cache + share sheet. Web: download.
 */
export async function saveBase64File(
  filename: string,
  base64Data: string,
  mimeType: string,
): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    try {
      const written = await Filesystem.writeFile({
        path: filename,
        data: base64Data,
        directory: Directory.Cache,
      });
      try {
        await Share.share({ title: filename, dialogTitle: 'Save or share', url: written.uri });
      } catch (shareErr) {
        const msg = String((shareErr as Error)?.message ?? shareErr);
        if (!/cancel/i.test(msg)) throw shareErr;
      }
      return true;
    } catch (err) {
      recordDiagnosticError('native_binary_export', err);
      console.error('Native file save failed:', err);
      return false;
    }
  }

  try {
    const link = document.createElement('a');
    link.href = `data:${mimeType};base64,${base64Data}`;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return true;
  } catch (err) {
    recordDiagnosticError('browser_binary_export', err);
    console.error('Browser file save failed:', err);
    return false;
  }
}

/**
 * Share plain text. Native: system share sheet. Web: navigator.share if present.
 * Returns 'shared' when handed to a share sheet, 'unsupported' when caller should fall back (clipboard).
 */
export async function shareText(title: string, text: string): Promise<'shared' | 'unsupported'> {
  if (Capacitor.isNativePlatform()) {
    try {
      await Share.share({ title, text, dialogTitle: 'Share stats' });
      return 'shared';
    } catch (err) {
      const msg = String((err as Error)?.message ?? err);
      if (/cancel/i.test(msg)) return 'shared';
      recordDiagnosticError('native_text_share', err);
      console.error('Native text share failed:', err);
      return 'unsupported';
    }
  }
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({ title, text });
      return 'shared';
    } catch {
      return 'unsupported';
    }
  }
  return 'unsupported';
}
