# Offline operation and releases

The service worker installs all shell resources into a scope-specific versioned cache.
Requests use SHA-256 integrity and bypass the HTTP cache during installation. Text
hashes accept both LF and CRLF line endings for Windows/Git hosting compatibility.
A missing,
failed or mismatched file rejects installation; the current worker remains available.
The installed shell is cache-first and never updated through runtime writes. Only exact
allowlisted GET URLs are intercepted. Unknown paths, queries, uploads and generated
content are not cached; local student databases, drafts and signatures remain outside
Cache Storage. Bundled XLSX, jsPDF, translations, styles, icons and the blank template
are included so they do not require an earlier online visit to their particular UI.

Neither skipWaiting nor clients.claim is used. Close every controlled application tab
and installed-PWA window, then reopen to activate an installed update. Reloading a tab
while another old client remains open continues to use the old release. First-time
installation does not claim the initial page; reload after installation to test offline.

Cached shell responses are returned without consulting the server. If an entry is
missing, integrity-checked network success is returned but not cached. A network error/timeout or HTTP
5xx uses an exact successful cached fallback if one is available; otherwise a network
error or the original 5xx is returned. Network 404 responses remain 404. Unknown
navigation routes do not receive an index.html fallback that could hide a real 404.
Activation waits for cleanup of older caches owned by this scope and recognizable
legacy caches containing this scope's index.html. Unrelated caches are preserved.

## Publishing

1. Finish changes to every shell file, including the template and manifest.
2. Run `node tools/update-shell.cjs NEW_VERSION` with a unique, increasing version.
   Never reuse a version for different content. This updates sw.js hashes only.
3. Run `node --test tests/*.test.cjs`, syntax checks and `git diff --check`.
4. Publish the complete directory, preferably as one atomic static deployment. If
   publishing file by file, publish sw.js last. Integrity prevents a partial shell
   from installing, but first-time uncontrolled online visits still depend on the
   hosting provider serving a coherent deployment. Retry after completing publication.
5. Keep `/sw.js` revalidated (`_headers` already specifies no-cache).

## Manual browser checks

- Use localhost or HTTPS. Load online, wait for installation, reload and confirm a
  service-worker controller. Inspect Cache Storage: one cache for the current scope
  and version, containing only the allowlisted resources.
- Enable offline mode and reload both the app root and index.html. Switch ES/EN/JA,
  import fictional RUN/IPE CSV/XLS/XLSX data, autocomplete, preview and download the
  Spanish PDF. Check icons, styles, local draft reload and installed-PWA reopening.
- Return online. Keep two old tabs open with a fictional draft; deploy a new version.
  Verify the new worker waits, the old cache stays intact and reloads use the old
  shell. Close all tabs and PWA windows, reopen, and verify the new cache/worker and
  removal of the old cache. Confirm stored drafts/students are preserved.
- Publish a changed shell file with an incorrect hash, or return 503 for an install
  asset: the new installation must fail and the previous release must still work.
- In a disposable profile/cache, remove a cached entry and return 404/503 for its URL.
  A 404 must remain 404; without a cached entry a 503 remains 503. With a valid cached
  entry, the cache-first strategy serves it without needing the server.
