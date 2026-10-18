const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const plain=x=>JSON.parse(JSON.stringify(x));
function load(script) {
  const context=vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..',script),'utf8'),context);
  return config=>context.main(config);
}
function input(extra={}) {
  return {proxies:[{name:'Japan Test',type:'ss',server:'192.0.2.1',port:10000,
    cipher:'aes-128-gcm',password:'TEST-ONLY'}],
    'proxy-groups':[{name:'OldGroup',type:'select',proxies:['DIRECT']}],...extra};
}
const exits=[
  ['listener',name=>({listeners:[{name:'entry',type:'mixed',listen:'127.0.0.1',port:18081,proxy:name}]})],
  ['tunnel object',name=>({tunnels:[{network:['tcp'],address:'127.0.0.1:18082',target:'127.0.0.1:18083',proxy:name}]})],
  ['tunnel string',name=>({tunnels:['tcp,127.0.0.1:18082,127.0.0.1:18083,'+name]})],
  ['NTP',name=>({ntp:{enable:false,'dialer-proxy':name}})],
  ['sub-rule',name=>({'sub-rules':{entry:['DOMAIN,corp.example,'+name,'MATCH,DIRECT']}})],
  ['logical sub-rule',name=>({'sub-rules':{entry:['AND,((DOMAIN,corp.example),(NETWORK,TCP)),'+name,'MATCH,DIRECT']}})],
];
for(const script of ['linkcube-generic.js','flclash-single.js']) {
  for(const [label,extra] of exits) {
    test(script+' rejects deleted '+label+' exit before changing input',()=>{
      const c=input(extra('OldGroup')),before=plain(c);
      assert.throws(()=>load(script)(c),/OldGroup/);
      assert.deepEqual(c,before);
    });
    test(script+' preserves valid '+label+' exits',()=>{
      for(const name of ['DIRECT','Japan Test','🚀 Proxies']) {
        const keep=extra(name),out=plain(load(script)(input(keep)));
        for(const key of Object.keys(keep))assert.deepEqual(out[key],keep[key]);
      }
    });
  }
  for(const [label,extra] of [
    ['TUN',{tun:{enable:false,'route-address-set':['PrivateIP'],'route-exclude-address-set':['PrivateIP']}}],
    ['listener TUN',{listeners:[{name:'tun-entry',type:'tun',enable:false,'route-address-set':['PrivateIP']}]}],
    ['sub-rule',{'sub-rules':{entry:['RULE-SET,PrivateIP,DIRECT,no-resolve','MATCH,DIRECT']}}],
    ['logical sub-rule',{'sub-rules':{entry:['AND,((RULE-SET,PrivateIP),(NETWORK,TCP)),DIRECT','MATCH,DIRECT']}}],
    ['NOT sub-rule',{'sub-rules':{entry:['NOT,((RULE-SET,PrivateIP)),DIRECT','MATCH,DIRECT']}}],
    ['nested NOT sub-rule',{'sub-rules':{entry:['OR,((NOT,((RULE-SET,PrivateIP))),(NETWORK,TCP)),DIRECT','MATCH,DIRECT']}}],
  ]) {
    test(script+' retains '+label+' rule providers with DNS absent',()=>{
      const provider={type:'inline',behavior:'ipcidr',payload:['192.0.2.0/24']};
      const c=input({...extra,'rule-providers':{PrivateIP:provider}});
      assert.deepEqual(plain(load(script)(c))['rule-providers'].PrivateIP,provider);
    });
    test(script+' rejects missing '+label+' rule providers atomically',()=>{
      const c=input(extra),before=plain(c);
      assert.throws(()=>load(script)(c),/PrivateIP/);
      assert.deepEqual(c,before);
    });
  }
  test(script+' allows a sub-rule to refer to another sub-rule rather than an exit',()=>{
    const keep={'sub-rules':{entry:['SUB-RULE,(NETWORK,TCP),OldGroup','MATCH,DIRECT'],OldGroup:['MATCH,DIRECT']}};
    assert.deepEqual(plain(load(script)(input(keep)))['sub-rules'],keep['sub-rules']);
  });
}
