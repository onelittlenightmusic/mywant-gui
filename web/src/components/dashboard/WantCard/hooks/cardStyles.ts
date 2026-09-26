import type React from 'react';
import { ringColor } from '@/components/dashboard/WantCardFace';

/**
 * マウスオーバー時の枠（ブラウザ拡張の CursorMan ハイライトと同じ見た目）。
 * 実体は index.css の `.mw-hover-ring::after`。ボーダーではなく重ねた層なので
 * レイアウトを動かさず、フォーカス枠（実ボーダー）とも独立して共存する。
 */
export const CARD_HOVER_RING = 'mw-hover-ring';

/**
 * `.mw-hover-ring` に色を渡すインライン CSS 変数。
 *
 * 色相は自分のキャラクター色のまま、彩度と明度だけテーマに合わせて落とす
 * （ringColor）。カーソル色は 20px のポインタを一瞬で見つけるための彩度で
 * 選ばれており、カード全体を囲む枠に同じ値を使うとネオンの縁取りになって
 * 中身から目を奪う。誰の枠かは色相で読めるので、識別性は落ちない。
 */
export function hoverRingVars(color: string, isDark: boolean): React.CSSProperties {
  const ring = ringColor(color, isDark);
  return {
    '--mw-ring': ring,
    '--mw-ring-soft': `${ring}99`,
    '--mw-ring-faint': `${ring}55`,
  } as React.CSSProperties;
}

/**
 * The FOCUS/SELECTED frame, as a blur rather than a hard border.
 *
 * A selected card used to jump to a 4px character-coloured border; every
 * highlight frame in the app is being tried as a soft glow instead, so the card
 * is lit from its edge rather than fenced. Character hue at frame weight
 * (ringColor), so it still says whose focus this is without the neon.
 *
 * The glow bleeds INWARD, not out: an embedded card often sits in a container
 * that clips it, and an outward glow escaping only the one unclipped edge read
 * as a coloured header bar laid on top of the card. An inset glow stays on the
 * card it belongs to whatever contains it.
 */
export function focusGlowVars(color: string, isDark: boolean): React.CSSProperties {
  const c = ringColor(color, isDark);
  return { boxShadow: `inset 0 0 6px ${c}, inset 0 0 16px ${c}88, inset 0 0 30px ${c}44` };
}

/** 共通のフォーカス/ボーダースタイル。全カード（Want / WantType / Recipe）で統一して使用する */
export const CARD_BORDER_BASE = 'border-gray-200 dark:border-gray-700';
export const CARD_FOCUS_BASE = 'focus:outline-none';

/**
 * グローバルの `.card` から地の色（bg-white / dark:bg-gray-800）だけ除いたもの。
 *
 * カードの塗り面は card_opacity を適用したレイヤ内でまとめて描くため、
 * ルート要素に不透明な地色があると背景を薄くしたときにその白が出てきてしまう。
 * カード類は `.card` ではなくこちらを使うこと（`.card` 自体は
 * サイドバーのパネル等が引き続き使用する）。
 */
export const CARD_SHELL_BASE =
  'rounded-lg shadow-sm border overflow-hidden';

/**
 * card_opacity レイヤの中に敷く、カード自身の地の色。
 * 背景グラデーションや画像を持たないカード（world / device / character 等）は
 * これだけが面になる。
 */
export const CARD_SURFACE_BASE = 'bg-white dark:bg-gray-800';

/**
 * 選択（=フォーカス）済みカードのボーダー・シャドウ・スケール。
 * `selected ? CARD_SELECTED_CLASSES : CARD_UNSELECTED_CLASSES` でトグルする。
 * 枠線の色はここでは決めず、自分のキャラクター色を borderColor で当てる
 * （useMyCursorColor）。
 */
export const CARD_SELECTED_CLASSES =
  'border-gray-200 dark:border-gray-700 shadow-lg scale-[1.02] z-10';

/**
 * フォーカス枠の太さ・影だけ。色は自分のキャラクター色を
 * インラインの borderColor で当てる（useMyCursorColor）。
 * Want カードは canvas 上で絶対配置なので scale は付けない。
 */
export const CARD_FOCUS_RING = 'shadow-lg';

/**
 * 非選択カードのデフォルトボーダー。
 */
export const CARD_UNSELECTED_CLASSES =
  'border-gray-200 dark:border-gray-700';

/**
 * 選択済みカードのボトムバー背景（ブルー）。
 * 非選択は 'bg-white/60 dark:bg-gray-900/70'。
 */
export const CARD_BOTTOM_BAR_SELECTED =
  'bg-blue-100/90 dark:bg-blue-900/70';

export const CARD_BOTTOM_BAR_UNSELECTED =
  'bg-white/60 dark:bg-gray-900/70';
