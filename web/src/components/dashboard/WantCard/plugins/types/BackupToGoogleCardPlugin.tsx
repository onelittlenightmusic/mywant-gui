import React, { useState } from 'react';
import { UploadCloud, ExternalLink, AlertTriangle, Check, KeyRound, RefreshCw } from 'lucide-react';
import { WantCardPluginProps, registerWantCardPlugin } from '../registry';
import { WantCardLayout } from '../../WantCardLayout';
import { writeWantState } from '@/api/wantState';
import { formatRelativeTime, classNames } from '@/utils/helpers';

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

function humanBytes(n: number): string {
  if (!n) return '0 B';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * The backup want's card. Its whole job before the first successful run is to
 * get the user through Google's consent screen — so an un-authorized card is
 * mostly a big "Authorize" button, and once a refresh token is in hand it
 * steps back to a status line with a link to the file and a way to force a run.
 */
const BackupToGoogleContentSection: React.FC<WantCardPluginProps> = ({ want }) => {
  const id = want.metadata?.id;
  const name = want.metadata?.name ?? '';
  const cur = (want.state?.current ?? {}) as Record<string, unknown>;
  const params = (want.spec?.params ?? {}) as Record<string, unknown>;

  const clientId = String(cur.google_client_id || params.google_client_id || '');
  // The refresh token itself is never in state (it lives in ~/.mywant/secrets);
  // this flag is the agent's word for "a token is on file".
  const authorizedState = cur.authorized === true;
  const status = String(cur.backup_status || '');
  const err = String(cur.error || '');
  const lastAt = String(cur.last_backup_at || '');
  const bytes = Number(cur.backup_bytes) || 0;
  const fileId = String(cur.drive_file_id || '');

  const [busy, setBusy] = useState(false);

  const redirectUri = `${window.location.origin}/api/v1/oauth/callback`;
  const authUrl = clientId
    ? 'https://accounts.google.com/o/oauth2/v2/auth?' +
      new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        access_type: 'offline',
        prompt: 'consent',
        include_granted_scopes: 'true',
        scope: DRIVE_SCOPE,
        state: name,
      }).toString()
    : '';

  const authorize = () => {
    if (!authUrl || !id) return;
    // Pin the exact redirect_uri the server must reuse for the token exchange.
    writeWantState(id, { oauth_redirect_uri: redirectUri });
    window.open(authUrl, '_blank', 'noopener,noreferrer');
  };

  const backupNow = async () => {
    if (!id || busy) return;
    setBusy(true);
    try {
      await fetch(`/api/v1/wants/${id}/restart`, { method: 'POST' });
    } finally {
      setTimeout(() => setBusy(false), 1500);
    }
  };

  const authorized = authorizedState && status !== 'waiting_auth';

  const bigButton = (
    <button
      type="button"
      data-inner-focus
      data-inner-focus-default
      onClick={(e) => { e.stopPropagation(); authorize(); }}
      onMouseDown={(e) => e.stopPropagation()}
      disabled={!clientId}
      className={classNames(
        'flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-semibold text-white transition-colors',
        clientId ? 'bg-sky-600 hover:bg-sky-700 active:bg-sky-800' : 'bg-gray-400 cursor-not-allowed',
      )}
    >
      <KeyRound className="w-4 h-4" />
      Google で認可
    </button>
  );

  return (
    <WantCardLayout
      content={
        <div className="h-full flex flex-col items-center justify-center gap-2 p-3 text-center">
          {!authorized ? (
            <>
              <UploadCloud className="w-8 h-8 text-sky-500" />
              {clientId ? (
                <>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    まだ認可されていません。Google Drive への書き出しを許可してください。
                  </p>
                  {bigButton}
                  {status === 'failed' && err && (
                    <p className="text-[10px] text-rose-500 max-w-full break-words">{err}</p>
                  )}
                  <p className="text-[10px] text-gray-400">
                    リダイレクト URI:&nbsp;
                    <span className="font-mono break-all">{redirectUri}</span>
                  </p>
                </>
              ) : (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  <span className="font-semibold">google_client_id</span> /{' '}
                  <span className="font-semibold">google_client_secret</span> をパラメータに設定してください。
                </p>
              )}
            </>
          ) : (
            <>
              <div className={classNames(
                'w-9 h-9 rounded-full flex items-center justify-center',
                status === 'failed' ? 'bg-rose-500/15' : 'bg-emerald-500/15',
              )}>
                {status === 'failed'
                  ? <AlertTriangle className="w-5 h-5 text-rose-500" />
                  : <Check className="w-5 h-5 text-emerald-500" strokeWidth={2.5} />}
              </div>
              {status === 'failed' ? (
                <p className="text-xs text-rose-500 max-w-full break-words">{err || 'バックアップに失敗しました'}</p>
              ) : lastAt ? (
                <p className="text-xs text-gray-600 dark:text-gray-300">
                  最終バックアップ <span className="font-medium">{formatRelativeTime(lastAt)}</span>
                  <span className="text-gray-400"> · {humanBytes(bytes)}</span>
                </p>
              ) : (
                <p className="text-xs text-gray-500 dark:text-gray-400">認可済み。次回の実行を待っています。</p>
              )}

              <div className="flex items-center gap-3 text-[11px]">
                {fileId && (
                  <a
                    href={`https://drive.google.com/file/d/${fileId}/view`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 text-sky-600 hover:underline"
                  >
                    <ExternalLink className="w-3 h-3" /> Drive で開く
                  </a>
                )}
                <button
                  type="button"
                  data-inner-focus
                  onClick={(e) => { e.stopPropagation(); backupNow(); }}
                  onMouseDown={(e) => e.stopPropagation()}
                  disabled={busy}
                  className="inline-flex items-center gap-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-40"
                >
                  <RefreshCw className={classNames('w-3 h-3', busy && 'animate-spin')} /> 今すぐ
                </button>
                <button
                  type="button"
                  data-inner-focus
                  onClick={(e) => { e.stopPropagation(); authorize(); }}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <KeyRound className="w-3 h-3" /> 再認可
                </button>
              </div>
            </>
          )}
        </div>
      }
    />
  );
};

registerWantCardPlugin({
  types: ['backup to google'],
  ContentSection: BackupToGoogleContentSection,
  hideFinalResult: true,
});
