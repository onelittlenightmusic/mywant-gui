/**
 * Copies `text`, resolving to whether it actually was copied.
 *
 * navigator.clipboard exists only in a secure context. A phone that reaches
 * mywant-gui over plain http on the LAN has none, and there the old
 * `navigator.clipboard.writeText(...)` threw before anything was copied —
 * leaving whatever was on the clipboard before (on iOS, often something
 * Universal Clipboard brought over from a Mac) to be pasted instead. The
 * fallback is the selection + execCommand('copy') path, which iOS Safari and
 * Chrome still honour inside a tap.
 */
export async function copyText(text: string): Promise<boolean> {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall through to the selection path
    }
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  // 16px keeps iOS from zooming in on focus; fixed + transparent keeps the
  // page from scrolling or flashing.
  ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;font-size:16px;';
  document.body.appendChild(ta);
  try {
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, text.length); // iOS ignores select() alone
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    document.body.removeChild(ta);
  }
}
