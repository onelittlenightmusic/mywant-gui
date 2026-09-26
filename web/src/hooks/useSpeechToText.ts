import { useCallback, useRef, useState } from 'react';

// The Web Speech API's SpeechRecognition isn't in TS's default DOM lib —
// declare just the bits used here rather than pulling in a whole @types package.
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition) as SpeechRecognitionCtor | undefined ?? null;
}

interface UseSpeechToTextOptions {
  /** BCP-47 language tag. Defaults to the browser's own language. */
  lang?: string;
  /** Called with the recognized text on every update — isFinal=false for live interim results, true once an utterance is finalized. */
  onResult: (text: string, isFinal: boolean) => void;
}

interface UseSpeechToText {
  /** False when the browser has no SpeechRecognition implementation (e.g. Firefox) — hide the mic button in that case. */
  supported: boolean;
  listening: boolean;
  error: string | null;
  toggle: () => void;
}

/**
 * Thin wrapper around the browser's native SpeechRecognition (Web Speech API,
 * Chrome/Edge/Safari — vendor-prefixed as webkitSpeechRecognition). No
 * external service, no audio ever leaves the browser except to whatever the
 * browser itself sends for on-device/cloud recognition.
 */
export function useSpeechToText({ lang, onResult }: UseSpeechToTextOptions): UseSpeechToText {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  const Ctor = getSpeechRecognitionCtor();
  const supported = Ctor !== null;

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const start = useCallback(() => {
    if (!Ctor || listening) return;
    const recognition = new Ctor();
    recognition.lang = lang || navigator.language || 'en-US';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      let finalText = '';
      let interimText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) finalText += result[0].transcript;
        else interimText += result[0].transcript;
      }
      if (finalText) onResultRef.current(finalText, true);
      else if (interimText) onResultRef.current(interimText, false);
    };
    recognition.onerror = (event) => {
      setError(event.error);
      setListening(false);
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    setError(null);
    setListening(true);
    recognition.start();
  }, [Ctor, listening, lang]);

  const toggle = useCallback(() => {
    if (listening) stop(); else start();
  }, [listening, start, stop]);

  return { supported, listening, error, toggle };
}
