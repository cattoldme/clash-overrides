const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const plain=value=>JSON.parse(JSON.stringify(value));
function input(field='skip-domain',dnsState='enabled') {
  const provider=field.endsWith('address')
    ?{type:'inline',behavior:'ipcidr',payload:['192.168.0.0/16']}
    :{type:'inline',behavior:'domain',payload:['+.office.example']};
  const config={proxies:[{name:'Japan Test',type:'ss',server:'192.0.2.1',port:10000,
    cipher:'aes-128-gcm',password:'TEST-ONLY'}],
    'rule-providers':{Private:provider,Extra:provider,Unused:provider},
    sniffer:{enable:true,sniff:{HTTP:{ports:[80]}},[field]:['RULE-SET:Private,Extra']}};
  if(dnsState!=='absent')config.dns={enable:dnsState==='enabled','enhanced-mode':'redir-host'};
  return config;
}
function load(script) {
  const ctx=vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..',script),'utf8'),ctx);
  return config=>ctx.main(config);
}
for(const script of ['linkcube-generic.js','flclash-single.js']) {
  for(const field of ['force-domain','skip-domain','skip-src-address','skip-dst-address']) {
    for(const dnsState of ['enabled','disabled','absent']) {
      test(script+' retains '+field+' providers with DNS '+dnsState,()=>{
        const config=input(field,dnsState);
        const expected=plain(config);
        const run=load(script);
        const out=plain(run(config));
        assert.deepEqual(out.sniffer,expected.sniffer);
        for(const name of ['Private','Extra'])
          assert.deepEqual(out['rule-providers'][name],expected['rule-providers'][name]);
        assert(!Object.hasOwn(out['rule-providers'],'Unused'));
        assert.deepEqual(plain(run(plain(out))),out);
      });
    }
  }
  test(script+' retains references even when sniffing is disabled',()=>{
    const config=input('skip-domain','absent');
    config.sniffer.enable=false;
    const expected=plain(config['rule-providers'].Private);
    const out=load(script)(config);
    assert.deepEqual(plain(out['rule-providers'].Private),expected);
    assert.equal(out.sniffer.enable,false);
  });
  for(const kind of ['missing','collision','removed-exit']) {
    test(script+' rejects '+kind+' sniffer dependencies before modifying input',()=>{
      const config=input('skip-domain','absent');
      const name=kind==='collision'?'Netflix':'Private';
      config.sniffer['skip-domain']=['rule-set:'+name];
      if(kind==='missing')delete config['rule-providers'].Private;
      if(kind==='collision')config['rule-providers'].Netflix=config['rule-providers'].Private;
      if(kind==='removed-exit') {
        config['proxy-groups']=[{name:'OldGroup',type:'select',proxies:['DIRECT']}];
        config['rule-providers'].Private={type:'http',behavior:'domain',format:'yaml',
          url:'https://example.invalid/private.yaml',path:'./private.yaml',proxy:'OldGroup'};
      }
      const before=plain(config);
      assert.throws(()=>load(script)(config),/规则集|出口/);
      assert.deepEqual(config,before);
    });
  }
}
