import { HackingTerminalApp } from "./hacking-terminal.mjs";

const MODULE_ID = "hacking-terminal";
let terminalApp = null;

/* ------------------------------------------ */
/* Helpers                                    */
/* ------------------------------------------ */

function getApp() {
  if (!terminalApp) terminalApp = new HackingTerminalApp();
  return terminalApp;
}

function openTerminalLocal() {
  const app = getApp();
  app.render(true);
  return app;
}

function emitSocket(action, payload = {}) {
  game.socket.emit(`module.${MODULE_ID}`, { action, ...payload });
}

function syncLocalTerminal() {
  if (terminalApp?.rendered) {
    terminalApp.syncFromWorld();
  }
}

function syncEveryone() {
  emitSocket("syncTerminal");
  syncLocalTerminal();
}

function deepClone(value) {
  return foundry.utils.deepClone(value);
}

function getHistory() {
  return deepClone(game.settings.get(MODULE_ID, "history") || []);
}

async function setHistory(history) {
  await game.settings.set(MODULE_ID, "history", history);
}

async function pushHistory(text = "", cls = "system") {
  const history = getHistory();
  history.push({ text, cls });
  await setHistory(history);
  syncEveryone();
}

async function pushHistoryLines(lines, cls = "system", delayMs = 0) {
  for (const line of lines) {
    await pushHistory(line, cls);
    if (delayMs > 0) await wait(delayMs);
  }
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function clean(value) {
  return String(value ?? "").trim();
}

function getPlayersForSelect() {
  return game.users.filter(u => !u.isGM);
}

function isAuthorizedWriter(userId) {
  return userId === game.settings.get(MODULE_ID, "authorizedUserId");
}

/* ------------------------------------------ */
/* Settings                                   */
/* ------------------------------------------ */

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "username", {
    scope: "world",
    config: false,
    type: String,
    default: "admin"
  });

  game.settings.register(MODULE_ID, "password", {
    scope: "world",
    config: false,
    type: String,
    default: "1234"
  });

  game.settings.register(MODULE_ID, "maxAttempts", {
    scope: "world",
    config: false,
    type: Number,
    default: 3
  });

  game.settings.register(MODULE_ID, "attemptsLeft", {
    scope: "world",
    config: false,
    type: Number,
    default: 3
  });

  game.settings.register(MODULE_ID, "isBlocked", {
    scope: "world",
    config: false,
    type: Boolean,
    default: false
  });

  game.settings.register(MODULE_ID, "isGranted", {
    scope: "world",
    config: false,
    type: Boolean,
    default: false
  });

  game.settings.register(MODULE_ID, "phase", {
    scope: "world",
    config: false,
    type: String,
    default: "idle" // idle | username | password | processing | done
  });

  game.settings.register(MODULE_ID, "history", {
    scope: "world",
    config: false,
    type: Array,
    default: []
  });

  game.settings.register(MODULE_ID, "authorizedUserId", {
    scope: "world",
    config: false,
    type: String,
    default: ""
  });

  console.log(`${MODULE_ID} | Settings registered`);
});

/* ------------------------------------------ */
/* Ready + Socket                             */
/* ------------------------------------------ */

Hooks.once("ready", () => {
  console.log(`${MODULE_ID} | Ready`);

  game.socket.on(`module.${MODULE_ID}`, async data => {
    switch (data.action) {
      case "openTerminalAll": {
        openTerminalLocal();
        syncLocalTerminal();
        break;
      }

      case "syncTerminal": {
        syncLocalTerminal();
        break;
      }

      case "liveInput": {
        if (terminalApp?.rendered) {
          terminalApp.applyLiveInput(data);
        }
        break;
      }

      case "requestCommitUsername": {
        if (!game.user.isGM) return;
        await commitUsername(data);
        break;
      }

      case "requestSubmitPassword": {
        if (!game.user.isGM) return;
        await processPassword(data);
        break;
      }
    }
  });
});

/* ------------------------------------------ */
/* Scene Button - GM only                     */
/* ------------------------------------------ */

Hooks.on("getSceneControlButtons", controls => {
  if (!game.user.isGM) return;
  if (!controls.tokens?.tools) return;

  controls.tokens.tools["hacking-terminal"] = {
    name: "hacking-terminal",
    title: "Hacking Terminal",
    icon: "fas fa-terminal",
    button: true,
    visible: true,
    order: Object.keys(controls.tokens.tools).length,
    onChange: () => openGMPanel()
  };
});

/* ------------------------------------------ */
/* GM Panel                                   */
/* ------------------------------------------ */

