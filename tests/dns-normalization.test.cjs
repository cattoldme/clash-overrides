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
function load(script) {
  const ctx=vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..',script),'utf8'),ctx);
  return cfg=>plain(ctx.main(cfg));
}
for(const script of ['linkcube-generic.js','flclash-single.js']) {
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
