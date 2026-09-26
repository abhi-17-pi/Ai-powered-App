import { useState, useEffect, useRef, useCallback } from "react";

/**
 * Strips Markdown formatting, code snippets, and URLs
 * to generate clean, natural-sounding speech for Text-To-Speech (TTS).
 */
export function cleanMarkdownForSpeech(text) {
  if (!text) return "";

  let cleaned = text;

  // 1. Remove code blocks
  cleaned = cleaned.replace(/```[\s\S]*?```/g, " ");

  // 2. Remove inline code backticks
  cleaned = cleaned.replace(/`([^`]+)`/g, "$1");

  // 3. Remove Markdown links [text](url) -> keep text only
  cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

  // 4. Remove bare URLs
  cleaned = cleaned.replace(/https?:\/\/\S+/g, " ");

  // 5. Remove HTML tags
  cleaned = cleaned.replace(/<[^>]+>/g, " ");

  // 6. Remove Markdown table syntax:
  // Remove table separator rows (e.g. |---|---| or |:---:|)
  cleaned = cleaned.replace(/\|?[\s\-:|]{3,}\|?/g, " ");
  // Replace remaining table pipe separators (|) with a comma/pause
  cleaned = cleaned.replace(/\|+/g, ", ");

  // 7. Remove markdown headers (#, ##, ### anywhere, even if preceded by dashes or spaces)
  cleaned = cleaned.replace(/#{1,6}\s*/g, "");

  // 8. Remove horizontal rules and repeated dashes, underscores, equals (---, - --, ===, ___)
  cleaned = cleaned.replace(/[\-_=*]{2,}/g, " ");

  // 9. Remove bold, italic, strikethrough markers
  cleaned = cleaned.replace(/\*\*(.*?)\*\*/g, "$1");
  cleaned = cleaned.replace(/\*(.*?)\*/g, "$1");
  cleaned = cleaned.replace(/__(.*?)__/g, "$1");
  cleaned = cleaned.replace(/_(.*?)_/g, "$1");
  cleaned = cleaned.replace(/~~(.*?)~~/g, "$1");

  // 10. Remove stray markdown symbols and brackets
  cleaned = cleaned.replace(/[*~`#^><\\/{}\[\]]/g, " ");

  // 11. Remove bullet dashes/pluses at start of lines or between words
  cleaned = cleaned.replace(/(^|\s)[\-+•]\s+/g, " ");

  // 12. Clean double hyphens and dashes
  cleaned = cleaned.replace(/[\-–—]{2,}/g, " ");

  // 13. Convert common symbols to spoken words
  cleaned = cleaned.replace(/\s*&\s*/g, " and ");
  cleaned = cleaned.replace(/%/g, " percent");

  // 14. Clean repetitive commas, periods, and weird punctuation
  cleaned = cleaned.replace(/,\s*,+/g, ",");
  cleaned = cleaned.replace(/\.\s*\.+/g, ".");
  cleaned = cleaned.replace(/\s*,\s*\./g, ".");
  cleaned = cleaned.replace(/,\s*\./g, ".");

  // 15. Clean excessive whitespace
  cleaned = cleaned.replace(/\s+/g, " ").trim();

  return cleaned;
}

