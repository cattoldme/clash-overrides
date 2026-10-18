const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const plain=x=>JSON.parse(JSON.stringify(x));
function load(script,setup='') {
  const context=vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..',script),'utf8'),context);
  if(setup)vm.runInContext(setup,context);
  return config=>context.main(config);
}
function input(mask=31) {
  return {proxies:['香港','日本','新加坡','美国','台湾'].filter((_,i)=>mask&(1<<i)).concat(['Germany Test']).map(name=>({
    name,type:'ss',server:'192.0.2.1',port:10000,cipher:'aes-128-gcm',password:'TEST-ONLY'})),
    hosts:{'nas.lan':'192.0.2.2'},tun:{enable:false,'route-exclude-address':['192.168.0.0/16']}};
}
function compareProfiles(config,setup='') {
  const desktop=plain(load('flclash-single.js',setup)(plain(config)));
  const mobile=plain(load('flclash-mobile.js',setup)(plain(config)));
  assert.equal(desktop['unified-delay'],true);
  assert.equal(mobile['unified-delay'],false);
  assert.equal(desktop['geo-update-interval'],24);
  assert.equal(mobile['geo-update-interval'],72);
  assert.equal(mobile['tcp-concurrent'],true);
  assert.equal(mobile['find-process-mode'],'strict');
  assert.equal(mobile.profile['store-fake-ip'],true);
  mobile['unified-delay']=true;
  mobile['geo-update-interval']=24;
  for(const group of mobile['proxy-groups']) {
    if(group.type==='select')continue;
    const global=['Auto','Fallback'].includes(group.name);
    assert.equal(group.interval,global?900:600);
    assert.equal(group['expected-status'],'204');
    assert.equal(group.timeout,5000);
    assert.equal(group['max-failed-times'],5);
    assert.equal(group.lazy,true);
    if(group.type==='url-test')assert.equal(group.tolerance,group.name==='Auto'?80:50);
    group.interval=global?300:600;
  }
  for(const [name,provider] of Object.entries(mobile['rule-providers'])) {
    if(provider.type==='inline')continue;
    assert.equal(provider.interval,name==='GameDownload'?86400:172800);
    assert.equal(desktop['rule-providers'][name].interval,name==='GameDownload'?43200:86400);
    provider.interval=name==='GameDownload'?43200:86400;
  }
  assert.deepEqual(mobile,desktop,'only the approved scheduling/settings may differ');
}

test('mobile keeps routing and default choices identical for all 32 region combinations',()=>{
  for(let mask=0;mask<32;mask++)compareProfiles(input(mask));
});
for(const mode of ['blacklist','whitelist','rule'])test('both profiles preserve private DNS and '+mode+' filter semantics',()=>{
  const config=input();
  config.dns={'nameserver-policy':{'corp.example,other.example':['192.168.1.53'],
    'api.corp.example':['192.168.1.54']},'fake-ip-filter-mode':mode,
    'fake-ip-filter':mode==='rule'?['DOMAIN,private.example,real-ip','MATCH,fake-ip']:['+.private.example']};
  compareProfiles(config,'CUSTOM_DIRECT_DOMAINS.push("corp.example");CUSTOM_PROXY_DOMAINS.push("public.example")');
});
test('mobile is idempotent and isolates nested inputs, outputs and subsequent calls',()=>{
  const run=load('flclash-mobile.js');
  const config=input(),before=plain(config),out=run(config);
  assert.deepEqual(config,before);
  const expected=plain(out);
  assert.deepEqual(plain(run(plain(out))),expected);
  out.tun['route-exclude-address'].push('10.0.0.0/8');
  out.dns['fake-ip-filter'].push('+.private.example');
  assert.deepEqual(config,before);
  assert.deepEqual(plain(run(input())),expected);
});
test('mobile skips unsupported inputs and rejects broken inputs without mutation',()=>{
  const run=load('flclash-mobile.js');
  for(const config of [null,{}, {proxies:[]}, {...input(),'proxy-providers':{remote:{type:'http'}}}]) {
    const before=plain(config);
    assert.equal(run(config),config);
    assert.deepEqual(config,before);
  }
  const config=input();config.proxies.push({...config.proxies[0]});
  const before=plain(config);
  assert.throws(()=>run(config),/重名/);
  assert.deepEqual(config,before);
});
