import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import SoundWave from "./SoundWave";
import API_BASE_URL from "../api";
export default function VoiceAssistantModal({
  isOpen,
  onClose,
  conversationId,
  setConversationId,
  onMessageSent,
  webSearchEnabled,
  temperature,
  model,
  provider,
  voiceAssistant,
}) {
  const {
    isListening,
    transcript,
    startListening,
    stopListening,
    isSpeaking,
    speak,
    stopSpeaking,
  } = voiceAssistant;

  const [status, setStatus] = useState("idle"); // idle | listening | thinking | speaking
  const [latestUserText, setLatestUserText] = useState("");
  const [latestAssistantText, setLatestAssistantText] = useState("");
  const [latestImageUrl, setLatestImageUrl] = useState("");
  const [continuousMode, setContinuousMode] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const IMAGE_REQUEST_PATTERN = /\b(?:create|generate|make|draw|design|illustrate|paint)\b[\s\S]{0,80}\b(?:image|picture|photo|illustration|artwork|art)\b|\b(?:image|picture|photo|illustration)\s+of\b/i;

  const transcriptTimeoutRef = useRef(null);
  const modalMountedRef = useRef(false);

  useEffect(() => {
    modalMountedRef.current = true;
    return () => {
      modalMountedRef.current = false;
      stopSpeaking();
      stopListening();
    };
  }, [stopSpeaking, stopListening]);

  // Sync internal state with hook states
  useEffect(() => {
    if (isListening) {
      setStatus("listening");
    } else if (isSpeaking) {
      setStatus("speaking");
    } else if (status !== "thinking") {
      setStatus("idle");
    }
  }, [isListening, isSpeaking, status]);

  // When modal opens, automatically start listening for first question
  useEffect(() => {
    if (isOpen) {
      setErrorMessage("");
      const timer = setTimeout(() => {
        handleStartListening();
      }, 400);
      return () => clearTimeout(timer);
    } else {
      stopListening();
      stopSpeaking();
    }
  }, [isOpen]);

  const handleStartListening = () => {
    setErrorMessage("");
    stopSpeaking();
    startListening((finalTranscript) => {
      if (finalTranscript && finalTranscript.trim()) {
        handleUserSpeechCompleted(finalTranscript.trim());
      }
    });
  };

  const handleUserSpeechCompleted = async (spokenText) => {
    stopListening();
    setLatestUserText(spokenText);
    setStatus("thinking");

    try {
      let activeConversationId = conversationId;
      setLatestImageUrl("");

      // Auto-create conversation if needed
      if (!activeConversationId) {
        const convRes = await fetch(`${API_BASE_URL}/api/conversations/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        });
        if (convRes.ok) {
          const convData = await convRes.json();
          activeConversationId = convData.conversation_id;
          setConversationId(activeConversationId);
        }
      }

      const isImageRequest = IMAGE_REQUEST_PATTERN.test(spokenText);

      // Send to backend
      const response = await fetch(
        isImageRequest
          ? `${API_BASE_URL}/api/images/generate/`
          : `${API_BASE_URL}/api/chat/`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            conversation_id: activeConversationId,
            ...(isImageRequest
              ? { prompt: spokenText }
              : {
                  message: spokenText,
                  web_search_enabled: webSearchEnabled,
                  temperature: temperature,
                  model: model,
                  provider: provider,
                }),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate AI response");
      }

      const reply = data.assistant_message || "";
      setLatestAssistantText(reply);
      if (data.image_url) {
        setLatestImageUrl(data.image_url);
      }
      setStatus("speaking");

      if (onMessageSent) onMessageSent();

      // Speak response aloud (Talkback)
      speak(reply, "voice-modal-latest", () => {
        if (!modalMountedRef.current) return;
        setStatus("idle");
        // In continuous hands-free mode, start listening again!
        if (continuousMode) {
          transcriptTimeoutRef.current = setTimeout(() => {
            if (modalMountedRef.current) {
              handleStartListening();
            }
          }, 800);
        }
      });
    } catch (err) {
      console.error("Voice chat error:", err);
      setErrorMessage(err.message || "An error occurred");
      setStatus("idle");
    }
  };

  const handleOrbClick = () => {
    if (status === "speaking") {
      stopSpeaking();
      setStatus("idle");
    } else if (status === "listening") {
      stopListening();
      setStatus("idle");
    } else if (status === "idle") {
      handleStartListening();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="voice-modal-backdrop">
      <div className="voice-modal-container">
        {/* Top Header */}
        <div className="voice-modal-header">
          <div className="voice-header-info">
            <span className="live-pill">● LIVE VOICE ASSISTANT</span>
            <h3>SmartAi Voice Mode</h3>
          </div>
          <button className="voice-close-btn" onClick={onClose} title="Exit Voice Mode">
            ✕
          </button>
        </div>

        {/* Central Orb & Visualizer */}
        <div className="voice-visualizer-section">
          <div
            className={`voice-orb ${status}`}
            onClick={handleOrbClick}
            title={
              status === "speaking"
                ? "Click to interrupt/stop"
                : status === "listening"
                ? "Click to pause listening"
                : "Click to start speaking"
            }
          >
            <div className="orb-inner">
              {status === "listening" && <span className="orb-icon">🎙️</span>}
              {status === "thinking" && <span className="orb-icon spin">✨</span>}
              {status === "speaking" && <span className="orb-icon pulse">🔊</span>}
              {status === "idle" && <span className="orb-icon">▶️</span>}
            </div>
            <div className="orb-ring ring-1"></div>
            <div className="orb-ring ring-2"></div>
            <div className="orb-ring ring-3"></div>
          </div>

          <div className="voice-status-text">
            {status === "listening" && (
              <span className="status-badge listening">
                Listening to you...
              </span>
            )}
            {status === "thinking" && (
              <span className="status-badge thinking">
                Generating fast response...
              </span>
            )}
            {status === "speaking" && (
              <span className="status-badge speaking">
                SmartAi is talking back...
              </span>
            )}
            {status === "idle" && (
              <span className="status-badge idle">
                Tap orb or mic to speak
              </span>
            )}
          </div>

          <SoundWave
            active={status === "listening" || status === "speaking"}
            color={status === "speaking" ? "cyan" : status === "listening" ? "purple" : "orange"}
            barCount={9}
            size="lg"
          />
        </div>

        {/* Transcript Dialogue Box */}
        <div className="voice-transcript-box">
          {errorMessage && (
            <div className="voice-error-banner">
              ⚠️ {errorMessage}
            </div>
          )}

          {status === "listening" && transcript && (
            <div className="transcript-bubble user live">
              <span className="transcript-label">You:</span>
              <p>{transcript} <span className="cursor">|</span></p>
            </div>
          )}

          {latestUserText && status !== "listening" && (
            <div className="transcript-bubble user">
              <span className="transcript-label">You said:</span>
              <p>{latestUserText}</p>
            </div>
          )}

          {latestAssistantText && (
            <div className="transcript-bubble assistant">
              <span className="transcript-label">SmartAi:</span>
              <div className="assistant-modal-markdown">
                <ReactMarkdown>{latestAssistantText}</ReactMarkdown>
              </div>
              {latestImageUrl && (
                <div className="voice-generated-image-wrap" style={{ marginTop: "12px" }}>
                  <a
                    href={latestImageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Open full size image"
                  >
                    <img
                      src={latestImageUrl}
                      alt="Generated by SmartAi"
                      style={{
                        maxWidth: "100%",
                        maxHeight: "260px",
                        borderRadius: "10px",
                        border: "1px solid rgba(139, 92, 246, 0.4)",
                        display: "block",
                      }}
                    />
                  </a>
                </div>
              )}
            </div>
          )}

          {!transcript && !latestUserText && !latestAssistantText && (
            <div className="transcript-placeholder">
              <p>Say something like <em>"Explain quantum physics in 2 sentences"</em> or <em>"Write a python script to parse CSV files"</em>...</p>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="voice-modal-controls">
          <button
            className={`voice-control-btn ${status === "listening" ? "active" : ""}`}
            onClick={status === "listening" ? stopListening : handleStartListening}
          >
            {status === "listening" ? "🛑 Stop Listening" : "🎙️ Speak Now"}
          </button>

          {status === "speaking" && (
            <button className="voice-control-btn danger" onClick={stopSpeaking}>
              ⏹ Interrupt / Stop Speech
            </button>
          )}

          <label className="continuous-mode-toggle">
            <input
              type="checkbox"
              checked={continuousMode}
              onChange={(e) => setContinuousMode(e.target.checked)}
            />
            <span>Hands-Free Auto Loop</span>
          </label>
        </div>
      </div>
    </div>
  );
}
