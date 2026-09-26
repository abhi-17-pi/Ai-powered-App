import { useState } from "react";
import "./Settings.css";

export default function Settings({
  onClose,
  webSearchEnabled,
  setWebSearchEnabled,
  temperature,
  setTemperature,
  model,
  setModel,
  provider,
  setProvider,
  voiceAssistant,
}) {
  const [activeTab, setActiveTab] = useState("ai"); // 'ai' | 'voice' | 'search'
  const [testPlaying, setTestPlaying] = useState(false);

  const {
    voices,
    selectedVoiceURI,
    setSelectedVoiceURI,
    speechRate,
    setSpeechRate,
    speechPitch,
    setSpeechPitch,
    autoTalkback,
    setAutoTalkback,
    speak,
    stopSpeaking,
  } = voiceAssistant;

  const handleTestVoice = () => {
    if (testPlaying) {
      stopSpeaking();
      setTestPlaying(false);
    } else {
      setTestPlaying(true);
      speak(
        "Hello! I am SmartAi, your ultra-fast voice assistant. My voice is ready.",
        "test-voice",
        () => setTestPlaying(false)
      );
    }
  };

  const handleProviderChange = (newProvider) => {
    setProvider(newProvider);
    localStorage.setItem("smartai_provider", newProvider);
    if (newProvider === "groq") {
      setModel("openai/gpt-oss-20b");
      localStorage.setItem("smartai_model", "openai/gpt-oss-20b");
    } else if (newProvider === "gemini") {
      setModel("gemini-2.0-flash");
      localStorage.setItem("smartai_model", "gemini-2.0-flash");
    } else if (newProvider === "openrouter") {
      setModel("meta-llama/llama-3.2-3b-instruct:free");
      localStorage.setItem("smartai_model", "meta-llama/llama-3.2-3b-instruct:free");
    }
  };

  const handleModelChange = (newModel) => {
    setModel(newModel);
    localStorage.setItem("smartai_model", newModel);
  };


  return (
    <div className="settings-overlay">
      <div className="settings-panel">
        {/* Header */}
        <div className="settings-header">
          <div className="settings-header-title">
            <span className="settings-title-icon">⚙️</span>
            <h2>Settings & Voice</h2>
          </div>
          <button className="settings-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="settings-tabs">
          <button
            className={`tab-btn ${activeTab === "ai" ? "active" : ""}`}
            onClick={() => setActiveTab("ai")}
          >
            ⚡ Cloud AI
          </button>
          <button
            className={`tab-btn ${activeTab === "voice" ? "active" : ""}`}
            onClick={() => setActiveTab("voice")}
          >
            🎙️ Voice & Audio
          </button>
          <button
            className={`tab-btn ${activeTab === "search" ? "active" : ""}`}
            onClick={() => setActiveTab("search")}
          >
            🌐 Preferences
          </button>
        </div>

        {/* Tab 1: AI Engine & API Key */}
        {activeTab === "ai" && (
          <div className="tab-content">
            {/* Provider Selection */}
            <div className="settings-section">
              <label className="settings-label">FREE AI PROVIDER</label>
              <div className="provider-grid">
                <button
                  type="button"
                  className={`provider-card ${provider === "groq" ? "selected" : ""}`}
                  onClick={() => handleProviderChange("groq")}
                >
                  <div className="provider-card-header">
                    <strong>Groq Cloud</strong>
                    <span className="badge-fast">⚡ Ultra Fast</span>
                  </div>
                  <p>500+ tokens/sec, 100% free tier. Instant answers.</p>
                </button>

                <button
                  type="button"
                  className={`provider-card ${provider === "gemini" ? "selected" : ""}`}
                  onClick={() => handleProviderChange("gemini")}
                >
                  <div className="provider-card-header">
                    <strong>Google Gemini</strong>
                    <span className="badge-free">Free Tier</span>
                  </div>
                  <p>Gemini 2.0 Flash via Google AI Studio.</p>
                </button>

                <button
                  type="button"
                  className={`provider-card ${provider === "openrouter" ? "selected" : ""}`}
                  onClick={() => handleProviderChange("openrouter")}
                >
                  <div className="provider-card-header">
                    <strong>OpenRouter</strong>
                    <span className="badge-free">Free Models</span>
                  </div>
                  <p>Free tier models including Llama 3.2 3B.</p>
                </button>
              </div>
            </div>

            {/* Model Selection */}
            <div className="settings-section">
              <label className="settings-label">MODEL</label>
              <select
                className="settings-select"
                value={model}
                onChange={(e) => handleModelChange(e.target.value)}
              >
                {provider === "groq" && (
                  <>
                    <option value="openai/gpt-oss-20b">
                      GPT-OSS 20B (Recommended - Ultra Fast & Reliable)
                    </option>
                    <option value="groq/compound-mini">
                      Groq Compound Mini (Fast & Smart)
                    </option>
                    <option value="openai/gpt-oss-120b">
                      GPT-OSS 120B (High Reasoning)
                    </option>
                    <option value="qwen/qwen3.8-27b">
                      Qwen 3.8 27B
                    </option>
                  </>
                )}
                {provider === "gemini" && (
                  <>
                    <option value="gemini-2.0-flash">Gemini 2.0 Flash (Fastest)</option>
                    <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                  </>
                )}
                {provider === "openrouter" && (
                  <>
                    <option value="meta-llama/llama-3.2-3b-instruct:free">
                      Meta Llama 3.2 3B (Free)
                    </option>
                    <option value="google/gemini-2.0-flash-lite-preview-02-05:free">
                      Gemini 2.0 Flash Lite (Free)
                    </option>
                  </>
                )}
              </select>
            </div>
          </div>
        )}

        {/* Tab 2: Voice & Talkback Settings */}
        {activeTab === "voice" && (
          <div className="tab-content">
            {/* Auto Talkback Toggle */}
            <div className="settings-section">
              <div className="settings-row">
                <div>
                  <strong>Auto-Speak Responses</strong>
                  <p>SmartAi automatically speaks aloud when answers arrive</p>
                </div>
                <button
                  type="button"
                  className={`toggle-switch ${autoTalkback ? "active" : ""}`}
                  onClick={() => setAutoTalkback(!autoTalkback)}
                >
                  <span className="toggle-knob"></span>
                </button>
              </div>
            </div>

            {/* Voice Accent Selection */}
            <div className="settings-section">
              <label className="settings-label">TALKBACK VOICE</label>
              <select
                className="settings-select"
                value={selectedVoiceURI}
                onChange={(e) => setSelectedVoiceURI(e.target.value)}
              >
                {voices.map((v) => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {v.name} ({v.lang})
                  </option>
                ))}
              </select>
            </div>

            {/* Speech Rate */}
            <div className="settings-section">
              <div className="slider-header">
                <strong>Voice Speed</strong>
                <span className="slider-value">{speechRate}x</span>
              </div>
              <input
                type="range"
                min="0.75"
                max="1.75"
                step="0.05"
                value={speechRate}
                onChange={(e) => setSpeechRate(parseFloat(e.target.value))}
                className="modern-slider"
              />
            </div>

            {/* Speech Pitch */}
            <div className="settings-section">
              <div className="slider-header">
                <strong>Voice Pitch</strong>
                <span className="slider-value">{speechPitch}</span>
              </div>
              <input
                type="range"
                min="0.6"
                max="1.4"
                step="0.1"
                value={speechPitch}
                onChange={(e) => setSpeechPitch(parseFloat(e.target.value))}
                className="modern-slider"
              />
            </div>

            {/* Voice Test Button */}
            <div className="settings-section">
              <button
                type="button"
                className={`test-voice-btn ${testPlaying ? "playing" : ""}`}
                onClick={handleTestVoice}
              >
                {testPlaying ? "⏹ Stop Test Audio" : "🔊 Preview Voice Sample"}
              </button>
            </div>
          </div>
        )}

        {/* Tab 3: Search & Preferences */}
        {activeTab === "search" && (
          <div className="tab-content">
            {/* Web Search */}
            <div className="settings-section">
              <div className="settings-row">
                <div>
                  <strong>Live Web Search</strong>
                  <p>Fetch up-to-date real-time facts and citations</p>
                </div>
                <button
                  type="button"
                  className={`toggle-switch ${webSearchEnabled ? "active" : ""}`}
                  onClick={() => setWebSearchEnabled(!webSearchEnabled)}
                >
                  <span className="toggle-knob"></span>
                </button>
              </div>
            </div>

            {/* Temperature Slider */}
            <div className="settings-section">
              <div className="slider-header">
                <strong>Creativity (Temperature)</strong>
                <span className="slider-value">{temperature}</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="modern-slider"
              />
              <p className="settings-subtext">
                Lower values (0.1–0.3) are more factual and precise; higher values (0.7–1.0) are more creative.
              </p>
            </div>

            {/* About Box */}
            <div className="settings-section about-box">
              <div className="about-branding">
                <strong>SmartAi Voice Assistant 2.0</strong>
                <span>Blazing-fast cloud AI • Zero local latency • Hands-free</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}