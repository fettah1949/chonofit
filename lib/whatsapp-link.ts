import { existsSync } from "fs";
import { rm } from "fs/promises";
import path from "path";
import type { WhatsAppLinkStatus } from "@/lib/whatsapp";

type WaSock = {
  user?: { id?: string };
  ev: {
    on(event: "creds.update", listener: () => void): void;
    on(event: "connection.update", listener: (update: {
      connection?: "open" | "connecting" | "close";
      qr?: string;
      lastDisconnect?: { error?: unknown };
    }) => void): void;
  };
  sendMessage(jid: string, content: { image: Buffer; caption?: string } | { text: string }): Promise<unknown>;
  onWhatsApp(...phones: string[]): Promise<Array<{ jid: string; exists: boolean }> | undefined>;
  logout(): Promise<void>;
  end(error?: Error): void;
};

type WaRuntime = {
  status: WhatsAppLinkStatus["status"];
  qr: string | null;
  phone: string | null;
  sock: WaSock | null;
  connectPromise: Promise<void> | null;
  suppressReconnect: boolean;
};

const authDir = path.join(process.cwd(), "data", "whatsapp");
const globalState = globalThis as unknown as { chronoWhatsApp?: WaRuntime };

function runtime() {
  if (!globalState.chronoWhatsApp) {
    globalState.chronoWhatsApp = {
      status: "disconnected",
      qr: null,
      phone: null,
      sock: null,
      connectPromise: null,
      suppressReconnect: false,
    };
  }
  return globalState.chronoWhatsApp;
}

const silentLogger = {
  level: "silent",
  child() {
    return silentLogger;
  },
  trace() {},
  debug() {},
  info() {},
  warn() {},
  error() {},
};

function publicStatus(error?: string): WhatsAppLinkStatus {
  const state = runtime();
  return { status: state.status, qr: state.qr, phone: state.phone, error };
}

function ownPhone(id?: string) {
  if (!id) return null;
  return id.split(":")[0]?.split("@")[0] ?? null;
}

function disconnectCode(error: unknown) {
  if (!error || typeof error !== "object" || !("output" in error)) return undefined;
  const output = (error as { output?: { statusCode?: number } }).output;
  return output?.statusCode;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForLink(timeoutMs: number) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const state = runtime();
    if (state.status === "open" || state.status === "qr") return;
    if (state.status === "disconnected" && !state.connectPromise) return;
    await delay(300);
  }
}

async function openSocket() {
  const state = runtime();
  state.status = "connecting";
  state.qr = null;
  const baileys = await import("@whiskeysockets/baileys");
  const qrcode = await import("qrcode");
  const { state: auth, saveCreds } = await baileys.useMultiFileAuthState(authDir);
  let version: [number, number, number] | undefined;
  try {
    version = (await baileys.fetchLatestBaileysVersion()).version;
  } catch {
    version = undefined;
  }

  const sock = baileys.default({
    auth,
    version,
    logger: silentLogger,
    browser: baileys.Browsers.windows("Chrome"),
    syncFullHistory: false,
    shouldSyncHistoryMessage: () => false,
    markOnlineOnConnect: false,
    printQRInTerminal: false,
  }) as unknown as WaSock;

  state.sock = sock;
  sock.ev.on("creds.update", saveCreds);
  sock.ev.on("connection.update", (update) => {
    void (async () => {
      if (update.qr) {
        state.status = "qr";
        state.qr = await qrcode.toDataURL(update.qr, { margin: 1, width: 280 });
      }
      if (update.connection === "open") {
        state.status = "open";
        state.qr = null;
        state.phone = ownPhone(sock.user?.id);
      }
      if (update.connection === "close") {
        const code = disconnectCode(update.lastDisconnect?.error);
        const loggedOut = code === 401 || state.suppressReconnect;
        state.sock = null;
        state.qr = null;
        state.phone = null;
        state.status = "disconnected";
        state.connectPromise = null;
        if (!loggedOut && code !== 403) {
          setTimeout(() => {
            void connectWhatsApp();
          }, 1500);
        }
      }
    })();
  });
}

export function connectWhatsApp() {
  const state = runtime();
  if (state.status === "open") return Promise.resolve();
  if (!state.connectPromise) {
    state.suppressReconnect = false;
    state.connectPromise = openSocket().catch((error: unknown) => {
      state.status = "disconnected";
      state.sock = null;
      throw error;
    });
  }
  return state.connectPromise;
}

export async function ensureWhatsApp() {
  const state = runtime();
  if (state.status === "open" || state.status === "qr" || state.status === "connecting") return;
  if (existsSync(path.join(authDir, "creds.json"))) await connectWhatsApp();
}

export async function readWhatsAppLink() {
  try {
    await ensureWhatsApp();
    await waitForLink(12000);
    return publicStatus();
  } catch (error) {
    console.error("Connexion WhatsApp impossible", error);
    return publicStatus("Connexion WhatsApp impossible. Réessayez.");
  }
}

export async function beginWhatsAppLink() {
  try {
    await connectWhatsApp();
    await waitForLink(15000);
    return publicStatus();
  } catch (error) {
    console.error("Connexion WhatsApp impossible", error);
    return publicStatus("Connexion WhatsApp impossible. Réessayez.");
  }
}

export async function logoutWhatsApp() {
  const state = runtime();
  state.suppressReconnect = true;
  state.connectPromise = null;
  try {
    await state.sock?.logout();
  } catch {
    try {
      state.sock?.end(new Error("logout"));
    } catch {
      /* already closed */
    }
  }
  state.sock = null;
  state.status = "disconnected";
  state.qr = null;
  state.phone = null;
  await rm(authDir, { recursive: true, force: true });
  return publicStatus();
}

async function openChat(phone: string) {
  await ensureWhatsApp();
  const started = Date.now();
  while (runtime().status === "connecting" && Date.now() - started < 20000) {
    await delay(300);
  }
  const state = runtime();
  if (state.status !== "open" || !state.sock) throw new Error("NOT_LINKED");
  const matches = await state.sock.onWhatsApp(phone);
  const match = matches?.find((item) => item.exists);
  if (!match) throw new Error("NO_WHATSAPP");
  return { sock: state.sock, jid: match.jid };
}

export async function sendWhatsAppImage(phone: string, image: Buffer, caption: string) {
  const chat = await openChat(phone);
  await chat.sock.sendMessage(chat.jid, { image, caption });
}

export async function sendWhatsAppText(phone: string, text: string) {
  const chat = await openChat(phone);
  await chat.sock.sendMessage(chat.jid, { text });
}
