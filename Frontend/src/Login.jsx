import { useState } from "react";

function Login({
  onLoginSuccess,
  onClose,
  onShowRegister,
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");

  const handleLogin = async (event) => {
    event.preventDefault();
    setMessage("");

    try {
      const response = await fetch(
        "http://localhost:8000/api/auth/login/",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            username,
            password,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Login failed");
        return;
      }

      const sessionVerified = await onLoginSuccess();
      if (!sessionVerified) {
        setMessage("Login succeeded, but the session could not be verified. Please make sure the backend is running.");
      }
    } catch {
      setMessage("Could not connect to the server.");
    }
  };

  return (
    <div className="register-overlay">
      <div className="register-card">
        <button
          type="button"
          className="close-modal-btn"
          onClick={onClose}
        >
          ×
        </button>

        <h1>Welcome Back</h1>

        <p className="register-subtitle">
          Log in to continue to your AI assistant.
        </p>

        <form onSubmit={handleLogin}>
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
          />

          <div className="password-field">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />

            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>

          <button type="submit">Login</button>
        </form>

        {message && <p className="auth-message">{message}</p>}

        <p className="auth-switch-text">
          Don't have an account?{" "}
          <button type="button" onClick={onShowRegister}>
            Register
          </button>
        </p>
      </div>
    </div>
  );
}

export default Login;
