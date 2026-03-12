import { SoundEngine } from "./sound-engine.mjs";

const MODULE_ID = "hacking-terminal";

export class HackingTerminalApp extends Application {
  constructor(options = {}) {
    super(options);

    this._terminalOutput = null;
    this._terminalBody = null;

    this._inputArea = null;
    this._usernameRow = null;
    this._passwordRow = null;

    this._usernameInput = null;
    this._passwordInput = null;
    this._attemptsEl = null;

    this._enteredUsername = "";
    this._lastHistoryLength = 0;

    this._sfx = new SoundEngine();
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "hacking-terminal-app",
      title: "Hacking Terminal",
      template: `modules/${MODULE_ID}/templates/terminal.hbs`,
      width: 700,
      height: 850,
      resizable: true,
      classes: ["hacking-terminal-window"]
    });
  }

  getData() {
    return {
      attemptsLeft: game.settings.get(MODULE_ID, "attemptsLeft"),
      maxAttempts: game.settings.get(MODULE_ID, "maxAttempts")
    };
  }

  activateListeners(html) {
    super.activateListeners(html);

    this._cacheDom(html);
    this._bindInputs();
    this.syncFromWorld();
  }

  _cacheDom(html) {
    this._terminalOutput = html.find("#ht-output")[0] ?? null;
    this._terminalBody = html.find(".ht-body")[0] ?? null;

    this._inputArea = html.find("#ht-input-area")[0] ?? null;
    this._usernameRow = html.find("#ht-username-row")[0] ?? null;
    this._passwordRow = html.find("#ht-password-row")[0] ?? null;

    this._usernameInput = html.find("#ht-username")[0] ?? null;
    this._passwordInput = html.find("#ht-password")[0] ?? null;
    this._attemptsEl = html.find("#ht-attempts")[0] ?? null;
  }

  _bindInputs() {
    if (this._usernameInput) {
      this._usernameInput.addEventListener("input", () => {
        if (!this._canWrite()) return;
        game.socket.emit(`module.${MODULE_ID}`, {
          action: "liveInput",
          field: "username",
          value: this._usernameInput.value,
          userId: game.user.id
        });
      });

      this._usernameInput.addEventListener("keydown", e => {
        if (e.key !== "Enter") return;
        e.preventDefault();

        if (!this._canWrite()) return;
        if (game.settings.get(MODULE_ID, "phase") !== "username") return;

        const username = this._usernameInput.value.trim();
        if (!username) return;

        this._sfx?.enter();
        this._enteredUsername = username;

        game.socket.emit(`module.${MODULE_ID}`, {
          action: "requestCommitUsername",
          userId: game.user.id,
          username
        });
      });

      this._usernameInput.addEventListener("keydown", e => {
        if (!this._canWrite()) return;
        if (["Enter", "Tab", "Shift", "Control", "Alt", "Meta"].includes(e.key)) return;
        this._sfx?.keypress();
      });
    }

    if (this._passwordInput) {
      this._passwordInput.addEventListener("input", () => {
        if (!this._canWrite()) return;
        game.socket.emit(`module.${MODULE_ID}`, {
          action: "liveInput",
          field: "password",
          value: this._passwordInput.value,
          userId: game.user.id
        });
      });

      this._passwordInput.addEventListener("keydown", e => {
        if (e.key !== "Enter") return;
        e.preventDefault();

        if (!this._canWrite()) return;
        if (game.settings.get(MODULE_ID, "phase") !== "password") return;

        const password = this._passwordInput.value.trim();
        if (!password) return;

        this._sfx?.enter();

        game.socket.emit(`module.${MODULE_ID}`, {
          action: "requestSubmitPassword",
          userId: game.user.id,
          username: this._enteredUsername,
          password
        });
      });

      this._passwordInput.addEventListener("keydown", e => {
        if (!this._canWrite()) return;
        if (["Enter", "Tab", "Shift", "Control", "Alt", "Meta"].includes(e.key)) return;
        this._sfx?.keypress();
      });
    }
  }

  _canWrite() {
    const authorizedUserId = game.settings.get(MODULE_ID, "authorizedUserId");
    return game.user.id === authorizedUserId;
  }

  syncFromWorld() {
    const history = game.settings.get(MODULE_ID, "history") || [];
    const attemptsLeft = game.settings.get(MODULE_ID, "attemptsLeft");
    const maxAttempts = game.settings.get(MODULE_ID, "maxAttempts");
    const phase = game.settings.get(MODULE_ID, "phase");
    const blocked = game.settings.get(MODULE_ID, "isBlocked");
    const granted = game.settings.get(MODULE_ID, "isGranted");

    this._renderHistory(history);
    this._updateAttempts(attemptsLeft, maxAttempts);
    this._applyState({ phase, blocked, granted });
    this._scrollToBottom();
  }

  _renderHistory(history) {
    if (!this._terminalOutput) return;

    const oldLength = this._lastHistoryLength;
    this._lastHistoryLength = history.length;

    this._terminalOutput.innerHTML = "";

    for (const line of history) {
      const div = document.createElement("div");
      div.classList.add("ht-line", `ht-${line.cls || "system"}`);
      div.textContent = line.text ?? "";
      this._terminalOutput.appendChild(div);
    }

    if (history.length > oldLength) {
      this._sfx?.typeClick?.();
    }
  }

  _applyState({ phase, blocked, granted }) {
    if (!this._inputArea || !this._usernameRow || !this._passwordRow) return;

    const canWrite = this._canWrite();

    if (blocked) {
      this._inputArea.style.display = "block";
      this._inputArea.classList.add("blocked");

      this._usernameRow.style.display = "flex";
      this._passwordRow.style.display = "flex";

      if (this._usernameInput) {
        this._usernameInput.disabled = true;
        this._usernameInput.value = "BLOQUEADO";
      }

      if (this._passwordInput) {
        this._passwordInput.disabled = true;
        this._passwordInput.value = "BLOQUEADO";
      }

      return;
    }

    this._inputArea.classList.remove("blocked");

    if (granted || phase === "done" || phase === "processing") {
      this._inputArea.style.display = "none";
      return;
    }

    this._inputArea.style.display = "block";

    if (phase === "username") {
      this._usernameRow.style.display = "flex";
      this._passwordRow.style.display = "none";

      if (this._usernameInput) {
        this._usernameInput.disabled = !canWrite;
        if (canWrite) this._usernameInput.focus();
      }

      if (this._passwordInput) {
        this._passwordInput.disabled = true;
        this._passwordInput.value = "";
      }

      return;
    }

    if (phase === "password") {
      this._usernameRow.style.display = "none";
      this._passwordRow.style.display = "flex";

      if (this._usernameInput) {
        this._usernameInput.disabled = true;
      }

      if (this._passwordInput) {
        this._passwordInput.disabled = !canWrite;
        if (canWrite) this._passwordInput.focus();
      }

      return;
    }

    this._inputArea.style.display = "none";
  }

  applyLiveInput(data) {
    const authorizedUserId = game.settings.get(MODULE_ID, "authorizedUserId");
    if (data.userId !== authorizedUserId) return;

    const phase = game.settings.get(MODULE_ID, "phase");
    if (phase === "processing" || phase === "done") return;

    if (data.field === "username" && this._usernameInput) {
      if (!this._canWrite()) {
        this._usernameInput.value = data.value ?? "";
      }
    }

    if (data.field === "password" && this._passwordInput) {
      if (!this._canWrite()) {
        const stars = "*".repeat((data.value ?? "").length);
        this._passwordInput.value = stars;
      }
    }
  }

  _updateAttempts(left, max) {
    if (!this._attemptsEl) return;

    this._attemptsEl.textContent = `INTENTOS: ${left}/${max}`;

    if (left <= 1) {
      this._attemptsEl.style.color = "#ff0033";
    } else if (left <= 2) {
      this._attemptsEl.style.color = "#ffb000";
    } else {
      this._attemptsEl.style.color = "#00ff66";
    }
  }

  _scrollToBottom() {
    if (!this._terminalBody) return;
    this._terminalBody.scrollTop = this._terminalBody.scrollHeight;
  }

  close(...args) {
    this._sfx?.destroy?.();
    return super.close(...args);
  }
}