export function useVoiceAssistant() {
  // Speech Recognition (STT) State
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [sttSupported, setSttSupported] = useState(false);

  // Speech Synthesis (TTS) State
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [activeSpeakingId, setActiveSpeakingId] = useState(null);
  const [voices, setVoices] = useState([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState(
    () => localStorage.getItem("smartai_voice_uri") || ""
  );
  const [speechRate, setSpeechRate] = useState(
    () => parseFloat(localStorage.getItem("smartai_speech_rate")) || 1.0
  );
  const [speechPitch, setSpeechPitch] = useState(
    () => parseFloat(localStorage.getItem("smartai_speech_pitch")) || 1.0
  );
  const [autoTalkback, setAutoTalkback] = useState(
    () => localStorage.getItem("smartai_auto_talkback") === "true"
  );

  const recognitionRef = useRef(null);
  const onFinalResultCallbackRef = useRef(null);

  // ----------------------------------------------------
  // Initialize Voices & TTS
  // ----------------------------------------------------
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }

    const updateVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      setVoices(availableVoices);

      // Default to an English voice if none selected yet
      if (!selectedVoiceURI && availableVoices.length > 0) {
        const defaultVoice =
          availableVoices.find(
            (v) => v.lang.startsWith("en") && (v.name.includes("Google") || v.name.includes("Natural") || v.default)
          ) || availableVoices.find((v) => v.lang.startsWith("en")) || availableVoices[0];

        if (defaultVoice) {
          setSelectedVoiceURI(defaultVoice.voiceURI);
          localStorage.setItem("smartai_voice_uri", defaultVoice.voiceURI);
        }
      }
    };

    updateVoices();
    window.speechSynthesis.onvoiceschanged = updateVoices;

    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, [selectedVoiceURI]);

  // Save settings updates to localStorage
  const updateSelectedVoice = (uri) => {
    setSelectedVoiceURI(uri);
    localStorage.setItem("smartai_voice_uri", uri);
  };

  const updateSpeechRate = (rate) => {
    setSpeechRate(rate);
    localStorage.setItem("smartai_speech_rate", String(rate));
  };

  const updateSpeechPitch = (pitch) => {
    setSpeechPitch(pitch);
    localStorage.setItem("smartai_speech_pitch", String(pitch));
  };

  const updateAutoTalkback = (enabled) => {
    setAutoTalkback(enabled);
    localStorage.setItem("smartai_auto_talkback", String(enabled));
  };

  // ----------------------------------------------------
  // Text-To-Speech (Talkback)
  // ----------------------------------------------------
  const stopSpeaking = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    setActiveSpeakingId(null);
  }, []);

  const speak = useCallback(
    (rawText, messageId = null, onEndCallback = null) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        return;
      }

      // Stop any ongoing speech
      window.speechSynthesis.cancel();

      const spokenText = cleanMarkdownForSpeech(rawText);
      if (!spokenText) return;

      const utterance = new SpeechSynthesisUtterance(spokenText);
      utterance.rate = speechRate;
      utterance.pitch = speechPitch;

      // Select voice if available
      if (selectedVoiceURI) {
        const voiceObj = voices.find((v) => v.voiceURI === selectedVoiceURI);
        if (voiceObj) utterance.voice = voiceObj;
      }

      utterance.onstart = () => {
        setIsSpeaking(true);
        setActiveSpeakingId(messageId);
      };

      utterance.onend = () => {
        setIsSpeaking(false);
        setActiveSpeakingId(null);
        if (onEndCallback) onEndCallback();
      };

      utterance.onerror = (event) => {
        console.warn("Speech synthesis notice:", event.error);
        setIsSpeaking(false);
        setActiveSpeakingId(null);
      };

      window.speechSynthesis.speak(utterance);
    },
    [speechRate, speechPitch, selectedVoiceURI, voices]
  );

  // ----------------------------------------------------
  // Speech-To-Text (Voice Recognition)
  // ----------------------------------------------------
  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (SpeechRecognition) {
      setSttSupported(true);
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event) => {
        let interimTranscript = "";
        let finalTranscript = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        const currentText = finalTranscript || interimTranscript;
        setTranscript(currentText);

        if (finalTranscript && onFinalResultCallbackRef.current) {
          onFinalResultCallbackRef.current(finalTranscript);
        }
      };

      recognition.onerror = (event) => {
        console.warn("Speech recognition error:", event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    } else {
      setSttSupported(false);
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  const startListening = useCallback((onFinalResult) => {
    if (!recognitionRef.current) {
      alert("Speech recognition is not supported in this browser. Please use Google Chrome or Microsoft Edge.");
      return;
    }

    // If already speaking, stop talkback before listening
    stopSpeaking();

    setTranscript("");
    onFinalResultCallbackRef.current = onFinalResult || null;

    try {
      recognitionRef.current.start();
    } catch {
      // If already started, stop and restart
      try {
        recognitionRef.current.stop();
        setTimeout(() => recognitionRef.current.start(), 100);
      } catch (err) {
        console.error("Start speech recognition failed:", err);
      }
    }
  }, [stopSpeaking]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (err) {
        console.error("Stop speech recognition failed:", err);
      }
    }
    setIsListening(false);
  }, []);

  return {
    // STT
    isListening,
    transcript,
    sttSupported,
    startListening,
    stopListening,
    setTranscript,

    // TTS
    isSpeaking,
    activeSpeakingId,
    speak,
    stopSpeaking,
    voices,
    selectedVoiceURI,
    setSelectedVoiceURI: updateSelectedVoice,
    speechRate,
    setSpeechRate: updateSpeechRate,
    speechPitch,
    setSpeechPitch: updateSpeechPitch,
    autoTalkback,
    setAutoTalkback: updateAutoTalkback,
  };
}
