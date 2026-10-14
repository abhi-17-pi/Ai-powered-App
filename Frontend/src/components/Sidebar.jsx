import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { API_BASE_URL } from "../config";

export default function Sidebar({
  conversationId,
  setConversationId,
  refreshKey,
  onOpenSettings,
  onLogout,
  onSwitchAccount,
  user,
  isOpen,
  onClose,
}) {
  const [conversations, setConversations] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [accountActionPending, setAccountActionPending] = useState(false);
  const [accountActionError, setAccountActionError] = useState("");
  const accountMenuRef = useRef(null);

  // Close account menu when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(e.target)) {
        setAccountMenuOpen(false);
      }
    };
    if (accountMenuOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [accountMenuOpen]);


  const loadConversations = useCallback(async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/conversations/`,
        { credentials: "include" }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to load conversations");
      }
      setConversations(data.conversations || []);
    } catch (error) {
      console.error("Load conversations error:", error);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations, refreshKey]);

  const createNewChat = async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/conversations/`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to create conversation");
      }
      setConversationId(data.conversation_id);
      await loadConversations();
      if (onClose) onClose();
    } catch (error) {
      console.error("New chat error:", error);
    }
  };

  const deleteConversation = async (id, event) => {
    event.stopPropagation();
    if (!window.confirm("Delete this conversation?")) return;

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/conversations/${id}/`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to delete conversation");
      }
      setConversations((prev) => prev.filter((conv) => conv.id !== id));
      setConversationId((currentId) => (currentId === id ? null : currentId));
    } catch (error) {
      console.error("Delete conversation error:", error);
    }
  };

  const runAccountAction = async (action) => {
    if (!action || accountActionPending) return;

    setAccountActionError("");
    setAccountActionPending(true);

    try {
      const succeeded = await action();
      if (!succeeded) {
        setAccountActionError("Could not update your session. Please try again.");
      }
    } catch (error) {
      console.error("Account action error:", error);
      setAccountActionError("Could not update your session. Please try again.");
    } finally {
      setAccountActionPending(false);
    }
  };

  // Filter conversations by search query
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const query = searchQuery.toLowerCase();
    return conversations.filter((c) =>
      c.title.toLowerCase().includes(query)
    );
  }, [conversations, searchQuery]);

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && <div className="sidebar-backdrop" onClick={onClose} />}

      <aside className={`sidebar ${isOpen ? "open" : ""}`}>
        {/* Brand Header */}
        <div className="sidebar-header">
          <div className="brand-logo-wrap">
            <span className="brand-icon">⚡</span>
            <h2 className="brand-name">SmartAi</h2>
          </div>
          {onClose && (
            <button className="sidebar-mobile-close-btn" onClick={onClose}>
              ✕
            </button>
          )}
        </div>

        {/* New Chat Button */}
        <button className="new-chat-btn" onClick={createNewChat}>
          <span className="btn-plus">+</span>
          <span>New Conversation</span>
        </button>

        {/* Conversation Search Bar */}
        <div className="sidebar-search-box">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search chats..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="search-clear-btn" onClick={() => setSearchQuery("")}>
              ✕
            </button>
          )}
        </div>

        {/* Recent Chats */}
        <div className="recent-chats">
          <div className="recent-chats-header">
            <h3>Recent Chats</h3>
            <span className="chat-counter-badge">{filteredConversations.length}</span>
          </div>

          {filteredConversations.length === 0 ? (
            <div className="empty-chats-hint">
              {searchQuery ? "No matches found" : "No conversations yet"}
            </div>
          ) : (
            filteredConversations.map((conversation) => (
              <div
                key={conversation.id}
                className={`chat-item ${
                  conversationId === conversation.id ? "active-chat" : ""
                }`}
                onClick={() => {
                  setConversationId(conversation.id);
                  if (onClose) onClose();
                }}
              >
                <span className="chat-icon">💬</span>
                <span className="chat-title">{conversation.title}</span>

                <button
                  className="delete-chat-btn"
                  onClick={(event) => deleteConversation(conversation.id, event)}
                  title="Delete conversation"
                >
                  🗑
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer Area: User & Settings */}
        <div className="sidebar-footer">
          {user && (
            <div className="account-menu-wrap" ref={accountMenuRef}>
              {accountMenuOpen && (
                <div className="account-menu" role="menu" aria-label="Account options">
                  <div className="account-menu-details">
                    <span className="account-menu-label">Signed in as</span>
                    <strong className="account-menu-name">{user.username || "User"}</strong>
                    <span className="account-menu-email">{user.email || "No email registered"}</span>
                    <div className="account-menu-meta">
                      {user.user_id && <span className="account-menu-id">ID: #{user.user_id}</span>}
                      {user.date_joined && <span className="account-menu-date">• Joined {user.date_joined}</span>}
                    </div>
                  </div>

                  {accountActionError && (
                    <p className="account-action-error" role="alert">
                      {accountActionError}
                    </p>
                  )}

                  <div className="account-menu-divider" />

                  <button
                    type="button"
                    className="account-menu-action"
                    onClick={() => {
                      setAccountMenuOpen(false);
                      runAccountAction(onSwitchAccount);
                    }}
                    disabled={accountActionPending}
                  >
                    🔄 Switch Account / Login
                  </button>

                  <button
                    type="button"
                    className="account-menu-action logout"
                    onClick={() => {
                      setAccountMenuOpen(false);
                      runAccountAction(onLogout);
                    }}
                    disabled={accountActionPending}
                  >
                    🚪 {accountActionPending ? "Signing out..." : "Log Out"}
                  </button>
                </div>
              )}

              <div className="sidebar-user-row">
                <button
                  type="button"
                  className="sidebar-user"
                  onClick={() => {
                    setAccountActionError("");
                    setAccountMenuOpen((open) => !open);
                  }}
                  aria-expanded={accountMenuOpen}
                  aria-haspopup="menu"
                  title="View user details & switch account"
                >
                  <div className="user-avatar-circle">
                    {user.username ? user.username.charAt(0).toUpperCase() : "U"}
                  </div>
                  <div className="user-text-info">
                    <span className="sidebar-user-name">{user.username || "User"}</span>
                    <span className="sidebar-user-status">Free Tier • Active</span>
                  </div>
                  <span className={`account-menu-chevron ${accountMenuOpen ? "open" : ""}`} aria-hidden="true">
                    ▾
                  </span>
                </button>

                <button
                  type="button"
                  className="sidebar-quick-logout-btn"
                  onClick={() => runAccountAction(onLogout)}
                  disabled={accountActionPending}
                  title="Log Out"
                >
                  🚪
                </button>
              </div>
            </div>
          )}

          <button className="settings-btn" onClick={onOpenSettings}>
            <span className="settings-icon">⚙</span>
            <span>Settings & Voice</span>
          </button>
        </div>
      </aside>
    </>
  );
}
