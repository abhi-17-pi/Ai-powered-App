import { useState, useEffect, useCallback } from "react";
import Sidebar from "./components/Sidebar";
import ChatWindow from "./components/ChatWindow";
import Settings from "./components/Settings";
import VoiceAssistantModal from "./components/VoiceAssistantModal";
import Register from "./Register";
import Login from "./Login";
import { useVoiceAssistant } from "./hooks/useVoiceAssistant";
import "./App.css";

function App() {
  const [conversationId, setConversationId] = useState(null);
  const [webSearchEnabled, setWebSearchEnabled] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [temperature, setTemperature] = useState(0.2);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Cloud AI Provider State
  const [provider, setProvider] = useState(
    () => localStorage.getItem("smartai_provider") || "groq"
  );
  const [model, setModel] = useState(
    () => localStorage.getItem("smartai_model") || "openai/gpt-oss-20b"
  );

  // Voice Assistant Hook
  const voiceAssistant = useVoiceAssistant();

  // Authentication State
  const [showRegister, setShowRegister] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  const checkCurrentUser = useCallback(async () => {
    try {
      const response = await fetch("http://localhost:8000/api/auth/me/", {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data);
        return data;
      } else {
        setUser(null);
        return null;
      }
    } catch (error) {
      console.error("Auth check failed:", error);
      setUser(null);
      return null;
    } finally {
      setAuthChecked(true);
    }
  }, []);

  useEffect(() => {
    checkCurrentUser();
  }, [checkCurrentUser]);

  const onLoginSuccess = async () => {
    const authenticatedUser = await checkCurrentUser();
    if (authenticatedUser) {
      setShowLogin(false);
      return true;
    }

    return false;
  };

  const handleLogout = async () => {
    try {
      const response = await fetch("http://localhost:8000/api/auth/logout/", {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Logout failed");
      }

      voiceAssistant.stopListening();
      voiceAssistant.stopSpeaking();
      setUser(null);
      setConversationId(null);
      setShowSettings(false);
      setShowVoiceModal(false);
      setMobileSidebarOpen(false);
      setRefreshKey((prev) => prev + 1);
      return true;
    } catch (error) {
      console.error("Logout failed:", error);
      return false;
    }
  };

  const handleSwitchAccount = async () => {
    const loggedOut = await handleLogout();
    if (loggedOut) {
      setShowLogin(true);
    }

    return loggedOut;
  };

  const refreshConversations = () => {
    setRefreshKey((prev) => prev + 1);
  };

  if (!authChecked) {
    return (
      <div className="app-loading-screen">
        <div className="app-loader-orb"></div>
        <p>Initializing SmartAi...</p>
      </div>
    );
  }

  return (
    <div className="app">
      {!user ? (
        <>
          <div className="auth-bar">
            <button className="auth-nav-btn secondary" onClick={() => setShowRegister(true)}>
              Register
            </button>
            <button className="auth-nav-btn primary" onClick={() => setShowLogin(true)}>
              Login
            </button>
          </div>

          <div className="login-required">
            <div className="login-required-card">
              <div className="login-required-icon">⚡</div>
              <h1>SmartAi Assistant</h1>
              <p>
                Experience ultra-fast cloud intelligence with hands-free voice chat and natural talkback.
              </p>

              <div className="login-required-actions">
                <button className="primary-btn" onClick={() => setShowLogin(true)}>
                  Sign In
                </button>
                <button
                  className="secondary-auth-btn"
                  onClick={() => setShowRegister(true)}
                >
                  Create Account
                </button>
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Top Bar for Mobile & Quick Actions */}
          <div className="mobile-nav-bar">
            <button
              className="hamburger-btn"
              onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
              title="Toggle sidebar"
            >
              ☰
            </button>
            <span className="mobile-brand">⚡ SmartAi</span>
            <button className="mobile-logout-btn" onClick={handleLogout}>
              Logout
            </button>
          </div>

          {/* Sidebar */}
          <Sidebar
            conversationId={conversationId}
            setConversationId={setConversationId}
            refreshKey={refreshKey}
            onOpenSettings={() => setShowSettings(true)}
            onLogout={handleLogout}
            onSwitchAccount={handleSwitchAccount}
            user={user}
            isOpen={mobileSidebarOpen}
            onClose={() => setMobileSidebarOpen(false)}
          />

          {/* Main Chat Interface */}
          <ChatWindow
            conversationId={conversationId}
            setConversationId={setConversationId}
            onMessageSent={refreshConversations}
            webSearchEnabled={webSearchEnabled}
            temperature={temperature}
            model={model}
            provider={provider}
            voiceAssistant={voiceAssistant}
            onOpenVoiceModal={() => setShowVoiceModal(true)}
          />

          {/* Interactive Voice Assistant HUD Modal */}
          <VoiceAssistantModal
            isOpen={showVoiceModal}
            onClose={() => setShowVoiceModal(false)}
            conversationId={conversationId}
            setConversationId={setConversationId}
            onMessageSent={refreshConversations}
            webSearchEnabled={webSearchEnabled}
            temperature={temperature}
            model={model}
            provider={provider}
            voiceAssistant={voiceAssistant}
          />
        </>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <Settings
          webSearchEnabled={webSearchEnabled}
          setWebSearchEnabled={setWebSearchEnabled}
          temperature={temperature}
          setTemperature={setTemperature}
          model={model}
          setModel={setModel}
          provider={provider}
          setProvider={setProvider}
          voiceAssistant={voiceAssistant}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* Auth Modals */}
      {showRegister && (
        <Register
          onClose={() => setShowRegister(false)}
          onRegisterSuccess={() => {
            setShowRegister(false);
            setShowLogin(true);
          }}
        />
      )}

      {showLogin && (
        <Login
          onClose={() => setShowLogin(false)}
          onLoginSuccess={onLoginSuccess}
          onShowRegister={() => {
            setShowLogin(false);
            setShowRegister(true);
          }}
        />
      )}
    </div>
  );
}

export default App;