function openGMPanel() {
  const username = game.settings.get(MODULE_ID, "username");
  const password = game.settings.get(MODULE_ID, "password");
  const maxAttempts = game.settings.get(MODULE_ID, "maxAttempts");
  const authorizedUserId = game.settings.get(MODULE_ID, "authorizedUserId");

  const playerOptions = getPlayersForSelect()
    .map(u => {
      const selected = u.id === authorizedUserId ? "selected" : "";
      return `<option value="${u.id}" ${selected}>${foundry.utils.escapeHTML(u.name)}</option>`;
    })
    .join("");

  new Dialog({
    title: "Hacking Terminal - Panel GM",
    content: `
      <form>
        <div class="form-group">
          <label>Usuario correcto</label>
          <input type="text" name="username" value="${foundry.utils.escapeHTML(username)}" />
        </div>

        <div class="form-group">
          <label>Contraseña correcta</label>
          <input type="text" name="password" value="${foundry.utils.escapeHTML(password)}" />
        </div>

        <div class="form-group">
          <label>Intentos máximos</label>
          <input type="number" min="1" name="maxAttempts" value="${maxAttempts}" />
        </div>

        <div class="form-group">
          <label>Jugador autorizado a escribir</label>
          <select name="authorizedUserId">
            ${playerOptions}
          </select>
        </div>
      </form>
    `,
    buttons: {
      launch: {
        label: "Lanzar",
        callback: async html => {
          await saveConfigFromDialog(html);
          await launchSession();
        }
      },
      reset: {
        label: "Reset",
        callback: async html => {
          await saveConfigFromDialog(html);
          await resetSession(true);
        }
      },
      save: {
        label: "Guardar",
        callback: async html => {
          await saveConfigFromDialog(html);
          ui.notifications.info("Configuración guardada.");
        }
      },
      openOnly: {
        label: "Abrir mi terminal",
        callback: async html => {
          await saveConfigFromDialog(html);
          openTerminalLocal();
          syncLocalTerminal();
        }
      }
    },
    default: "launch"
  }).render(true);
}

async function saveConfigFromDialog(html) {
  const username = clean(html.find('[name="username"]').val()) || "admin";
  const password = clean(html.find('[name="password"]').val()) || "1234";
  const maxAttempts = Math.max(1, Number(html.find('[name="maxAttempts"]').val()) || 3);
  const authorizedUserId = clean(html.find('[name="authorizedUserId"]').val());

  await game.settings.set(MODULE_ID, "username", username);
  await game.settings.set(MODULE_ID, "password", password);
  await game.settings.set(MODULE_ID, "maxAttempts", maxAttempts);
  await game.settings.set(MODULE_ID, "authorizedUserId", authorizedUserId);
}

/* ------------------------------------------ */
/* Session control                            */
/* ------------------------------------------ */

async function resetSession(showNotification = false) {
  const maxAttempts = game.settings.get(MODULE_ID, "maxAttempts");

  await game.settings.set(MODULE_ID, "attemptsLeft", maxAttempts);
  await game.settings.set(MODULE_ID, "isBlocked", false);
  await game.settings.set(MODULE_ID, "isGranted", false);
  await game.settings.set(MODULE_ID, "phase", "idle");
  await game.settings.set(MODULE_ID, "history", []);

  syncEveryone();

  if (showNotification) {
    ui.notifications.info("Terminal reseteada.");
  }
}

async function launchSession() {
  const authorizedUserId = game.settings.get(MODULE_ID, "authorizedUserId");
  if (!authorizedUserId) {
    ui.notifications.warn("Selecciona un jugador autorizado.");
    return;
  }

  await resetSession(false);

  openTerminalLocal();
  emitSocket("openTerminalAll");
  syncLocalTerminal();

  await game.settings.set(MODULE_ID, "phase", "processing");
  syncEveryone();

  await runBootSequence();
}

async function runBootSequence() {
  const ascii = [
    "╔══════════════════════════════════════════╗",
    "║  ███████╗██╗   ██╗███████╗████████╗██╗    ║",
    "║  ██╔════╝╚██╗ ██╔╝██╔════╝╚══██╔══╝██║    ║",
    "║  ███████╗ ╚████╔╝ ███████╗   ██║   ██║     ║",
    "║  ╚════██║  ╚██╔╝  ╚════██║   ██║   ╚═╝     ║",
    "║  ███████║   ██║   ███████║   ██║   ██╗     ║",
    "║  ╚══════╝   ╚═╝   ╚══════╝   ╚═╝   ╚═╝     ║",
    "╚══════════════════════════════════════════╝"
  ];

  await pushHistoryLines(ascii, "ascii", 0);
  await pushHistory("", "system");
  await pushHistory("[BOOT] Inicializando sistema de seguridad...", "system");
  await wait(200);
  await pushHistory("[OK] Módulos de encriptación cargados", "system");
  await wait(120);
  await pushHistory("[OK] Firewall activo - Nivel 4", "system");
  await wait(120);
  await pushHistory("[OK] Conexión segura establecida", "system");
  await wait(120);

  await pushHistory("", "system");
  await pushHistory("═══════════════════════════════════════════", "system");
  await pushHistory("  ACCESO RESTRINGIDO - AUTENTICACIÓN REQUERIDA", "warning");
  await pushHistory("═══════════════════════════════════════════", "system");
  await pushHistory("", "system");

  const attempts = game.settings.get(MODULE_ID, "attemptsLeft");
  await pushHistory(`Intentos disponibles: ${attempts}`, "info");
  await pushHistory("", "system");

  await game.settings.set(MODULE_ID, "phase", "username");
  syncEveryone();
}

