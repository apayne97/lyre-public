// Optional Google Drive-backed storage for Progressions, as an alternative
// to the local devserver's /api/songs — meant for a public deployment with
// no server of its own, where each visitor points the app at their OWN
// Drive file instead of everyone sharing one server-side songs-data.md.
// Uses the `drive.file` OAuth scope (deliberately narrow: the app can only
// see files the user explicitly picked through the Google Picker below,
// never their whole Drive) plus the Drive REST API directly — no backend
// involved, everything runs in the browser.
//
// Fill these in from the Google Cloud Console (APIs & Services >
// Credentials): an OAuth 2.0 Client ID of type "Web application" (with
// this app's origin under Authorized JavaScript origins), and an API key
// (used by the Picker only). Neither is secret — they're meant to be
// visible in client-side code — but the API key should still be
// "restricted" in the console (to the Picker/Drive APIs, and to this
// app's actual domains) so it can't be reused elsewhere if copied out of
// the page source.
const DRIVE_CLIENT_ID = "646803858670-8r7k3h8mfgri92cqalhc8b70l3g62grd.apps.googleusercontent.com";
const DRIVE_API_KEY = "AIzaSyAcogjzidhCeWPLJhUlUV0oT5xM1i1Jxx8";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
// The numeric prefix of the OAuth client ID above IS the Cloud project
// number — required on the Picker (setAppId below) so a picked file
// actually gets granted to this app under drive.file's narrow scope.
// Without it, the picker still lets you select a file, but the API
// never grants access to it — every read after "picking" 404s.
const DRIVE_APP_ID = "646803858670";

// Same block format as devserver.py's songs-data.md: chart texts joined by
// a "\n---\n" separator, so a Drive file and a local songs-data.md are
// interchangeable (you could literally upload one as the other).
const DRIVE_SEP = "\n---\n";

let driveAccessToken = null; // set once connectDrive() resolves; short-lived (~1hr), re-requested on 401
let driveTokenClient = null;

function loadScriptOnce(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded) resolve();
      else existing.addEventListener("load", () => resolve());
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => { script.dataset.loaded = "1"; resolve(); };
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

async function ensureGisLoaded() {
  if (window.google && window.google.accounts && window.google.accounts.oauth2) return;
  await loadScriptOnce("https://accounts.google.com/gsi/client");
}

async function ensurePickerLoaded() {
  if (window.google && window.google.picker) return;
  await loadScriptOnce("https://apis.google.com/js/api.js");
  await new Promise((resolve, reject) => {
    gapi.load("picker", { callback: resolve, onerror: () => reject(new Error("Failed to load Google Picker")) });
  });
}

// Opens the Google sign-in/consent popup and resolves with an access
// token. Safe to call again later (e.g. after the token expires) — each
// call re-prompts unless the browser still has a live grant to reuse.
async function connectDrive() {
  await ensureGisLoaded();
  return new Promise((resolve, reject) => {
    driveTokenClient = google.accounts.oauth2.initTokenClient({
      client_id: DRIVE_CLIENT_ID,
      scope: DRIVE_SCOPE,
      callback: (resp) => {
        if (resp.error) { reject(new Error(resp.error)); return; }
        driveAccessToken = resp.access_token;
        resolve(driveAccessToken);
      },
    });
    driveTokenClient.requestAccessToken();
  });
}

// Lets the user pick any existing file (picking it is what grants this
// app access to it, under the drive.file scope) — resolves to
// {id, name}, or null if they cancelled. `parentId`, when given, scopes
// the picker to that folder's contents instead of the whole Drive —
// pass the current driveFolderId so this stays consistent with where
// new files actually get created.
async function pickDriveFile(parentId) {
  await ensurePickerLoaded();
  return new Promise((resolve, reject) => {
    if (!driveAccessToken) { reject(new Error("Not connected to Google Drive yet.")); return; }
    const view = new google.picker.DocsView(google.picker.ViewId.DOCS)
      .setIncludeFolders(false)
      .setSelectFolderEnabled(false);
    if (parentId) view.setParent(parentId);
    const picker = new google.picker.PickerBuilder()
      .addView(view)
      .setOAuthToken(driveAccessToken)
      .setDeveloperKey(DRIVE_API_KEY)
      .setAppId(DRIVE_APP_ID)
      .setCallback((data) => {
        if (data.action === google.picker.Action.PICKED) {
          const doc = data.docs[0];
          resolve({ id: doc.id, name: doc.name });
        } else if (data.action === google.picker.Action.CANCEL) {
          resolve(null);
        }
      })
      .build();
    picker.setVisible(true);
  });
}

// Same grant mechanics as pickDriveFile, but for choosing a folder to
// create new Lyre files inside — lets a second device point at the same
// "Lyre Songs" folder an earlier device already created, instead of
// ensureDriveFolder() (below) silently making a duplicate one (it can't
// find that folder on its own — see the drive.file scope note above).
async function pickDriveFolder() {
  await ensurePickerLoaded();
  return new Promise((resolve, reject) => {
    if (!driveAccessToken) { reject(new Error("Not connected to Google Drive yet.")); return; }
    const view = new google.picker.DocsView(google.picker.ViewId.FOLDERS)
      .setSelectFolderEnabled(true);
    const picker = new google.picker.PickerBuilder()
      .addView(view)
      .setOAuthToken(driveAccessToken)
      .setDeveloperKey(DRIVE_API_KEY)
      .setAppId(DRIVE_APP_ID)
      .setCallback((data) => {
        if (data.action === google.picker.Action.PICKED) {
          const doc = data.docs[0];
          resolve({ id: doc.id, name: doc.name });
        } else if (data.action === google.picker.Action.CANCEL) {
          resolve(null);
        }
      })
      .build();
    picker.setVisible(true);
  });
}

