import { useCallback, useRef, useState } from 'react';

type Cell = { x: number; y: number };
type Dir = 'up' | 'down' | 'left' | 'right';

/**
 * What the workspace may ask of the board itself — a handful of the board's
 * methods, named here so the workspace does not have to know the board.
 */
export interface BoardHandle {
  syncCursorManPos(pos: Cell, opts?: unknown): void;
  getThingPositions?(): Map<string, Cell>;
  isRotationGuideActive(): boolean;
  exitRotationGuide(): void;
  cancelKeyboardDrag(): void;
  panCamera(dir: Dir): void;
  warpKeyboardDragCursor(dir: Dir): void;
}

/**
 * What the workspace needs to know of a board, when there is one.
 *
 * The workspace — the list and the detail panel, the forms, the selection, the
 * saved GUI state — is the same on both pages, and on the canvas page some of
 * it reaches onto the board: a new want is placed where the character stands,
 * selecting a want walks the character to it, the saved state remembers where
 * the camera was. These are the values it reaches for, and nothing else of the
 * board.
 *
 * The canvas page hands in its own (canvas/useBoardState is a superset); the
 * list page, which has no board, hands in `useNoBoard()`, where every one of
 * them stands still.
 */
export interface BoardLink {
  cursorManPos: Cell | null;
  setCursorManPos: React.Dispatch<React.SetStateAction<Cell | null>>;
  cursorManPosRef: React.MutableRefObject<Cell | null>;
  initCursorManPosRef: React.MutableRefObject<Cell | null>;
  lastLocalCursorMoveRef: React.MutableRefObject<number>;
  cursorManFocusedWantIdRef: React.MutableRefObject<string | null>;
  canvasScale: number;
  setCanvasScale: (s: number) => void;
  /** The zoom this screen may show, for a zoom that was saved elsewhere. */
  clampScale: (s: number) => number;
  canvasScaleRef: React.MutableRefObject<number>;
  canvasCenterX: number | undefined;
  canvasCenterY: number | undefined;
  canvasCenterXRef: React.MutableRefObject<number | undefined>;
  canvasCenterYRef: React.MutableRefObject<number | undefined>;
  pendingCanvasPosRef: React.MutableRefObject<Cell | null>;
  hasLoadedCharacterViewportRef: React.MutableRefObject<boolean>;
  canvasPositionMapRef: React.MutableRefObject<ReadonlyMap<string, Cell>>;
  wantCanvasRef: React.RefObject<BoardHandle>;
  canvasMiddle: () => Cell;
  isCanvasDragging: boolean;
  setIsCanvasDragging: React.Dispatch<React.SetStateAction<boolean>>;
  isCanvasDraggingRef: React.MutableRefObject<boolean>;
}

/** The board of a page that has none: refs that stay empty, setters that go nowhere. */
export function useNoBoard(): BoardLink {
  const [cursorManPos, setCursorManPos] = useState<Cell | null>(null);
  const [isCanvasDragging, setIsCanvasDragging] = useState(false);
  const cursorManPosRef = useRef<Cell | null>(null);
  const initCursorManPosRef = useRef<Cell | null>(null);
  const lastLocalCursorMoveRef = useRef(0);
  const cursorManFocusedWantIdRef = useRef<string | null>(null);
  const canvasScaleRef = useRef(1);
  const canvasCenterXRef = useRef<number | undefined>(undefined);
  const canvasCenterYRef = useRef<number | undefined>(undefined);
  const pendingCanvasPosRef = useRef<Cell | null>(null);
  const hasLoadedCharacterViewportRef = useRef(false);
  const canvasPositionMapRef = useRef<ReadonlyMap<string, Cell>>(new Map());
  const wantCanvasRef = useRef<BoardHandle>(null);
  const isCanvasDraggingRef = useRef(false);
  const setCanvasScale = useCallback((_s: number) => {}, []);
  const clampScale = useCallback((s: number) => s, []);
  const canvasMiddle = useCallback((): Cell => ({ x: 0, y: 0 }), []);
  return {
    cursorManPos, setCursorManPos, cursorManPosRef, initCursorManPosRef,
    lastLocalCursorMoveRef, cursorManFocusedWantIdRef,
    canvasScale: 1, setCanvasScale, clampScale, canvasScaleRef,
    canvasCenterX: undefined, canvasCenterY: undefined, canvasCenterXRef, canvasCenterYRef,
    pendingCanvasPosRef, hasLoadedCharacterViewportRef, canvasPositionMapRef, wantCanvasRef,
    canvasMiddle, isCanvasDragging, setIsCanvasDragging, isCanvasDraggingRef,
  };
}