/* ------------------------------------------ */
/* Authorized player actions                  */
/* ------------------------------------------ */

async function commitUsername(data) {
  if (!isAuthorizedWriter(data.userId)) return;
  if (game.settings.get(MODULE_ID, "phase") !== "username") return;
  if (game.settings.get(MODULE_ID, "isBlocked")) return;
  if (game.settings.get(MODULE_ID, "isGranted")) return;

  const username = clean(data.username);
  if (!username) return;

  await pushHistory(`> USUARIO: ${username}`, "info");
  await game.settings.set(MODULE_ID, "phase", "password");

  emitSocket("liveInput", { field: "username", value: "", userId: data.userId });
  emitSocket("liveInput", { field: "password", value: "", userId: data.userId });
  syncEveryone();
}

async function processPassword(data) {
  if (!isAuthorizedWriter(data.userId)) return;
  if (game.settings.get(MODULE_ID, "phase") !== "password") return;
  if (game.settings.get(MODULE_ID, "isBlocked")) return;
  if (game.settings.get(MODULE_ID, "isGranted")) return;

  const username = clean(data.username);
  const password = clean(data.password);
  if (!username || !password) return;

  await pushHistory("> CONTRASEÑA: ********", "info");
  await game.settings.set(MODULE_ID, "phase", "processing");
  syncEveryone();

  await pushHistory("[SISTEMA] Verificando credenciales...", "system");
  await wait(700);

  const correctUser = game.settings.get(MODULE_ID, "username");
  const correctPass = game.settings.get(MODULE_ID, "password");

  if (username === correctUser && password === correctPass) {
    await game.settings.set(MODULE_ID, "isGranted", true);
    await game.settings.set(MODULE_ID, "phase", "done");

    await pushHistory("", "system");
    await pushHistory("═══════════════════════════════════════", "success");
    await pushHistory("       ✓ ACCESO AUTORIZADO ✓", "success");
    await pushHistory("═══════════════════════════════════════", "success");
    await pushHistory("", "system");
    await pushHistory(`Bienvenido a Helix Dynamics! ${username}`, "success");
    await pushHistory("[OK] Acceso completo concedido.", "success");

    emitSocket("liveInput", { field: "password", value: "", userId: data.userId });
    syncEveryone();
    return;
  }

  let attempts = game.settings.get(MODULE_ID, "attemptsLeft");
  attempts -= 1;
  await game.settings.set(MODULE_ID, "attemptsLeft", attempts);

  await pushHistory("", "system");
  await pushHistory("═══════════════════════════════════════", "error");
  await pushHistory("     ✗ ACCESO DENEGADO ✗          ", "error");
  await pushHistory("═══════════════════════════════════════", "error");

  emitSocket("liveInput", { field: "password", value: "", userId: data.userId });

  if (attempts <= 0) {
    await game.settings.set(MODULE_ID, "isBlocked", true);
    await game.settings.set(MODULE_ID, "phase", "done");

    await pushHistory("", "system");
    await pushHistory("[ALERTA] Demasiados intentos fallidos", "error");

    const box = [
      "╔═══════════════════════════════════════╗",
      "║                                           ║",
      "║        [ ACCESO BLOQUEADO ]               ║",
      "║                                           ║",
      "║  Sistema bloqueado por seguridad.         ║",
      "║  Contacte al administrador.               ║",
      "║                                           ║",
      "╚═══════════════════════════════════════╝"
    ];

    await pushHistoryLines(box, "blocked", 0);
    await pushHistory("> USUARIO: BLOQUEADO", "blocked");
    await pushHistory("> CONTRASEÑA: BLOQUEADO", "blocked");

    syncEveryone();
    return;
  }

  const max = game.settings.get(MODULE_ID, "maxAttempts");
  await pushHistory(`[ADVERTENCIA] Intentos restantes: ${attempts}/${max}`, "warning");
  await pushHistory("", "system");

  await game.settings.set(MODULE_ID, "phase", "username");
  syncEveryone();
}