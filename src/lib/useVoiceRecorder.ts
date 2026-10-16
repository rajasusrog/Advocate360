import { useState, useRef, useEffect, useCallback } from 'react';

// Format legal jargon commonly used in Indian advocate chambers
export function formatLegalDictation(text: string): string {
  if (!text) return '';
  let formatted = text;

  // Replacements for common Indian legal terminology spoken into microphone
  const legalReplacements: [RegExp, string][] = [
    [/\bsection\s+(\d+)\s*(a|b|c|d|e)?\b/gi, 'Sec. $1$2'],
    [/\barticle\s+(\d+)\b/gi, 'Art. $1'],
    [/\border\s+(\d+)\s*rule\s+(\d+)\b/gi, 'Order $1 Rule $2 CPC'],
    [/\bi\s*p\s*c\b/gi, 'IPC'],
    [/\bc\s*r\s*p\s*c\b/gi, 'CrPC'],
    [/\bc\s*p\s*c\b/gi, 'CPC'],
    [/\bb\s*n\s*s\b/gi, 'BNS (Bharatiya Nyaya Sanhita)'],
    [/\bb\s*n\s*s\s*s\b/gi, 'BNSS (Bharatiya Nagarik Suraksha Sanhita)'],
    [/\bb\s*s\s*a\b/gi, 'BSA (Bharatiya Sakshya Adhiniyam)'],
    [/\bversus\b/gi, 'vs.'],
    [/\bv\s*\.\s*s\b/gi, 'vs.'],
    [/\bhonourable\b/gi, "Hon'ble"],
    [/\bhonorable\b/gi, "Hon'ble"],
    [/\bhigh\s*court\b/gi, 'High Court'],
    [/\bsupreme\s*court\b/gi, 'Supreme Court'],
    [/\bcourt\s*hall\b/gi, 'Court Hall'],
    [/\bcause\s*list\b/gi, 'Cause List'],
    [/\bvakalath\b/gi, 'Vakalatnama'],
    [/\bvakat\b/gi, 'Vakalatnama'],
    [/\binterim\s*injunction\b/gi, 'Interim Injunction (O.39 R.1&2)'],
    [/\bcaveat\s*petition\b/gi, 'Caveat Petition u/s 148A CPC'],
    [/\blimitation\s*act\b/gi, 'Limitation Act, 1963']
  ];

  for (const [pattern, replacement] of legalReplacements) {
    formatted = formatted.replace(pattern, replacement);
  }

  // Capitalize first letter of sentences
  formatted = formatted.replace(/(^\s*|\.\s+)([a-z])/g, (_, sep, char) => sep + char.toUpperCase());

  return formatted;
}

export interface VoiceRecorderState {
  isRecording: boolean;
  transcript: string;
  interimTranscript: string;
  recordingDuration: number;
  audioBlob: Blob | null;
  audioUrl: string | null;
  error: string | null;
  isSupported: boolean;
}

export function useVoiceRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  const isSupported = typeof window !== 'undefined' && 
    ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window);

  // Initialize Speech Recognition
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRec) {
      try {
        const recognition = new SpeechRec();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-IN'; // Indian English legal dictation

        recognition.onresult = (event: any) => {
          let currentInterim = '';
          let currentFinal = '';

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const piece = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              currentFinal += piece + ' ';
            } else {
              currentInterim += piece;
            }
          }

          if (currentFinal) {
            const formatted = formatLegalDictation(currentFinal);
            setTranscript((prev) => (prev ? `${prev} ${formatted}` : formatted));
          }
          setInterimTranscript(currentInterim);
        };

        recognition.onerror = (evt: any) => {
          console.warn('Speech recognition event warning:', evt.error);
          if (evt.error === 'not-allowed') {
            setError('Microphone access blocked. Please permit microphone access in browser settings.');
          } else if (evt.error !== 'no-speech') {
            setError(`Speech recognition note: ${evt.error}`);
          }
        };

        recognition.onend = () => {
          // If still marked as recording, restart (unless manually stopped)
          if (isRecording) {
            try {
              recognition.start();
            } catch {
              // Ignore restart collision
            }
          }
        };

        recognitionRef.current = recognition;
      } catch (e: any) {
        console.warn('Could not initialize SpeechRecognition:', e);
      }
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  const startRecording = useCallback(async () => {
    setError(null);
    setInterimTranscript('');
    audioChunksRef.current = [];
    setRecordingDuration(0);

    // 1. Try to start MediaRecorder for audio playback
    if (navigator?.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = () => {
          const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          setAudioBlob(blob);
          const url = URL.createObjectURL(blob);
          setAudioUrl(url);
          // Stop stream tracks
          stream.getTracks().forEach((track) => track.stop());
        };

        mediaRecorder.start(250);
      } catch (micErr: any) {
        console.warn('MediaRecorder audio capture notice:', micErr);
        // Do not crash if microphone is blocked or running in restricted iframe
      }
    }

    // 2. Start SpeechRecognition
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
      } catch (recErr) {
        console.warn('Speech recognition start note:', recErr);
      }
    }

    setIsRecording(true);

    // 3. Start Duration Timer
    timerRef.current = window.setInterval(() => {
      setRecordingDuration((prev) => prev + 1);
    }, 1000);
  }, []);

  const stopRecording = useCallback(() => {
    setIsRecording(false);

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
  }, []);

  const resetRecording = useCallback(() => {
    stopRecording();
    setTranscript('');
    setInterimTranscript('');
    setRecordingDuration(0);
    setAudioBlob(null);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    setError(null);
  }, [stopRecording, audioUrl]);

  // Fallback simulator for demonstrations when microphone is blocked/unavailable
  const insertSampleCourtDictation = useCallback((sampleText?: string) => {
    const defaultDictation = sampleText || 
      "Urgent Court Memo: In the matter of Ramesh Kumar vs. Suresh Kumar, verified that parent title deed dated 12-04-1995 explicitly reserves ancestral easement rights. Cross-examine respondent on oral partition claims under Article 59 Limitation Act.";
    const formatted = formatLegalDictation(defaultDictation);
    setTranscript((prev) => (prev ? `${prev} ${formatted}` : formatted));
  }, []);

  return {
    isRecording,
    transcript,
    setTranscript,
    interimTranscript,
    recordingDuration,
    audioBlob,
    audioUrl,
    error,
    isSupported,
    startRecording,
    stopRecording,
    resetRecording,
    insertSampleCourtDictation
  };
}
