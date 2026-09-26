import { useWantStore } from '@/stores/wantStore';
import type { ExposeEntry } from '@/types/want';
import type { Mark } from '@/components/common/MarkButton';

/** The global key an expose entry publishes under, whichever way it says it. */
function exposedAs(e: ExposeEntry): string | undefined {
  return e.as ?? e.asGlobalParam ?? e.asGoal;
}

/**
 * Where a field's value goes, and where it came from.
 *
 * A field that is exposed is not just "exposed" — it is exposed TO somebody,
 * and the somebody is the want that imports the global key it publishes under.
 * Same the other way: an imported field is fed BY the want that exposes that
 * key. The badge on the card says which of the two it is (the arrow) and who is
 * at the other end (the want's own icon), so the wiring can be read and walked
 * from the card rather than from a settings tab.
 *
 * The global key is the fallback rather than the answer: a value published with
 * nobody yet reading it is a real state to be in, and then the mark points at
 * the global card, which is where that value actually is.
 */
export function useWiringMarks(
  name: string,
  opts: { exposes?: ExposeEntry[]; imports?: Record<string, string>; wantId?: string },
): Mark[] {
  const wants = useWantStore(s => s.wants);
  const { exposes, imports, wantId } = opts;
  const marks: Mark[] = [];

  const exposeEntry = exposes?.find(e => e.currentState === name);
  const exposeKey = exposeEntry ? exposedAs(exposeEntry) : undefined;
  if (exposeKey) {
    // The first reader. Several wants can import one key; the badge names one
    // and the Expose tab lists them all — a corner mark is a way in, not a
    // report.
    const reader = wants.find(w => {
      const id = w.metadata?.id || w.id;
      return id !== wantId && Object.keys(w.spec?.imports ?? {}).includes(exposeKey);
    });
    const readerId = reader?.metadata?.id || reader?.id;
    marks.push(reader && readerId
      ? { kind: 'want', id: readerId, name: reader.metadata?.name || readerId, wantType: reader.metadata?.type, via: 'expose' }
      : { kind: 'global', key: exposeKey, via: 'expose' });
  }

  const importKey = imports
    ? Object.entries(imports).find(([, local]) => local === name)?.[0]
    : undefined;
  if (importKey) {
    const writer = wants.find(w => {
      const id = w.metadata?.id || w.id;
      return id !== wantId && (w.spec?.exposes ?? []).some(e => exposedAs(e) === importKey);
    });
    const writerId = writer?.metadata?.id || writer?.id;
    marks.push(writer && writerId
      ? { kind: 'want', id: writerId, name: writer.metadata?.name || writerId, wantType: writer.metadata?.type, via: 'import' }
      : { kind: 'global', key: importKey, via: 'import' });
  }

  return marks;
}
