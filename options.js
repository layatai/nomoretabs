const listEl = document.getElementById("host-list");
const emptyEl = document.getElementById("empty");
const inputEl = document.getElementById("add-input");

let hosts = [];

// "https://www.Example.com/path" -> "www.example.com"
function normalize(value) {
  let v = value.trim().toLowerCase();
  if (!v) return "";
  try {
    v = new URL(v.includes("://") ? v : "http://" + v).hostname;
  } catch {
    return "";
  }
  return v;
}

function faviconFor(host) {
  const url = new URL(chrome.runtime.getURL("/_favicon/"));
  url.searchParams.set("pageUrl", "https://" + host + "/");
  url.searchParams.set("size", "16");
  return url.toString();
}

// ---- general settings ----

async function loadSettings() {
  const s = await chrome.storage.sync.get({ groupMode: "host", autocomplete: true });
  document.getElementById(
    s.groupMode === "domain" ? "mode-domain" : "mode-host"
  ).checked = true;
  document.getElementById("autocomplete").checked = s.autocomplete;
}

for (const id of ["mode-host", "mode-domain"]) {
  document.getElementById(id).addEventListener("change", (e) => {
    if (e.target.checked) chrome.storage.sync.set({ groupMode: e.target.value });
  });
}

document.getElementById("autocomplete").addEventListener("change", (e) => {
  chrome.storage.sync.set({ autocomplete: e.target.checked });
});

document.getElementById("shortcuts").addEventListener("click", () => {
  chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
});

async function loadShortcuts() {
  const commands = await chrome.commands.getAll();
  const get = (name) =>
    commands.find((c) => c.name === name)?.shortcut || "unset";
  document.getElementById("key-palette").textContent = get("_execute_action");
  document.getElementById("key-goto").textContent = get("open-goto-palette");
}

document.getElementById("version").textContent =
  "v" + chrome.runtime.getManifest().version;

// ---- enforced switch-to-tab list ----

async function loadHosts() {
  ({ enforcedHosts: hosts } = await chrome.storage.sync.get({
    enforcedHosts: [],
  }));
  render();
}

async function save() {
  await chrome.storage.sync.set({ enforcedHosts: hosts });
  render();
}

function render() {
  emptyEl.hidden = hosts.length > 0;
  listEl.replaceChildren(
    ...hosts.map((host, i) => {
      const li = document.createElement("li");

      const icon = document.createElement("img");
      icon.src = faviconFor(host);
      icon.alt = "";

      const edit = document.createElement("input");
      edit.type = "text";
      edit.value = host;
      edit.spellcheck = false;
      edit.addEventListener("change", () => {
        const v = normalize(edit.value);
        if (!v) {
          hosts.splice(i, 1); // cleared or invalid -> remove
        } else {
          hosts[i] = v;
          hosts = [...new Set(hosts)];
        }
        save();
      });

      const remove = document.createElement("button");
      remove.textContent = "✕";
      remove.title = "Remove";
      remove.addEventListener("click", () => {
        hosts.splice(i, 1);
        save();
      });

      li.append(icon, edit, remove);
      return li;
    })
  );
}

document.getElementById("add-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const v = normalize(inputEl.value);
  if (v && !hosts.includes(v)) {
    hosts.push(v);
    save();
  }
  inputEl.value = "";
  inputEl.focus();
});

loadSettings();
loadShortcuts();
loadHosts();
