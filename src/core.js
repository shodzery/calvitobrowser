/* Shared, deterministic policy helpers. No Electron or filesystem access. */
const DEFAULT_PREFERENCES = Object.freeze({
  protectionEnabled: true, searchEngine: 'duckduckgo', theme: 'dark',
  restoreSession: true, showBookmarkBar: true, accent: 'mint',
  reduceMotion: false, autoCheckUpdates: true
});
const BLOCKED_HOSTS = [
  'doubleclick.net', 'googlesyndication.com', 'google-analytics.com',
  'googletagmanager.com', 'adservice.google.com', 'adnxs.com',
  'amazon-adsystem.com', 'scorecardresearch.com', 'taboola.com',
  'outbrain.com', 'facebook.net', 'hotjar.com', 'criteo.com',
  'rubiconproject.com', 'pubmatic.com', 'openx.net'
];
function webUrl(value) {
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.href : ''; }
  catch { return ''; }
}
function originOf(value) { try { return webUrl(value) ? new URL(value).origin : ''; } catch { return ''; } }
function blockedHost(value) {
  try { const host = new URL(value).hostname.toLowerCase(); return BLOCKED_HOSTS.some(base => host === base || host.endsWith(`.${base}`)); }
  catch { return false; }
}
function cleanPreferences(value = {}) {
  const result = { ...DEFAULT_PREFERENCES };
  for (const key of ['protectionEnabled', 'restoreSession', 'showBookmarkBar', 'reduceMotion', 'autoCheckUpdates']) {
    if (typeof value[key] === 'boolean') result[key] = value[key];
  }
  for (const [key, values] of Object.entries({ searchEngine: ['duckduckgo', 'google', 'brave', 'bing', 'ecosia'], theme: ['dark', 'light', 'system'], accent: ['mint', 'violet', 'amber'] })) {
    if (values.includes(value[key])) result[key] = value[key];
  }
  return result;
}
function cleanBookmarks(items) {
  if (!Array.isArray(items)) return [];
  return [...new Map(items.filter(item => item && webUrl(item.url)).slice(0, 5000).map(item => [webUrl(item.url), {
    url: webUrl(item.url), title: String(item.title || new URL(item.url).hostname).slice(0, 500)
  }])).values()];
}
function cleanData(value = {}) {
  return {
    bookmarks: cleanBookmarks(value.bookmarks),
    history: Array.isArray(value.history) ? value.history.filter(item => item && webUrl(item.url)).slice(0, 500) : [],
    downloads: Array.isArray(value.downloads) ? value.downloads.slice(0, 100) : [],
    groups: Array.isArray(value.groups) ? value.groups.slice(0, 100) : [],
    session: value.session && Array.isArray(value.session.tabs) ? {
      tabs: value.session.tabs.filter(tab => tab && !tab.private && (!tab.url || webUrl(tab.url))).slice(0, 50),
      activeIndex: Math.max(0, Number(value.session.activeIndex) || 0)
    } : { tabs: [], activeIndex: 0 },
    notes: String(value.notes || '').slice(0, 100000),
    preferences: cleanPreferences(value.preferences),
    permissions: value.permissions && typeof value.permissions === 'object' && !Array.isArray(value.permissions) ? value.permissions : {},
    adWhitelist: Array.isArray(value.adWhitelist) ? value.adWhitelist.filter(item => originOf(item) === item) : []
  };
}
function githubRepository(value = '') {
  const normalized = value.replace(/^git\+/, '').replace(/^https:\/\/github.com\//, '').replace(/\.git$/, '').replace(/\/$/, '');
  return /^[\w.-]+\/[\w.-]+$/.test(normalized) ? normalized : '';
}
module.exports = { DEFAULT_PREFERENCES, webUrl, originOf, blockedHost, cleanPreferences, cleanBookmarks, cleanData, githubRepository };
