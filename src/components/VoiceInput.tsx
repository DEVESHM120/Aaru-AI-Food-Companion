"use client";

import { useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from "react";

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: ((ev: Event) => void) | null;
  onend: ((ev: Event) => void) | null;
  onerror: ((ev: Event) => void) | null;
  onspeechend: ((ev: Event) => void) | null;
  onresult: ((ev: SpeechRecognitionEvent) => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition: new () => SpeechRecognitionInstance;
  }
}

export interface VoiceInputHandle {
  startListening: () => void;
  stopListening: () => void;
}

interface VoiceInputProps {
  isVoiceMode: boolean;
  isSpeaking: boolean;
  onInterimTranscript: (text: string) => void;
  onFinalTranscript: (text: string) => void;
  onListeningChange: (listening: boolean) => void;
  onError?: (message: string) => void;
}

const SILENCE_AFTER_FINAL_MS = 900;
const SILENCE_AFTER_SPEECH_END_MS = 600;
const TTS_ECHO_COOLDOWN_MS = 1200;

// Detect iOS (Safari and Chrome on iOS both use WebKit)
const isIOS = typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent);

const VoiceInput = forwardRef<VoiceInputHandle, VoiceInputProps>(function VoiceInput(
  { isVoiceMode, isSpeaking, onInterimTranscript, onFinalTranscript, onListeningChange, onError },
  ref
) {
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const accumulatedRef = useRef("");
  const isRunningRef = useRef(false);
  const speechEndedRef = useRef(false);

  const onFinalRef = useRef(onFinalTranscript);
  const onInterimRef = useRef(onInterimTranscript);
  const onListeningRef = useRef(onListeningChange);
  const onErrorRef = useRef(onError);

  useEffect(() => { onFinalRef.current = onFinalTranscript; }, [onFinalTranscript]);
  useEffect(() => { onInterimRef.current = onInterimTranscript; }, [onInterimTranscript]);
  useEffect(() => { onListeningRef.current = onListeningChange; }, [onListeningChange]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  const isVoiceModeRef = useRef(isVoiceMode);
  const isSpeakingRef = useRef(isSpeaking);
  useEffect(() => { isVoiceModeRef.current = isVoiceMode; }, [isVoiceMode]);

  const ttsCooldownRef = useRef(false);
  const ttsEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const submitAccumulated = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    const text = accumulatedRef.current.trim();
    accumulatedRef.current = "";
    speechEndedRef.current = false;
    onInterimRef.current("");
    if (text) onFinalRef.current(text);
  }, []);

  const scheduleSubmit = useCallback((delayMs: number) => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = setTimeout(submitAccumulated, delayMs);
  }, [submitAccumulated]);

  const stopRecognition = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (recognitionRef.current && isRunningRef.current) {
      recognitionRef.current.abort();
      isRunningRef.current = false;
    }
    onListeningRef.current(false);
  }, []);

  const startRecognition = useCallback(() => {
    if (ttsCooldownRef.current) return;
    if (isRunningRef.current) return;

    const SpeechRecognitionClass =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      onErrorRef.current?.(
        isIOS
          ? "Voice needs Safari on iPhone — open this page in Safari."
          : "Voice not supported in this browser. Try Chrome."
      );
      return;
    }

    const recognition = new SpeechRecognitionClass();
    recognition.lang = "en-IN";
    // iOS Safari: continuous mode is unreliable — use single-shot + auto-restart
    recognition.continuous = !isIOS;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;
    accumulatedRef.current = "";
    speechEndedRef.current = false;

    recognition.onstart = () => {
      isRunningRef.current = true;
      onListeningRef.current(true);
    };

    recognition.onspeechend = () => {
      speechEndedRef.current = true;
      if (accumulatedRef.current.trim()) {
        scheduleSubmit(SILENCE_AFTER_SPEECH_END_MS);
      }
    };

    recognition.onend = () => {
      isRunningRef.current = false;
      onInterimRef.current(""); // always clear interim — prevents textarea getting stuck readOnly
      if (accumulatedRef.current.trim()) submitAccumulated();
      if (isVoiceModeRef.current && !isSpeakingRef.current && !ttsCooldownRef.current) {
        setTimeout(() => {
          if (!isRunningRef.current && !ttsCooldownRef.current && isVoiceModeRef.current) {
            startRecognition();
          }
        }, 200);
      } else {
        onListeningRef.current(false);
      }
    };

    recognition.onerror = (e: any) => {
      isRunningRef.current = false;
      const error: string = e.error ?? "";
      if (error === "not-allowed" || error === "permission-denied" || error === "service-not-allowed") {
        onErrorRef.current?.("Microphone blocked — allow mic access in your browser/phone settings.");
        onListeningRef.current(false);
      } else if (error === "network") {
        onErrorRef.current?.("Voice unavailable — check your internet connection.");
        onListeningRef.current(false);
      } else if (error !== "no-speech" && error !== "aborted") {
        onListeningRef.current(false);
      }
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      let finalChunk = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalChunk += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }

      if (interim) onInterimRef.current(interim);

      if (finalChunk) {
        accumulatedRef.current += finalChunk + " ";
        onInterimRef.current(accumulatedRef.current.trim());
        const delay = speechEndedRef.current ? SILENCE_AFTER_SPEECH_END_MS : SILENCE_AFTER_FINAL_MS;
        scheduleSubmit(delay);
      }
    };

    try {
      recognition.start();
    } catch {
      // Already started or other error — ignore
      isRunningRef.current = false;
    }
  }, [scheduleSubmit, submitAccumulated]);

  // Expose imperative handle so parent can call startListening() directly from tap handler
  useImperativeHandle(ref, () => ({
    startListening: () => {
      if (!isRunningRef.current) startRecognition();
    },
    stopListening: () => {
      stopRecognition();
    },
  }), [startRecognition, stopRecognition]);

  // TTS echo cooldown
  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
    if (isSpeaking) {
      ttsCooldownRef.current = true;
      if (ttsEndTimerRef.current) clearTimeout(ttsEndTimerRef.current);
    } else {
      if (ttsEndTimerRef.current) clearTimeout(ttsEndTimerRef.current);
      ttsEndTimerRef.current = setTimeout(() => {
        ttsCooldownRef.current = false;
        if (isVoiceModeRef.current && !isRunningRef.current) {
          startRecognition();
        }
      }, TTS_ECHO_COOLDOWN_MS);
    }
  }, [isSpeaking, startRecognition]);

  // Stop recognition when voice mode turns OFF — no cleanup so it never fires on turn-ON
  useEffect(() => {
    if (!isVoiceMode) stopRecognition();
  }, [isVoiceMode, stopRecognition]);

  // Unmount cleanup only
  useEffect(() => {
    return () => stopRecognition();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
});

export default VoiceInput;
