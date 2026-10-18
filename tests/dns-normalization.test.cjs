const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const plain = value => JSON.parse(JSON.stringify(value));
const provider = {type:'inline',behavior:'domain',payload:['+.office.example']};
function input() {
  return {proxies:[{name:'Japan Test',type:'ss',server:'192.0.2.1',port:10000,
    cipher:'aes-128-gcm',password:'TEST-ONLY'}],
    'rule-providers':{Private:provider},
    dns:{enable:true,'enhanced-mode':'fake-ip','nameserver':['192.0.2.53']}};
}
function load(script,setup='') {
  const ctx=vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..',script),'utf8'),ctx);
  if(setup)vm.runInContext(setup,ctx);
  return cfg=>plain(ctx.main(cfg));
}
for(const script of ['linkcube-generic.js','flclash-single.js']) {
  for(const [domain,previous,expected] of [
    ['corp.example',{'+.corp.example':['192.168.1.53']},['192.168.1.53']],
    ['corp.example',{'corp.example':['192.168.1.53']},['192.168.1.53']],
    ['api.corp.example',{'+.corp.example':['192.168.1.53']},['192.168.1.53']],
    ['api.corp.example',{'+.example':['192.168.1.54'],'+.corp.example':['192.168.1.53']},['192.168.1.53']],
    ['nas.lan',{},['system']],
    ['lan',{'+.lan':['192.168.1.53']},['192.168.1.53']],
    ['corp.example',{'corp.example,other.example':['192.168.1.53']},['192.168.1.53']],
    ['api.corp.example',{'*.corp.example':['192.168.1.53']},['192.168.1.53']],
    ['api.eu.corp.example',{'.corp.example':['192.168.1.53']},['192.168.1.53']],
    ['api.eu.corp.example',{'api.*.corp.example':['192.168.1.54'],'.corp.example':['192.168.1.53']},['192.168.1.54']],
    ['api.corp.example',{'*.corp.example':['192.168.1.54'],'+.corp.example':['192.168.1.53']},['192.168.1.54']],
  ])test(script+' custom direct preserves DNS for '+domain+' with '+JSON.stringify(previous),()=>{
    const c=input();
    c.dns['nameserver-policy']=previous;
    const run=load(script,'CUSTOM_DIRECT_DOMAINS.push('+JSON.stringify(domain)+')');
    const out=run(c);
    assert(out.rules.includes('DOMAIN-SUFFIX,'+domain+',DIRECT'));
    assert.deepEqual(out.dns['nameserver-policy']['+.'+domain],expected);
    assert.deepEqual(run(plain(out)).dns,out.dns,'preserved DNS must survive reapplication');
  });
  test(script+' preserves separate root and subdomain DNS while adding a direct suffix',()=>{
    const c=input();
    c.dns['nameserver-policy']={'corp.example':['192.168.1.53'],'.corp.example':['192.168.1.54']};
    const out=load(script,'CUSTOM_DIRECT_DOMAINS.push("corp.example")')(c);
    const keys=Object.keys(out.dns['nameserver-policy']);
    assert(keys.indexOf('+.corp.example')<keys.indexOf('.corp.example'),
      'fallback must precede retained subdomain-only mapping in the core trie');
    assert.deepEqual(out.dns['nameserver-policy']['.corp.example'],['192.168.1.54']);
  });
  test(script+' never moves an existing suffix key ahead of an earlier exact key',()=>{
    const c=input();
    c.dns['nameserver-policy']={'corp.example':['192.168.1.53'],'+.corp.example':['192.168.1.54']};
    const out=load(script,'CUSTOM_DIRECT_DOMAINS.push("corp.example")')(c);
    const keys=Object.keys(out.dns['nameserver-policy']);
    assert(keys.indexOf('corp.example')<keys.indexOf('+.corp.example'));
  });
  test(script+' LAN defaults do not reorder an existing suffix override',()=>{
    const c=input();
    c.dns['nameserver-policy']={'.lan':['192.168.1.53'],'+.lan':['192.168.1.54']};
    const keys=Object.keys(load(script)(c).dns['nameserver-policy']);
    assert(keys.indexOf('.lan')<keys.indexOf('+.lan'));
  });
  test(script+' explicit proxy suffix wins at the root but keeps a private child policy',()=>{
    const c=input();
    c.dns['nameserver-policy']={'+.corp.example':['192.168.1.53'],
      'corp.example':['192.168.1.54'],'api.corp.example':['192.168.1.55']};
    const out=load(script,'CUSTOM_PROXY_DOMAINS.push("corp.example")')(c);
    const keys=Object.keys(out.dns['nameserver-policy']);
    assert(keys.indexOf('+.corp.example')>keys.indexOf('corp.example'));
    assert.deepEqual(out.dns['nameserver-policy']['+.corp.example'],out.dns.fallback);
    assert.deepEqual(out.dns['nameserver-policy']['api.corp.example'],['192.168.1.55']);
  });
  test(script+' custom direct defaults to local DNS while explicit proxy still wins',()=>{
    const c=input();
    c.dns['nameserver-policy']={'+.corp.example':['192.168.1.53']};
    const out=load(script,'CUSTOM_DIRECT_DOMAINS.push("public.example","corp.example");CUSTOM_PROXY_DOMAINS.push("corp.example")')(c);
    assert.deepEqual(out.dns['nameserver-policy']['+.public.example'],out.dns.nameserver);
    assert.deepEqual(out.dns['nameserver-policy']['+.corp.example'],out.dns.fallback);
    assert(out.rules.includes('DOMAIN-SUFFIX,corp.example,🚀 Proxies'));
  });
  for(const [mode,rule] of [
    ['rule','rule-set,Private,real-ip'],
    ['rule','RULE-SET, Private, real-ip'],
    ['blacklist','RULE-SET:Private'],
    ['whitelist','RuLe-SeT:Private'],
    [undefined,'RULE-SET:Private'],
  ]) test(script+' preserves normalized '+mode+' filter '+rule,()=>{
    const c=input();
    if(mode) c.dns['fake-ip-filter-mode']=mode;
    c.dns['fake-ip-filter']=[rule,...(mode==='rule'?['MATCH,fake-ip']:[])];
    const out=load(script)(c);
    assert.deepEqual(out['rule-providers'].Private,provider);
    assert(!Object.hasOwn(out['rule-providers'],'private'),'provider names are case sensitive');
  });
  test(script+' preserves uppercase proxy-server policy dependencies',()=>{
    const c=input();
    c.dns['proxy-server-nameserver-policy']={'RULE-SET:Private':['192.0.2.53']};
    assert.deepEqual(load(script)(c)['rule-providers'].Private,provider);
  });
  test(script+' removes uppercase category selectors before rebuilding enabled DNS',()=>{
    const c=input();
    c.dns['nameserver-policy']={'RULE-SET:Private':['192.0.2.53'],'GEOSITE:cn':['192.0.2.54'],'office.example':['192.0.2.55']};
    const out=load(script)(c);
    assert(!Object.hasOwn(out.dns['nameserver-policy'],'RULE-SET:Private'));
    assert(!Object.hasOwn(out.dns['nameserver-policy'],'GEOSITE:cn'));
    assert.deepEqual(out.dns['nameserver-policy']['office.example'],['192.0.2.55']);
  });
  test(script+' keeps Fake-IP dependencies when input DNS is disabled',()=>{
    const c=input();
    c.dns.enable=false;
    c.dns['fake-ip-filter-mode']='rule';
    c.dns['fake-ip-filter']=['RULE-SET,Private,real-ip','MATCH,fake-ip'];
    const before=plain(c.dns);
    const out=load(script)(c);
    assert.deepEqual(out['rule-providers'].Private,provider);
    if(script==='linkcube-generic.js') assert.deepEqual(out.dns,before);
  });
}
for(const field of ['nameserver-policy','proxy-server-nameserver-policy']) {
  for(const prefix of ['rule-set:','RULE-SET:']) test('disabled generic DNS retains '+field+' '+prefix+' dependencies',()=>{
    const c=input();
    c.dns.enable=false;
    c.dns[field]={[prefix+'Private']:['192.0.2.53']};
    const before=plain(c.dns);
    const out=load('linkcube-generic.js')(c);
    assert.deepEqual(out['rule-providers'].Private,provider);
    assert.deepEqual(out.dns,before);
  });
}

for(const script of ['linkcube-generic.js','flclash-single.js']) {
  for(const enabled of [true,false]) {
    for(const [enhanced,mode,rule] of [
      ['FAKE-IP','rule','RULE-SET,Private,real-ip'],
      ['fake-ip','RULE','RULE-SET,Private,real-ip'],
      ['FaKe-Ip','BlAcKlIsT','RULE-SET:Private'],
      ['FAKE-IP','WHITELIST','RULE-SET:Private'],
    ]) test(script+' keeps '+enhanced+'/'+mode+' dependencies with DNS '+enabled,()=>{
      const c=input();
      c.dns.enable=enabled;
      c.dns['enhanced-mode']=enhanced;
      c.dns['fake-ip-filter-mode']=mode;
      c.dns['fake-ip-filter']=[rule,...(mode.toLowerCase()==='rule'?['MATCH,fake-ip']:[])];
      const before=plain(c.dns);
      const out=load(script)(c);
      assert.deepEqual(out['rule-providers'].Private,provider);
      if(script==='linkcube-generic.js' && !enabled) assert.deepEqual(out.dns,before);
    });
  }
}
