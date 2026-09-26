import React, { useMemo, useState } from 'react';
import { Mail, ExternalLink } from 'lucide-react';
import { WantCardPluginProps, registerWantCardPlugin } from '../registry';
import { WantCardLayout } from '../../WantCardLayout';
import { CardFrame, CardFrameBadge, CardFrameTitle, CardFrameNote } from '../../CardFrame';
import { useDataTypes } from '@/hooks/useDataTypes';
import { resolveLucideIcon } from '@/utils/subtypeIcons';
import { useInputActions } from '@/hooks/useInputActions';

/**
 * One remembered mail: what it was about, who sent it, and a way back to it.
 *
 * "Show mail" goes through POST /web-wants/open rather than window.open, so the
 * Chrome extension is what opens the tab — and no web want has to exist for a
 * memo to be openable.
 */
const GmailMemoContentSection: React.FC<WantCardPluginProps> = ({ want, isFocused }) => {
  const { types } = useDataTypes();
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState('');

  const cur = want.state?.current ?? {};
  const params = want.spec?.params ?? {};
  const subject = (cur.subject as string) || (params.subject as string) || '';
  const sender = (cur.sender as string) || (params.sender as string) || '';
  const emailUrl = (cur.email_url as string) || (params.email_url as string) || '';

  // thing.yaml is keyed by catalog ("artists"), the datatype catalog by type
  // name ("artist"). Same reconciliation as thingStore's buildKeyToType: a real
  // subtype wins over a primitive sharing the same key.
  const byCatalog = useMemo(() => {
    const out: Record<string, { name: string; color: string; icon: string }> = {};
    for (const [name, info] of Object.entries(types)) {
      const key = info.memoKey;
      if (!key) continue;
      const prev = out[key];
      if (!prev || (!types[prev.name]?.baseType && info.baseType)) {
        out[key] = { name, color: info.color, icon: info.icon };
      }
    }
    return out;
  }, [types]);

  const things = useMemo(() => {
    const raw = params.things;
    if (!Array.isArray(raw)) return [];
    return raw.map((id) => {
      const s = String(id);
      const sep = s.indexOf('::');
      const catalog = sep >= 0 ? s.slice(0, sep) : '';
      const value = sep >= 0 ? s.slice(sep + 2) : s;
      const info = byCatalog[catalog];
      return {
        id: s,
        value,
        color: info?.color ?? '#64748b',
        icon: info?.icon ?? 'Type',
      };
    });
  }, [params.things, byCatalog]);

  const openMail = async () => {
    if (!emailUrl || opening) return;
    setOpening(true);
    setError('');
    try {
      const res = await fetch('/api/v1/web-wants/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: emailUrl }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      // The queue accepts the claim even with no extension listening, so the
      // only failures worth showing here are the ones that never got queued.
      console.error('[GmailMemoCard] open failed:', err);
      setError('拡張に渡せませんでした');
    } finally {
      setOpening(false);
    }
  };

  // Enter on the focused card opens the mail — the card's one action.
  useInputActions({
    enabled: !!isFocused && !!emailUrl,
    onConfirm: openMail,
  });

  const content = (
    <CardFrame
      eyecatch={
        <CardFrameBadge
          color="#f43f5e"
          icon={<Mail className="w-[1.8em] h-[1.8em]" strokeWidth={2.5} />}
          caption="メモ"
        />
      }
    >
      <CardFrameTitle className="whitespace-normal line-clamp-2">
        {subject || <span className="italic text-gray-400">件名なし</span>}
      </CardFrameTitle>

      {sender && <CardFrameNote>{sender}</CardFrameNote>}

      {things.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-0.5">
          {things.map((t) => {
            const Icon = resolveLucideIcon(t.icon);
            return (
              <span
                key={t.id}
                className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-white text-[0.7em] font-semibold max-w-[140px]"
                style={{ backgroundColor: t.color }}
                title={t.id}
              >
                {Icon && <Icon className="w-[1em] h-[1em] flex-shrink-0" />}
                <span className="truncate">{t.value}</span>
              </span>
            );
          })}
        </div>
      )}

      {/* The card's one action, kept right-aligned: the card's own status
          badges sit in the bottom-left corner and a left-aligned button lands
          underneath them. */}
      <div className="flex items-center justify-end gap-2 mt-1">
        {error && <span className="text-[0.7em] text-red-500">{error}</span>}
        <button
          onClick={(e) => { e.stopPropagation(); void openMail(); }}
          disabled={!emailUrl || opening}
          className="flex items-center gap-1 px-2 py-1 rounded-md text-[0.75em] font-semibold
                     bg-rose-500 text-white shadow disabled:opacity-40 hover:bg-rose-600"
        >
          <ExternalLink className="w-[1em] h-[1em]" />
          {opening ? '送信中…' : 'メールを表示'}
        </button>
      </div>
    </CardFrame>
  );

  return <WantCardLayout content={content} />;
};

registerWantCardPlugin({
  types: ['gmail_memo'],
  ContentSection: GmailMemoContentSection,
  hideFinalResult: true,
});
