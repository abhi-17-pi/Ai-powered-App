import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import SoundWave from "./SoundWave";
import { API_BASE_URL } from "../config";

const IMAGE_REQUEST_PATTERN = /\b(?:create|generate|make|draw|design|illustrate|paint)\b[\s\S]{0,80}\b(?:image|picture|photo|illustration|artwork|art)\b|\b(?:image|picture|photo|illustration)\s+of\b/i;

// ------------------------------------
// Copyable Code Block
// ------------------------------------
function CodeBlock({ children }) {
  const [copied, setCopied] = useState(false);

  const code = children?.props?.children
    ? String(children.props.children).replace(/\n$/, "")
    : "";

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Copy failed:", error);
    }
  };

  return (
    <div className="code-block-wrapper">
      <button className="copy-code-btn" onClick={copyCode} title="Copy code">
        {copied ? "✓ Copied" : "📋 Copy"}
      </button>
      <pre>{children}</pre>
    </div>
  );
}

// ------------------------------------
// Chat Window
// ------------------------------------
export default function ChatWindow({
  conversationId,
  setConversationId,
  onMessageSent,
  webSearchEnabled,
  temperature,
  model,
  provider,
  voiceAssistant,
  onOpenVoiceModal,
}) {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedMessageIndex, setCopiedMessageIndex] = useState(null);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [imageMode, setImageMode] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const {
    isListening,
    transcript,
    startListening,
    stopListening,
    isSpeaking,
    activeSpeakingId,
    speak,
    stopSpeaking,
    autoTalkback,
    setAutoTalkback,
  } = voiceAssistant;

  // Focus input on conversation change
  useEffect(() => {
    if (conversationId) {
      inputRef.current?.focus();
    }
  }, [conversationId]);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading, transcript]);

  // Load selected conversation
  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      return;
    }

    const loadConversation = async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/conversations/`,
          { credentials: "include" }
        );
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Failed to load conversation");
        }
        setMessages(data.messages);
      } catch (error) {
        console.error("Load conversation error:", error);
      }
    };

    loadConversation();
  }, [conversationId]);

  // ------------------------------------
  // Send message
  // ------------------------------------
  const sendMessage = async (textToSend = null) => {
    const content = (textToSend || message).trim();
    if (!content) return;

    const shouldGenerateImage = imageMode || IMAGE_REQUEST_PATTERN.test(content);
    setMessage("");
    setImageMode(false);
    setIsLoading(true);
    setIsGeneratingImage(shouldGenerateImage);

    try {
      let activeConversationId = conversationId;

      // Automatically create a conversation if none exists
      if (!activeConversationId) {
        const conversationResponse = await fetch(
          `${API_BASE_URL}/api/conversations/`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
          }
        );
        const conversationData = await conversationResponse.json();
        if (!conversationResponse.ok) {
          throw new Error(
            conversationData.error || "Failed to create conversation"
          );
        }
        activeConversationId = conversationData.conversation_id;
        setConversationId(activeConversationId);
      }

      // Append user message immediately
      setMessages((prev) => [
        ...prev,
        {
          role: "user",
          content: content,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);

      // Send image prompts to the image endpoint; all other messages use chat.
      const response = await fetch(
        shouldGenerateImage
          ? `${API_BASE_URL}/api/image/`
          : `${API_BASE_URL}/api/chat/`,
        {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          conversation_id: activeConversationId,
          ...(shouldGenerateImage
            ? { prompt: content }
            : {
                message: content,
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
        throw new Error(data.error || "Something went wrong");
      }

      const assistantMsg = data.assistant_message;

      // Append assistant message
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: assistantMsg,
          image_url: data.image_url || "",
          sources: data.sources || [],
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);

      // Trigger sidebar conversation refresh
      if (onMessageSent) {
        onMessageSent();
      }

      // Auto-talkback if enabled
      if (autoTalkback && assistantMsg) {
        speak(assistantMsg, `msg-${messages.length + 1}`);
      }
    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `⚠️ **Error**: ${error.message || "Failed to connect to assistant. Please check your API key and connection."}`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setIsLoading(false);
      setIsGeneratingImage(false);
    }
  };

  // ------------------------------------
  // Microphone Dictation Toggle
  // ------------------------------------
  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening((finalTranscript) => {
        if (finalTranscript) {
          setMessage((prev) => (prev ? `${prev} ${finalTranscript}` : finalTranscript));
        }
      });
    }
  };

  // ------------------------------------
  // Copy message text
  // ------------------------------------
  const handleCopyMessage = async (content, index) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageIndex(index);
      setTimeout(() => setCopiedMessageIndex(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  // ------------------------------------
  // Per-message Talkback
  // ------------------------------------
  const handleToggleSpeak = (content, index) => {
    const msgId = `msg-${index}`;
    if (isSpeaking && activeSpeakingId === msgId) {
      stopSpeaking();
    } else {
      speak(content, msgId);
    }
  };

  // ------------------------------------
  // Export Chat
  // ------------------------------------
  const exportChat = (format = "markdown") => {
    setExportMenuOpen(false);
    if (!messages.length) {
      alert("No messages to export!");
      return;
    }

    let fileContent = "";
    let filename = `SmartAi-Conversation-${new Date().toISOString().slice(0, 10)}`;

    if (format === "markdown") {
      filename += ".md";
      fileContent = `# SmartAi Conversation\n*Exported on ${new Date().toLocaleString()}*\n\n---\n\n`;
      messages.forEach((m) => {
        const speaker = m.role === "user" ? "### 👤 User" : "### 🤖 SmartAi";
        fileContent += `${speaker} (${m.timestamp || ""})\n\n${m.content}\n\n---\n\n`;
      });
    } else {
      filename += ".txt";
      messages.forEach((m) => {
        const speaker = m.role === "user" ? "USER" : "SMARTAI";
        fileContent += `[${speaker} - ${m.timestamp || ""}]:\n${m.content}\n\n`;
      });
    }

    const blob = new Blob([fileContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a);
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  return (
    <main className="chat-window">
      {/* Header */}
      <header className="chat-header">
        <div className="chat-header-title-group">
          <div className="logo-sparkle">✦</div>
          <div>
            <h1>SmartAi Voice Assistant</h1>
            <p className="chat-subtitle">
              Fast cloud intelligence • Hands-free voice talkback
            </p>
          </div>
        </div>

        {/* Header Action Bar */}
        <div className="chat-header-actions">
          {/* Voice Assistant Mode Launcher */}
          <button
            className="voice-mode-header-btn"
            onClick={onOpenVoiceModal}
            title="Launch Interactive Hands-Free Voice Assistant HUD"
          >
            <span className="mic-pulse-icon">🎙️</span>
            <span>Voice Assistant</span>
          </button>

          {/* Auto-Talkback Toggle */}
          <button
            className={`header-tool-btn ${autoTalkback ? "active" : ""}`}
            onClick={() => setAutoTalkback(!autoTalkback)}
            title={autoTalkback ? "Auto-talkback is ON (speaking responses)" : "Auto-talkback is OFF"}
          >
            {autoTalkback ? "🔊 Auto-Speak ON" : "🔇 Auto-Speak OFF"}
          </button>

          {/* Export Chat Menu */}
          <div className="export-menu-container">
            <button
              className="header-tool-btn"
              onClick={() => setExportMenuOpen(!exportMenuOpen)}
              title="Export conversation"
            >
              📥 Export
            </button>
            {exportMenuOpen && (
              <div className="export-dropdown">
                <button onClick={() => exportChat("markdown")}>Export as Markdown (.md)</button>
                <button onClick={() => exportChat("text")}>Export as Plain Text (.txt)</button>
              </div>
            )}
          </div>

          {/* Stop current speech if active */}
          {isSpeaking && (
            <button className="header-tool-btn danger pulse" onClick={stopSpeaking} title="Stop audio playback">
              ⏹ Stop Audio
            </button>
          )}
        </div>
      </header>

      {/* Messages Feed */}
      <div className="messages">
        {messages.length === 0 ? (
          <div className="welcome-message">
            <div className="welcome-hero-badge">
              <div className="glowing-avatar">🤖</div>
              <h2>How can I help you today?</h2>
              <p>Type your question, or tap the microphone to start talking.</p>
            </div>

            <div className="quick-suggestions">
              <button
                className="suggestion-pill"
                onClick={() => sendMessage("What are the key differences between quantum computing and classical computing?")}
              >
                💡 Explain quantum vs classical computing
              </button>
              <button
                className="suggestion-pill"
                onClick={() => sendMessage("Give me 5 productive habits backed by neuroscience.")}
              >
                🧠 Neuroscience of productivity
              </button>
              <button
                className="suggestion-pill"
                onClick={() => sendMessage("Write a clean Python script using asyncio to fetch data concurrently.")}
              >
                🐍 Python asyncio concurrent fetcher
              </button>
              <button
                className="suggestion-pill voice-suggestion"
                onClick={onOpenVoiceModal}
              >
                🎙️ Start hands-free voice chat
              </button>
            </div>
          </div>
        ) : (
          <div className="message-list">
            {messages.map((msg, index) => {
              const isAssistant = msg.role === "assistant";
              const isThisSpeaking = isSpeaking && activeSpeakingId === `msg-${index}`;

              return (
                <div key={index} className={`message-wrapper ${msg.role}`}>
                  <div className="message-avatar">
                    {isAssistant ? "🤖" : "👤"}
                  </div>

                  <div className={`message-bubble ${msg.role}`}>
                    {/* Assistant Message Header / Actions */}
                    {isAssistant && (
                      <div className="message-action-bar">
                        <span className="model-tag">SmartAi</span>

                        <div className="bubble-actions">
                          {/* Talkback Listen/Stop Button */}
                          <button
                            className={`action-icon-btn ${isThisSpeaking ? "speaking active" : ""}`}
                            onClick={() => handleToggleSpeak(msg.content, index)}
                            title={isThisSpeaking ? "Stop speaking" : "Listen to this answer aloud"}
                          >
                            {isThisSpeaking ? "⏹ Stop" : "🔊 Listen"}
                          </button>

                          {/* Copy Button */}
                          <button
                            className="action-icon-btn"
                            onClick={() => handleCopyMessage(msg.content, index)}
                            title="Copy response"
                          >
                            {copiedMessageIndex === index ? "✓ Copied" : "📋 Copy"}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Content */}
                    <div className="message-content">
                      {isAssistant ? (
                        <>
                          {msg.image_url && (
                            <div className="generated-image-card">
                              <a
                                className="generated-image-link"
                                href={msg.image_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Open full size image"
                              >
                                <img
                                  className="generated-image"
                                  src={msg.image_url}
                                  alt="Generated artwork"
                                  loading="lazy"
                                />
                              </a>
                              <div className="generated-image-actions">
                                <a
                                  href={msg.image_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="image-action-link"
                                >
                                  🔍 Full Resolution
                                </a>
                              </div>
                            </div>
                          )}
                          <ReactMarkdown components={{ pre: CodeBlock }}>
                            {msg.content}
                          </ReactMarkdown>

                          {/* Sound wave when this specific message is talking */}
                          {isThisSpeaking && (
                            <div className="talking-inline-indicator">
                              <SoundWave active={true} color="orange" barCount={5} size="sm" />
                              <span className="speaking-label">Talking back...</span>
                            </div>
                          )}

                          {/* Sources for Web Search */}
                          {msg.sources && msg.sources.length > 0 && (
                            <div className="sources">
                              <h4>🔎 Live Web Sources</h4>
                              <div className="source-cards-grid">
                                {msg.sources.map((source, sourceIndex) => (
                                  <a
                                    key={sourceIndex}
                                    href={source.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="source-card"
                                  >
                                    <span className="source-title">
                                      {source.title || "Web Source"}
                                    </span>
                                    <span className="source-url">{source.url}</span>
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <p>{msg.content}</p>
                      )}
                    </div>

                    {msg.timestamp && (
                      <span className="message-timestamp">{msg.timestamp}</span>
                    )}
                  </div>
                </div>
              );
            })}

            {/* AI Thinking Loader */}
            {isLoading && (
              <div className="message-wrapper assistant">
                <div className="message-avatar">🤖</div>
                <div className="message-bubble assistant thinking-bubble">
                  <div className="thinking-dots">
                    <span className="dot"></span>
                    <span className="dot"></span>
                    <span className="dot"></span>
                  </div>
                  <span className="thinking-text">
                    {isGeneratingImage ? "Creating your image..." : "Thinking with cloud AI..."}
                  </span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Real-time Listening Banner */}
      {isListening && (
        <div className="live-dictation-banner">
          <div className="mic-live-pulse"></div>
          <span className="live-label">Listening:</span>
          <span className="live-transcript">
            {transcript || "Speak now, transcribing in real-time..."}
          </span>
          <button className="dictation-done-btn" onClick={toggleListening}>
            Done
          </button>
        </div>
      )}

      {/* Input Area */}
      <div className="chat-input-area">
        {/* Voice Dictation Button */}
        <button
          className={`mic-dictate-btn ${isListening ? "recording" : ""}`}
          onClick={toggleListening}
          title={isListening ? "Stop listening" : "Click to speak (Voice Dictation)"}
          disabled={isLoading}
        >
          {isListening ? (
            <span className="mic-icon recording-pulse">⏹</span>
          ) : (
            <span className="mic-icon">🎙️</span>
          )}
        </button>

        <button
          type="button"
          className={`image-mode-btn ${imageMode ? "active" : ""}`}
          onClick={() => setImageMode((enabled) => !enabled)}
          title={imageMode ? "Image Mode Active: Next prompt will generate an image (Click to turn off)" : "Turn on Image Generation Mode"}
          aria-pressed={imageMode}
          disabled={isLoading}
        >
          <span className="image-mode-icon">🎨</span>
          <span className="image-mode-text">{imageMode ? "Image Mode ON" : "Image"}</span>
        </button>

        {/* Text Input */}
        <input
          ref={inputRef}
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            isListening
              ? "Listening to your voice..."
              : imageMode
              ? "Describe the image you want to create..."
              : "Ask SmartAi or speak your question..."
          }
          disabled={isLoading}
        />

        {/* Send Button */}
        <button
          className="send-btn"
          onClick={() => sendMessage()}
          disabled={isLoading || (!message.trim() && !isListening)}
          title="Send message (Enter)"
        >
          ➤
        </button>
      </div>
    </main>
  );
}
