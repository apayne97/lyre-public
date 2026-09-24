// Optional File System Access API storage for Progressions — a third
// backend alongside the local devserver's /api/songs and Google Drive:
// lets a desktop Chromium visitor point the app at a file anywhere on
// their own disk, no server and no Google account needed. Chromium-only
// (Chrome/Edge/Brave/Opera) — NOT desktop Safari, NOT Firefox, and not
// available on iOS at all (no browser there implements this API, not just
// Safari) — feature-detected via localFileSupported() below; the UI in
// progressions.html hides itself entirely when it's false.
//
// Same "\n---\n" block format as songs-data.md/a Drive file — reuses
// splitDriveBlocks/joinDriveBlocks/driveBlockMatches from drive.js as-is,
// since those are plain text helpers with nothing Drive-specific in them
// (drive.js loads before this file — see progressions.html's script tags).
//
// Simpler than the Drive backend in two ways: no folder concept (one file
// IS the whole storage, nothing to scope a picker to), and no OAuth token
// to refresh — just a read/write PERMISSION grant, which (like Drive's
// token) doesn't silently survive a reload; queryPermission/
// requestPermission below re-establish it. A FileSystemFileHandle isn't a
// string, so it can't live in localStorage the way Drive's file id does —
// it's kept in IndexedDB instead (saveLocalFileHandle/loadLocalFileHandle).

const LOCAL_FILE_TYPES = [{ description: "Markdown", accept: { "text/markdown": [".md"] } }];

function localFileSupported() {
  return typeof window.showOpenFilePicker === "function";
}

// Lets the user pick an existing file — resolves to a FileSystemFileHandle,
// or null if they cancelled (showOpenFilePicker rejects with AbortError
// rather than resolving falsy, unlike the Drive picker's own callback).
// Named pickLocalFileHandle (not pickLocalFile) — progressions.html
// already has its own pickLocalFile() for the Drive "upload a file from
// this device" flow, a plain <input type=file> picker returning a File,
// not a FileSystemFileHandle; same name would silently shadow one or the
// other since both are top-level function declarations.
async function pickLocalFileHandle() {
  try {
    const [handle] = await window.showOpenFilePicker({ types: LOCAL_FILE_TYPES });
    return handle;
  } catch (e) {
    if (e.name === "AbortError") return null;
    throw e;
  }
}

// For "start a brand new file" instead of picking an existing one —
// same shape as pickLocalFile (a handle, or null if cancelled). Writes
// `content` immediately so a fresh file isn't left empty.
async function createLocalFile(suggestedName, content = "") {
  try {
    const handle = await window.showSaveFilePicker({ suggestedName, types: LOCAL_FILE_TYPES });
    await writeLocalFile(handle, content);
    return handle;
  } catch (e) {
    if (e.name === "AbortError") return null;
    throw e;
  }
}

// True once read/write access is actually granted for this session —
// queryPermission alone (no dialog) succeeds if a prior grant is still
// live; requestPermission (needs a user gesture, e.g. right after picking
// the file, or a fresh "Reconnect" click) is what actually prompts.
async function hasLocalFilePermission(handle) {
  return (await handle.queryPermission({ mode: "readwrite" })) === "granted";
}
async function ensureLocalFilePermission(handle) {
  if (await hasLocalFilePermission(handle)) return true;
  return (await handle.requestPermission({ mode: "readwrite" })) === "granted";
}

async function readLocalFile(handle) {
  const file = await handle.getFile();
  return file.text();
}

async function writeLocalFile(handle, content) {
  const writable = await handle.createWritable();
  await writable.write(content);
  await writable.close();
}

// Same shape loadSongsFromDrive/GET /api/songs return, so loadSavedSongs()
// in progressions.html can treat all three backends identically.
async function loadSongsFromLocalFile(handle) {
  return splitDriveBlocks(await readLocalFile(handle));
}

// Same "seed an empty file with the generic progressions" behavior as
// ensureDriveFileSeeded — otherwise connecting a brand-new file leaves you
// staring at a blank dropdown.
async function ensureLocalFileSeeded(handle) {
  const texts = await loadSongsFromLocalFile(handle);
  if (texts.length > 0) return;
  await writeLocalFile(handle, joinDriveBlocks(Object.values(SEED_PROGRESSIONS)));
}

// Upsert by Title+Artist, same semantics as the local-server/Drive Save.
async function saveSongToLocalFile(handle, chartText) {
  const parsed = parseSongText(chartText);
  if (parsed.error) throw new Error(parsed.error);
  const blocks = splitDriveBlocks(await readLocalFile(handle));
  const idx = blocks.findIndex(b => driveBlockMatches(b, parsed.title, parsed.artist));
  if (idx === -1) blocks.push(chartText.trim());
  else blocks[idx] = chartText.trim();
  await writeLocalFile(handle, joinDriveBlocks(blocks));
}

// Returns true if a matching song was actually found and removed.
async function deleteSongFromLocalFile(handle, title, artist) {
  const blocks = splitDriveBlocks(await readLocalFile(handle));
  const kept = blocks.filter(b => !driveBlockMatches(b, title, artist));
  await writeLocalFile(handle, joinDriveBlocks(kept));
  return kept.length !== blocks.length;
}

// ---------- IndexedDB persistence for the handle across reloads ----------
const LOCAL_FILE_DB = "lyre-local-file", LOCAL_FILE_STORE = "handle", LOCAL_FILE_KEY = "handle";

function openLocalFileDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(LOCAL_FILE_DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(LOCAL_FILE_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function saveLocalFileHandle(handle) {
  const db = await openLocalFileDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(LOCAL_FILE_STORE, "readwrite");
    tx.objectStore(LOCAL_FILE_STORE).put(handle, LOCAL_FILE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
async function loadLocalFileHandle() {
  const db = await openLocalFileDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(LOCAL_FILE_STORE, "readonly");
    const req = tx.objectStore(LOCAL_FILE_STORE).get(LOCAL_FILE_KEY);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}
async function clearLocalFileHandle() {
  const db = await openLocalFileDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(LOCAL_FILE_STORE, "readwrite");
    tx.objectStore(LOCAL_FILE_STORE).delete(LOCAL_FILE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
