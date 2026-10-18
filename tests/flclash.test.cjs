const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(process.env.FLCLASH_SCRIPT_PATH || path.join(__dirname, '..', 'flclash-single.js'), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
function load() {
  const context = vm.createContext({});
  vm.runInContext(source, context, {timeout: 1000});
  return config => context.main(config);
}
function input() {
  return {proxies: [{name: '日本 Test', type: 'ss', server: '192.0.2.1', port: 10000,
    cipher: 'aes-128-gcm', password: 'TEST-ONLY'}]};
}
test('single file supplies DNS and full geodata without a companion YAML', () => {
  const out = plain(load()(input()));
  assert(out.dns, 'standalone script must supply a DNS object');
  assert.equal(out.dns.enable, true);
  assert.equal(out.dns.ipv6, false);
  assert.equal(out.dns['enhanced-mode'], 'fake-ip');
  assert.equal(out.dns['listen'], '127.0.0.1:1053');
  assert.equal(out['geo-auto-update'], true);
  assert.equal(out['geo-update-interval'], 24);
  assert(out['geox-url']['geo-site'].endsWith('/geosite.dat'));
  assert(out.dns.fallback.every(url => url.endsWith('#🚀 Proxies')));
  assert.equal(out.rules.length, 98);
});
test('keeps nodes, hosts and client switches while adding nested defaults', () => {
  const config = {...input(), mode: 'rule', ipv6: true, 'mixed-port': 7890,
    hosts: {'router.lan': '192.0.2.2'}, tun: {enable: false, stack: 'gvisor', mtu: 1400},
    profile: {'tracing': false}};
  const original = plain(config);
  const out = plain(load()(config));
  for (const key of ['proxies', 'hosts', 'mode', 'ipv6', 'mixed-port']) assert.deepEqual(out[key], original[key]);
  for (const key of ['enable', 'stack', 'mtu']) assert.deepEqual(out.tun[key], original.tun[key]);
  assert.equal(out.profile.tracing, false);
  assert.equal(out.profile['store-fake-ip'], true);
  assert.deepEqual(config, original);
});
test('preserves private DNS and blacklist compatibility entries', () => {
  const config = {...input(), dns: {'nameserver-policy': {'+.office.example': ['192.0.2.53']},
    'fake-ip-filter': ['+.custom.example']}};
  const out = plain(load()(config));
  assert.deepEqual(out.dns['nameserver-policy']['+.office.example'], ['192.0.2.53']);
  for (const value of ['+.custom.example', '+.localhost', '+.weixin.qq.com']) assert(out.dns['fake-ip-filter'].includes(value));
});
for (const mode of ['whitelist', 'rule']) {
  test('does not turn an existing '+mode+' filter into a blacklist', () => {
    const config = {...input(), dns: {'fake-ip-filter-mode': mode, 'fake-ip-filter': ['+.custom.example']}};
    const out = plain(load()(config));
    assert.equal(out.dns['fake-ip-filter-mode'], mode);
    assert.deepEqual(out.dns['fake-ip-filter'], config.dns['fake-ip-filter']);
  });
}
test('provider inputs and empty subscriptions remain untouched', () => {
  const run = load();
  for (const config of [null, {}, {proxies: []}, {'proxy-providers': {remote: {type: 'http'}}},
    {...input(), 'proxy-providers': {remote: {type: 'http'}}}]) {
    const before = plain(config);
    assert.equal(run(config), config);
    assert.deepEqual(config, before);
  }
});
test('bad input fails without partially enabling new settings', () => {
  const config = input();config.proxies.push({...config.proxies[0]});
  const before = plain(config);
  assert.throws(() => load()(config), /重名/);
  assert.deepEqual(config, before);
});
test('reapplying the standalone script is idempotent', () => {
  const run = load();
  const once = plain(run(input()));
  assert.deepEqual(plain(run(plain(once))), once);
});
test('changes to one result do not leak into later subscriptions', () => {
  const run = load();
  const first = run(input());
  assert(first.tun, 'standalone script must supply nested TUN defaults');
  first.tun['dns-hijack'].push('tcp://192.0.2.1:53');
  first.dns['fake-ip-filter'].push('+.private.example');
  const second = plain(run(input()));
  assert.deepEqual(second.tun['dns-hijack'], ['any:53']);
  assert(!second.dns['fake-ip-filter'].includes('+.private.example'));
});
