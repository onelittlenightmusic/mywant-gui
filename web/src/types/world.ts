/** A saved snapshot of the whole want set (~/.mywant/worlds/<name>.yaml). */
export interface WorldSummary {
  name: string;
  want_count: number;
  modified_at: string;
  current: boolean;
  /**
   * mtime of the world's canvas screenshot (RFC3339), or absent when none has
   * been captured yet. Also used as the cache-buster on the thumbnail URL.
   */
  thumbnail_at?: string;
}

export interface OpenWorldResponse {
  name: string;
  want_count: number;
  /**
   * Whether the board already knew where to stand. A world carries a spawn
   * point for arriving somewhere sensible the first time; once it remembers
   * where you were, that memory is the better answer and nothing should
   * teleport over it.
   */
  cursor_restored?: boolean;
}