async function createDriveFolder(name, parentId) {
  if (!driveAccessToken) throw new Error("Not connected to Google Drive yet.");
  const metadata = { name, mimeType: "application/vnd.google-apps.folder" };
  if (parentId) metadata.parents = [parentId];
  const res = await fetch("https://www.googleapis.com/drive/v3/files?fields=id,name", {
    method: "POST",
    headers: { Authorization: `Bearer ${driveAccessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(metadata),
  });
  if (!res.ok) throw new Error(`Couldn't create the Drive folder (${res.status}).`);
  return res.json();
}

// For "start a brand new file" instead of picking an existing one —
// creates it (empty, or pre-filled via `content` — used by the "upload a
// local file" path so a chosen songs-data.md's real content lands in the
// new Drive file directly, no separate save step) and returns {id, name}.
// An app-created file needs no picker grant at all: drive.file scope
// always covers files the app itself creates, unlike a pre-existing file
// picked via pickDriveFile (see setAppId note above) — so this path has
// none of that failure mode.
async function createDriveFile(name, content = "", parentId = null) {
  if (!driveAccessToken) throw new Error("Not connected to Google Drive yet.");
  const boundary = "lyre-boundary-" + Math.random().toString(36).slice(2);
  const metadata = { name, mimeType: "text/markdown" };
  if (parentId) metadata.parents = [parentId];
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\nContent-Type: text/markdown\r\n\r\n${content}\r\n` +
    `--${boundary}--`;
  const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name", {
    method: "POST",
    headers: { Authorization: `Bearer ${driveAccessToken}`, "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
  if (!res.ok) throw new Error(`Couldn't create the Drive file (${res.status}).`);
  return res.json();
}

async function readDriveFile(fileId) {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${driveAccessToken}` },
  });
  if (!res.ok) throw new Error(`Couldn't read the Drive file (${res.status}).`);
  return res.text();
}

async function writeDriveFile(fileId, content) {
  const res = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${driveAccessToken}`, "Content-Type": "text/markdown" },
    body: content,
  });
  if (!res.ok) throw new Error(`Couldn't save to the Drive file (${res.status}).`);
  return res.json();
}

function splitDriveBlocks(raw) {
  return raw.split(DRIVE_SEP).map(t => t.trim()).filter(Boolean);
}

function joinDriveBlocks(blocks) {
  return blocks.length ? blocks.join(DRIVE_SEP) + "\n" : "";
}

// Same "does this block belong to the same song" check devserver.py does
// by Title+Artist — reuses the real chart parser instead of a separate
// header-only regex, since it's already loaded here (songs.js loads
// before drive.js's callers ever run).
function driveBlockMatches(blockText, title, artist) {
  const parsed = parseSongText(blockText);
  if (parsed.error) return false;
  return parsed.title.toLowerCase() === title.toLowerCase()
    && (parsed.artist || "").toLowerCase() === (artist || "").toLowerCase();
}

// Returns the raw chart-text blocks in the file — same shape GET
// /api/songs returns locally, so loadSavedSongs() can treat them
// identically regardless of which backend supplied them.
async function loadSongsFromDrive(fileId) {
  const raw = await readDriveFile(fileId);
  return splitDriveBlocks(raw);
}

// Once a Drive file is connected, the song list comes ENTIRELY from that
// file (see resetSongList in progressions.html) — no more built-in
// SEED_PROGRESSIONS overlaid alongside it. So an empty file (freshly
// created, or an existing one with nothing in it yet) gets those written
// into it once, up front — otherwise connecting would leave you staring
// at a blank dropdown instead of somewhere to start from. A file that
// already has content is left alone.
async function ensureDriveFileSeeded(fileId) {
  const texts = await loadSongsFromDrive(fileId);
  if (texts.length > 0) return;
  await writeDriveFile(fileId, joinDriveBlocks(Object.values(SEED_PROGRESSIONS)));
}

// Upsert by Title+Artist, same semantics as the local Save button.
async function saveSongToDrive(fileId, chartText) {
  const parsed = parseSongText(chartText);
  if (parsed.error) throw new Error(parsed.error);
  const blocks = splitDriveBlocks(await readDriveFile(fileId));
  const idx = blocks.findIndex(b => driveBlockMatches(b, parsed.title, parsed.artist));
  if (idx === -1) blocks.push(chartText.trim());
  else blocks[idx] = chartText.trim();
  await writeDriveFile(fileId, joinDriveBlocks(blocks));
}

// Returns true if a matching song was actually found and removed.
async function deleteSongFromDrive(fileId, title, artist) {
  const blocks = splitDriveBlocks(await readDriveFile(fileId));
  const kept = blocks.filter(b => !driveBlockMatches(b, title, artist));
  await writeDriveFile(fileId, joinDriveBlocks(kept));
  return kept.length !== blocks.length;
}
