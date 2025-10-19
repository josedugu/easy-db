import React, { useState, useEffect, FormEvent } from "react";
import type { AppState, DatabaseConfig } from "../types";

interface ConnectionFormProps {
  state: AppState;
  onConnect: (config: DatabaseConfig, remember: boolean, name?: string) => void;
  onDisconnect: () => void;
}

const DEFAULT_CONFIG: DatabaseConfig = {
  hostname: "aws-0-us-east-2.pooler.supabase.com",
  port: 6543,
  database: "postgres",
  username: "postgres.bihnpyrwdlkmlkhvfjky",
  password: "",
};

function ConnectionForm({ state, onConnect, onDisconnect }: ConnectionFormProps) {
  const [connectionName, setConnectionName] = useState("");
  const [hostname, setHostname] = useState(DEFAULT_CONFIG.hostname);
  const [port, setPort] = useState(DEFAULT_CONFIG.port.toString());
  const [database, setDatabase] = useState(DEFAULT_CONFIG.database);
  const [username, setUsername] = useState(DEFAULT_CONFIG.username);
  const [password, setPassword] = useState(DEFAULT_CONFIG.password);
  const [hidePassword, setHidePassword] = useState(true);
  const [remember, setRemember] = useState(false);

  // Load connection data when editing or selecting
  useEffect(() => {
    const activeConnection = state.savedConnections.find(
      (conn) => conn.id === state.activeConnectionId
    );

    if (activeConnection) {
      setConnectionName(activeConnection.name);
      setHostname(activeConnection.config.hostname);
      setPort(activeConnection.config.port.toString());
      setDatabase(activeConnection.config.database);
      setUsername(activeConnection.config.username);
      setPassword(activeConnection.config.password);
      setRemember(true);
    } else if (state.isNewConnection) {
      // Reset form for new connection
      setConnectionName("");
      setHostname(DEFAULT_CONFIG.host);
      setPort(DEFAULT_CONFIG.port.toString());
      setDatabase(DEFAULT_CONFIG.database);
      setUsername(DEFAULT_CONFIG.username);
      setPassword("");
      setRemember(false);
    }
  }, [state.activeConnectionId, state.isNewConnection, state.savedConnections]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    const config: DatabaseConfig = {
      hostname: hostname,
      port: parseInt(port, 10),
      database,
      username,
      password,
    };

    onConnect(config, remember, connectionName);
  };

  const getButtonState = () => {
    if (state.isConnecting) {
      return { text: "Cancel", className: "secondary", disabled: false };
    }
    if (
      state.isConnected &&
      state.activeConnectionId === state.connectedConnectionId
    ) {
      return { text: "Connected", className: "success", disabled: true };
    }
    return { text: "Connect", className: "primary", disabled: false };
  };

  const buttonState = getButtonState();

  return (
    <div className="connection-form-wrapper">
      {/* Status Banner */}
      {state.lastError && (
        <div className="error-banner">
          <div className="banner-content">
            <strong>Connection Error:</strong> {state.lastError}
          </div>
        </div>
      )}

      {state.isConnecting && (
        <div className="info-banner">
          <div className="banner-content">Connecting...</div>
        </div>
      )}

      {/* Connection Form */}
      <form onSubmit={handleSubmit}>
        {/* Connection Name (only for new or editing) */}
        {(state.isNewConnection || state.editingConnectionId) && (
          <label id="connection-name-wrapper">
            Connection Name
            <input
              id="connection-name-input"
              type="text"
              value={connectionName}
              onChange={(e) => setConnectionName(e.target.value)}
              placeholder="My Database"
              required={remember}
            />
          </label>
        )}

        <label>
          Hostname
          <input
            type="text"
            value={hostname}
            onChange={(e) => setHostname(e.target.value)}
            placeholder="localhost"
            required
          />
        </label>

        <div className="row two">
          <label>
            Port
            <input
              type="number"
              value={port}
              onChange={(e) => setPort(e.target.value)}
              placeholder="5432"
              required
            />
          </label>
          <label>
            Database
            <input
              type="text"
              value={database}
              onChange={(e) => setDatabase(e.target.value)}
              placeholder="postgres"
              required
            />
          </label>
        </div>

        <label>
          Username
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="postgres"
            required
          />
        </label>

        <label>
          Password
          <input
            type={hidePassword ? "password" : "text"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
        </label>

        <div className="row two">
          <label className="hide-password">
            <input
              type="checkbox"
              checked={hidePassword}
              onChange={(e) => setHidePassword(e.target.checked)}
            />
            Hide password
          </label>

          <label className="remember">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            Save this connection
          </label>
        </div>

        <div className="button-group">
          {state.isConnecting ? (
            <button
              type="button"
              className={buttonState.className}
              onClick={onDisconnect}
            >
              {buttonState.text}
            </button>
          ) : (
            <button type="submit" className={buttonState.className} disabled={buttonState.disabled}>
              {buttonState.text}
            </button>
          )}

          <button
            type="button"
            className="secondary"
            onClick={onDisconnect}
            disabled={!state.isConnected}
          >
            Disconnect
          </button>
        </div>
      </form>
    </div>
  );
}

export default ConnectionForm;

