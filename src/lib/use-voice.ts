"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Records mic audio and transcribes it server-side. Used by the chat composer
 * so a voice turn ends up as normal editable text (safer than auto-sending a
 * possibly-misheard prompt).
 */
export function useVoiceInput(onText: (text: string) => void) {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [error, setError] = useState("");
  const [supported, setSupported] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    setSupported(typeof window !== "undefined" && Boolean(navigator?.mediaDevices?.getUserMedia) && typeof MediaRecorder !== "undefined");
  }, []);

  const stop = useCallback(() => {
    recorderRef.current?.stop();
    setRecording(false);
  }, []);

  const start = useCallback(async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        if (blob.size < 1200) {
          setError("Rekaman terlalu pendek.");
          return;
        }
        setTranscribing(true);
        try {
          const form = new FormData();
          form.append("audio", blob, "recording.webm");
          const res = await fetch("/api/voice/stt", { method: "POST", body: form });
          const data = await res.json();
          if (!res.ok) throw new Error(data?.error || "Transkripsi gagal.");
          if (data.text) onText(data.text);
          else setError("Tidak ada suara yang terdeteksi.");
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setTranscribing(false);
        }
      };

      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
    } catch (e) {
      setError((e as Error).message || "Mic tidak bisa diakses.");
    }
  }, [onText]);

  const toggle = useCallback(() => {
    if (recording) stop();
    else void start();
  }, [recording, start, stop]);

  return { recording, transcribing, error, supported, toggle, start, stop, setError };
}

/** Plays TTS audio for a chat message, one playback at a time. */
export function useVoicePlayback() {
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stop = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    setSpeakingId(null);
  }, []);

  const speak = useCallback(async (id: string, text: string) => {
    if (speakingId === id) {
      stop();
      return;
    }
    stop();
    setLoadingId(id);
    try {
      const res = await fetch("/api/voice/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Gagal membuat suara.");
      }
      const blob = await res.blob();
      const audio = new Audio(URL.createObjectURL(blob));
      audioRef.current = audio;
      audio.onended = () => setSpeakingId(null);
      audio.onerror = () => setSpeakingId(null);
      await audio.play();
      setSpeakingId(id);
    } catch {
      setSpeakingId(null);
    } finally {
      setLoadingId(null);
    }
  }, [speakingId, stop]);

  useEffect(() => () => { audioRef.current?.pause(); }, []);

  return { speak, stop, speakingId, loadingId };
}
