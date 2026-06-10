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

async function load() {
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

      li.append(edit, remove);
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

load();
