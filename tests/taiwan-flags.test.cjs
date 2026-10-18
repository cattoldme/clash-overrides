const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const plain = x => JSON.parse(JSON.stringify(x));
function load(script) {
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..',script),'utf8'), context);
  return config => context.main(config);
}
function node(name) {
  return {name,type:'ss',server:'192.0.2.1',port:10000,cipher:'aes-128-gcm',password:'🇹🇼 台湾 01'};
}
for (const script of ['linkcube-generic.js','flclash-single.js','flclash-mobile.js']) {
  test(script+' changes Taiwan flags and all retained node exits without changing credentials',()=>{
    const old='🇹🇼 台湾 01', renamed='🇨🇳 台湾 01';
    const config={proxies:[node(old),{...node('Japan Test'),'dialer-proxy':old}],
      listeners:[{name:'entry',type:'mixed',proxy:old}],
      tunnels:[{proxy:old},'tcp,127.0.0.1:18082,example.com:443,'+old],
      ntp:{'dialer-proxy':old},
      'sub-rules':{entry:['DOMAIN,corp.example,'+old,'AND,((NETWORK,TCP),(DOMAIN,corp.example)),'+old,'MATCH,'+old]},
      sniffer:{'force-domain':['rule-set:Private']},
      'rule-providers':{Private:{type:'inline',behavior:'domain',payload:['corp.example'],proxy:old}},
      dns:{'nameserver-policy':{'corp.example':[
        'https://dns.example/dns-query#'+encodeURIComponent(old)+'&h3=true',
        'https://dns.example/dns-query#'+encodeURIComponent('🇹🇼')+' 台湾 01',
        'https://dns.example/dns-query#'+encodeURIComponent(old).toLowerCase(),
      ]}}};
    const main=load(script),out=plain(main(config));
    assert.equal(out.proxies[0].name,renamed);
    assert.equal(out.proxies[0].password,old);
    assert.equal(out.proxies[1]['dialer-proxy'],renamed);
    assert.deepEqual(out['proxy-groups'].find(group=>group.name==='TW').proxies,[renamed]);
    assert.equal(out.listeners[0].proxy,renamed);
    assert.equal(out.tunnels[0].proxy,renamed);
    assert(out.tunnels[1].endsWith(','+renamed));
    assert.equal(out.ntp['dialer-proxy'],renamed);
    assert(out['sub-rules'].entry.every(rule=>rule.endsWith(','+renamed)));
    assert.equal(out['rule-providers'].Private.proxy,renamed);
    for (const server of out.dns['nameserver-policy']['corp.example'])
      assert.equal(decodeURIComponent(server.split('#')[1].split('&')[0]),renamed);
    assert.deepEqual(plain(main(plain(out))),out);
  });
  test(script+' keeps flag-only Taiwan nodes classified after repeated application',()=>{
    const main=load(script),out=plain(main({proxies:[node('🇹🇼 01')]}));
    assert.equal(out.proxies[0].name,'🇨🇳 TW 01');
    assert.deepEqual(out['proxy-groups'].find(group=>group.name==='TW').proxies,['🇨🇳 TW 01']);
    assert.deepEqual(plain(main(plain(out))),out);
  });
  test(script+' rejects renaming collisions without changing the input',()=>{
    const config={proxies:[node('🇹🇼 台湾 01'),node('🇨🇳 台湾 01')]},before=plain(config);
    assert.throws(()=>load(script)(config),/重名/);
    assert.deepEqual(config,before);
  });
}
