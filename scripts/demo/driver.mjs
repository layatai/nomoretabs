// CDP driver for the No More Tabs demo recording.
// Drives the real extension popup in an isolated Brave/Chrome instance
// (launched by record.sh with --remote-debugging-port=9333) and prints
// MARK lines used to time the burned-in captions.
const PORT = process.env.NMT_CDP_PORT || 9333;
const mode = process.argv[2] || "dry";

const targets = async () =>
  (await fetch(`http://localhost:${PORT}/json/list`)).json();

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let id = 0;
    const pending = new Map();
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) {
        const { res, rej } = pending.get(msg.id);
        pending.delete(msg.id);
        msg.error ? rej(new Error(JSON.stringify(msg.error))) : res(msg.result);
      }
    };
    ws.onopen = () =>
      resolve({
        send: (method, params = {}) =>
          new Promise((res, rej) => {
            pending.set(++id, { res, rej });
            ws.send(JSON.stringify({ id, method, params }));
          }),
        close: () => ws.close(),
      });
    ws.onerror = reject;
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const t0 = Date.now();
const mark = (label) =>
  console.log(`MARK ${((Date.now() - t0) / 1000).toFixed(2)} ${label}`);

async function findSW() {
  for (let i = 0; i < 15; i++) {
    const sw = (await targets()).find(
      (t) => t.type === "service_worker" && t.url.includes("background.js")
    );
    if (sw) return sw;
    if (i === 0) {
      // dormant MV3 worker: a tab event wakes it
      const t = await (
        await fetch(`http://localhost:${PORT}/json/new?url=about:blank`, {
          method: "PUT",
        })
      ).json();
      await sleep(400);
      await fetch(`http://localhost:${PORT}/json/close/${t.id}`);
    }
    await sleep(300);
  }
  throw new Error("service worker never woke up");
}

async function openPopup() {
  const sw = await findSW();
  const c = await connect(sw.webSocketDebuggerUrl);
  await c.send("Runtime.evaluate", {
    expression: "chrome.action.openPopup()",
    userGesture: true,
    awaitPromise: true,
  });
  c.close();
  for (let i = 0; i < 20; i++) {
    const p = (await targets()).find((t) => t.url.includes("popup.html"));
    if (p) return connect(p.webSocketDebuggerUrl);
    await sleep(150);
  }
  throw new Error("popup target never appeared");
}

async function key(c, def) {
  const base = {
    key: def.key,
    code: def.code || def.key,
    windowsVirtualKeyCode: def.vk,
    nativeVirtualKeyCode: def.vk,
    modifiers: def.modifiers || 0,
  };
  await c.send("Input.dispatchKeyEvent", {
    type: def.text ? "keyDown" : "rawKeyDown",
    ...base,
    text: def.text,
  });
  await c.send("Input.dispatchKeyEvent", { type: "keyUp", ...base });
}

const KEYS = {
  enter: { key: "Enter", code: "Enter", vk: 13, text: "\r" },
  right: { key: "ArrowRight", code: "ArrowRight", vk: 39 },
  left: { key: "ArrowLeft", code: "ArrowLeft", vk: 37 },
  down: { key: "ArrowDown", code: "ArrowDown", vk: 40 },
  esc: { key: "Escape", code: "Escape", vk: 27 },
};

async function type(c, text, delay = 170) {
  for (const ch of text) {
    await key(c, {
      key: ch,
      code: "Key" + ch.toUpperCase(),
      vk: ch.toUpperCase().charCodeAt(0),
      text: ch,
    });
    await sleep(delay);
  }
}

async function clearInput(c, n) {
  for (let i = 0; i < n; i++) {
    await key(c, { key: "Backspace", code: "Backspace", vk: 8 });
    await sleep(200);
  }
}

async function activateGithub() {
  const gh = (await targets()).find(
    (t) =>
      t.type === "page" && t.url === "https://github.com/layatai/nomoretabs"
  );
  if (gh) await fetch(`http://localhost:${PORT}/json/activate/${gh.id}`);
}

async function shot(c, path) {
  const { data } = await c.send("Page.captureScreenshot", { format: "png" });
  const { writeFileSync } = await import("fs");
  writeFileSync(path, Buffer.from(data, "base64"));
}

if (mode === "dry") {
  // sanity check: popup opens, action chip cycles
  const c = await openPopup();
  await sleep(800);
  await shot(c, "/tmp/nmt-popup-1.png");
  await key(c, KEYS.right);
  await sleep(400);
  await key(c, KEYS.right);
  await sleep(400);
  await shot(c, "/tmp/nmt-popup-2.png");
  key(c, KEYS.esc).catch(() => {}); // closes the popup; socket dies with it
  await sleep(300);
  c.close();
  console.log("dry run done");
} else {
  // ---- recorded demo sequence (keep in sync with captions in record.sh) ----
  await activateGithub();
  await sleep(600);
  mark("open");
  let c = await openPopup();
  await sleep(2200); // show the sites list
  mark("typewiki");
  await type(c, "wiki");
  await sleep(1300);
  mark("right");
  await key(c, KEYS.right); // action: Group tabs
  await sleep(1500);
  mark("groupenter");
  await key(c, KEYS.enter); // group wikipedia tabs
  await sleep(2400);
  await clearInput(c, 4);
  await sleep(500);
  mark("slash");
  await type(c, "/");
  await sleep(1700); // show command list
  mark("dedupe");
  await type(c, "dedupe");
  await sleep(1100);
  await key(c, KEYS.enter); // close duplicated tabs
  await sleep(2200);
  mark("hacker");
  await type(c, "hacker");
  await sleep(900);
  await key(c, KEYS.down); // move to the tab row
  await sleep(900);
  mark("switch");
  key(c, KEYS.enter).catch(() => {}); // switch to tab (popup closes, socket dies)
  await sleep(2300);
  try { c.close(); } catch {}
  mark("reopen");
  c = await openPopup();
  await sleep(1200);
  mark("closewiki");
  await type(c, "wiki");
  await sleep(1100);
  await key(c, KEYS.enter); // close all wikipedia tabs
  await sleep(2600);
  key(c, KEYS.esc).catch(() => {});
  await sleep(400);
  mark("end");
  c.close();
}
process.exit(0);
