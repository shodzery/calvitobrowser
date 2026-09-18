const { test } = require('node:test');
const assert = require('node:assert/strict');
const { webUrl, blockedHost, cleanData, cleanBookmarks, cleanPreferences, githubRepository } = require('../src/core');
test('only HTTP(S) can cross the navigation boundary', () => {
  for (const url of ['javascript:alert(1)', 'file:///C:/secret', 'data:text/html,hi', 'ms-settings:privacy', 'about:blank']) assert.equal(webUrl(url), '');
  assert.equal(webUrl('https://example.com'), 'https://example.com/');
});
test('blocking matches a host or subdomain, never a lookalike', () => {
  assert.ok(blockedHost('https://a.doubleclick.net/ad'));
  assert.equal(blockedHost('https://notdoubleclick.net'), false);
  assert.equal(blockedHost('https://doubleclick.net.example.org'), false);
});
test('bookmarks are sanitized and deduplicated on import', () => {
  assert.deepEqual(cleanBookmarks([{ url: 'file:///secret' }, { url: 'https://example.org', title: 'First' }, { url: 'https://example.org', title: 'Last' }]), [{ url: 'https://example.org/', title: 'Last' }]);
});
test('private tabs never enter a saved session and invalid preferences reset', () => {
  const data = cleanData({ notes: 'hello', session: { tabs: [{ url: 'https://example.org', private: true }, { url: 'https://example.net' }, { url: 'file:///bad' }] }, preferences: { theme: 'evil', protectionEnabled: 'no' } });
  assert.equal(data.session.tabs.length, 1);
  assert.equal(data.notes, 'hello');
  assert.equal(data.preferences.protectionEnabled, true);
  assert.equal(cleanPreferences({ theme: 'system' }).theme, 'system');
});
test('GitHub repository is validated without accepting arbitrary hosts', () => {
  assert.equal(githubRepository('https://github.com/shodzery/calvitobrowser.git'), 'shodzery/calvitobrowser');
  assert.equal(githubRepository('https://evil.example/user/repo'), '');
});
