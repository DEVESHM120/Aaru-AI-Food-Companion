"use client";

import { useEffect, useRef, useCallback } from "react";

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

interface VoiceInputProps {
  isVoiceMode: boolean;
  isSpeaking: boolean;
  onInterimTranscript: (text: string) => void;
  onFinalTranscript: (text: string) => void;
  onListeningChange: (listening: boolean) => void;
}

const SILENCE_AFTER_FINAL_MS = 900;
const SILENCE_AFTER_SPEECH_END_MS = 600;
// How long after TTS ends to wait before starting recognition (prevents echo)
const TTS_ECHO_COOLDOWN_MS = 1200;

export default function VoiceInput({
  isVoiceMode,
  isSpeaking,
  onInterimTranscript,
  onFinalTranscript,
  onListeningChange,
}: VoiceInputProps) {
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const accumulatedRef = useRef("");
  const isRunningRef = useRef(false);
  const speechEndedRef = useRef(false);

  // Callback refs — always point to latest props, never stale in closures
  const onFinalRef = useRef(onFinalTranscript);
  const onInterimRef = useRef(onInterimTranscript);
  const onListeningRef = useRef(onListeningChange);

  useEffect(() => { onFinalRef.current = onFinalTranscript; }, [onFinalTranscript]);
  useEffect(() => { onInterimRef.current = onInterimTranscript; }, [onInterimTranscript]);
  useEffect(() => { onListeningRef.current = onListeningChange; }, [onListeningChange]);

  // BUG-003 fix: keep current isVoiceMode / isSpeaking in refs so onend never reads stale closure values
  const isVoiceModeRef = useRef(isVoiceMode);
  const isSpeakingRef = useRef(isSpeaking);
  useEffect(() => { isVoiceModeRef.current = isVoiceMode; }, [isVoiceMode]);

  // BUG-011 fix: TTS echo cooldown refs — effect is declared after startRecognition below
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

  // BUG-003 + BUG-011 fix: startRecognition no longer captures isVoiceMode/isSpeaking in closure.
  // Instead it reads from refs, so onend always sees current values.
  const startRecognition = useCallback(() => {
    // Don't start if echo cooldown is active (TTS just played)
    if (ttsCooldownRef.current) return;

    const SpeechRecognitionClass =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionClass) return;

    const recognition = new SpeechRecognitionClass();
    recognition.lang = "en-IN";
    recognition.continuous = true;
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
      if (accumulatedRef.current.trim()) submitAccumulated();
      // Read from refs — never stale (BUG-003 fix)
      if (isVoiceModeRef.current && !isSpeakingRef.current && !ttsCooldownRef.current) {
        setTimeout(() => {
          if (!isRunningRef.current && !ttsCooldownRef.current) startRecognition();
        }, 200);
      } else {
        onListeningRef.current(false);
      }
    };

    recognition.onerror = (e: any) => {
      isRunningRef.current = false;
      if (e.error !== "no-speech" && e.error !== "aborted") {
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
        const delay = speechEndedRef.current
          ? SILENCE_AFTER_SPEECH_END_MS
          : SILENCE_AFTER_FINAL_MS;
        scheduleSubmit(delay);
      }
    };

    recognition.start();
  // BUG-003 fix: isVoiceMode and isSpeaking removed from deps — read via refs instead
  }, [scheduleSubmit, submitAccumulated]);

  // BUG-011 fix: manage echo cooldown; restart recognition after cooldown expires
  // Declared after startRecognition so the reference is available
  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
    if (isSpeaking) {
      ttsCooldownRef.current = true;
      if (ttsEndTimerRef.current) clearTimeout(ttsEndTimerRef.current);
    } else {
      if (ttsEndTimerRef.current) clearTimeout(ttsEndTimerRef.current);
      ttsEndTimerRef.current = setTimeout(() => {
        ttsCooldownRef.current = false;
        // Resume listening after echo decay — this is the missing restart after TTS ends
        if (isVoiceModeRef.current && !isRunningRef.current) {
          startRecognition();
        }
      }, TTS_ECHO_COOLDOWN_MS);
    }
  }, [isSpeaking, startRecognition]);

  useEffect(() => {
    if (isVoiceMode && !isSpeaking && !ttsCooldownRef.current) {
      if (!isRunningRef.current) startRecognition();
    } else {
      stopRecognition();
    }
    return () => {
      if (!isVoiceMode) stopRecognition();
    };
  }, [isVoiceMode, isSpeaking, startRecognition, stopRecognition]);

  useEffect(() => {
    return () => stopRecognition();
  }, [stopRecognition]);

  return null;
}
