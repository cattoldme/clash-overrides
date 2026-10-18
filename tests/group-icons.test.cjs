const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const root = path.join(__dirname, '..');
const names = ['Proxies','AI','TikTok','Spotify','Streaming','YouTube','Telegram','Google',
  'GitHub','Steam','Bilibili','Bahamut','Microsoft','Apple','PayPal','Final','Auto','Fallback',
  'Manual','HK','JP','SG','TW','US'];
const iconBase = 'https://raw.githubusercontent.com/cattoldme/clash-overrides/main/icons/';

function run(script, regions = ['香港','日本','新加坡','美国','台湾']) {
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(root, script), 'utf8'), context);
  return JSON.parse(JSON.stringify(context.main({dns: {}, proxies: regions.concat('Germany Test')
    .map(name => ({name, type:'ss', server:'192.0.2.1', port:10000,
      cipher:'aes-128-gcm', password:'TEST-ONLY'}))})));
}

for (const script of ['linkcube-generic.js','flclash-single.js','flclash-mobile.js']) {
  test(script + ' uses all 24 plain group names and approved C icons', () => {
    const out = run(script);
    assert.deepEqual(out['proxy-groups'].map(group => group.name), names);
    for (const group of out['proxy-groups']) {
      assert.equal(group.icon, iconBase + group.name + '.png');
      assert(fs.existsSync(path.join(root, 'icons', group.name + '.png')), group.name);
    }
    const targets = new Set(names.concat(['DIRECT','REJECT'], out.proxies.map(node => node.name)));
    for (const group of out['proxy-groups'])
      for (const choice of group.proxies) assert(targets.has(choice), choice);
    for (const rule of out.rules) {
      const fields = rule.split(',');
      assert(targets.has(fields.at(-1) === 'no-resolve' ? fields.at(-2) : fields.at(-1)), rule);
    }
    assert(out.dns.fallback.every(url => url.endsWith('#Proxies')));
  });
  test(script + ' does not create missing regions just to display icons', () => {
    const out = run(script, []);
    assert.deepEqual(out['proxy-groups'].map(group => group.name), names.slice(0,19));
    assert.deepEqual(out['proxy-groups'].find(group => group.name === 'AI').proxies,
      ['Proxies','Manual']);
  });
}

test('published icon assets match their attributed C selection and remain small PNGs', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'icons', 'sources.json'), 'utf8'));
  assert.deepEqual(Object.keys(manifest.icons).sort(), names.slice().sort());
  let total = 0;
  for (const name of names) {
    const bytes = fs.readFileSync(path.join(root, 'icons', name + '.png'));
    assert.equal(bytes.subarray(0,8).toString('hex'), '89504e470d0a1a0a', name);
    assert.equal(bytes.readUInt32BE(16), 128, name);
    assert.equal(bytes.readUInt32BE(20), 128, name);
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), manifest.icons[name].sha256);
    assert.match(manifest.icons[name].source, /^https:\/\/raw\.githubusercontent\.com\/(Koolson\/Qure|lucide-icons\/lucide)\//);
    total += bytes.length;
  }
  assert(total < 300000, 'keep the complete icon set lightweight');
});
