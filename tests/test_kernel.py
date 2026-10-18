"""Opt-in loopback regressions: set MIHOMO_BIN to an installed Mihomo executable.

No real nodes, system proxy, TUN, public DNS or remote providers are used.
DNS checks deliberately isolate ordinary policies from unrelated GEO selectors.
"""
from contextlib import contextmanager
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import re
import socket
import socketserver
import struct
import subprocess
import tempfile
import threading
import time
import unittest

ROOT=Path(__file__).resolve().parents[1]
BIN=os.environ.get('MIHOMO_BIN')
SCRIPTS=['linkcube-generic.js','flclash-single.js','flclash-mobile.js']


def transformed(script, config, setup='', expression='main(config)'):
    runner="""const fs=require('fs'),vm=require('vm');const c=vm.createContext({});
vm.runInContext(fs.readFileSync(process.argv[1],'utf8'),c);
vm.runInContext(process.argv[2],c);c.config=JSON.parse(fs.readFileSync(0,'utf8'));
process.stdout.write(JSON.stringify(vm.runInContext(process.argv[3],c)));"""
    result=subprocess.run(['node','-e',runner,str(ROOT/script),setup,expression],input=json.dumps(config),
                          capture_output=True,text=True,encoding='utf-8',timeout=10,check=True)
    return json.loads(result.stdout)


def free_port(kind=socket.SOCK_STREAM):
    with socket.socket(socket.AF_INET,kind) as sock:
        sock.bind(('127.0.0.1',0))
        return sock.getsockname()[1]


def query(port, domain):
    message=struct.pack('!HHHHHH',1234,256,1,0,0,0)
    message+=b''.join(bytes([len(label)])+label.encode() for label in domain.split('.'))+b'\0\0\x01\0\x01'
    with socket.socket(socket.AF_INET,socket.SOCK_DGRAM) as sock:
        sock.settimeout(.3)
        sock.sendto(message,('127.0.0.1',port))
        response=sock.recv(2048)
    if response[3]&15:
        raise AssertionError('DNS error '+repr(response))
    return socket.inet_ntoa(response[-4:])


@contextmanager
def core(config):
    with tempfile.TemporaryDirectory(prefix='.kernel-test-',dir=ROOT) as directory:
        folder=Path(directory)
        assert folder.resolve().parent==ROOT.resolve()
        filename=folder/'config.json'
        filename.write_text(json.dumps(config,ensure_ascii=False),encoding='utf-8')
        with (folder/'core.log').open('w',encoding='utf-8') as log:
            process=subprocess.Popen([BIN,'-d',str(folder),'-f',str(filename)],stdout=log,stderr=log,
                creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
            try:
                yield process,folder/'core.log'
            finally:
                process.terminate()
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait(timeout=5)


def wait_until(predicate, process, log):
    deadline=time.monotonic()+5
    while time.monotonic()<deadline:
        if process.poll() is not None:
            raise AssertionError(log.read_text(encoding='utf-8'))
        try:
            if predicate():
                return
        except (TimeoutError,OSError):
            pass
        time.sleep(.04)
    raise AssertionError('Core did not become ready: '+log.read_text(encoding='utf-8'))


def base_config():
    return {'mode':'rule','log-level':'debug','ipv6':False,'geo-auto-update':False,
            'dns':{'enable':False},'tun':{'enable':False},'rules':['MATCH,REJECT']}


@unittest.skipUnless(BIN,'Set MIHOMO_BIN for isolated native regressions')
class KernelTests(unittest.TestCase):
    def test_private_dns_multi_keys_wildcards_and_root_child_precedence(self):
        servers=[]
        threads=[]
        try:
            for last in [11,12,13]:
                class Handler(socketserver.BaseRequestHandler):
                    def handle(self):
                        data,sock=self.request
                        answer=data[:2]+b'\x81\x80'+data[4:6]+b'\x00\x01\x00\x00\x00\x00'+data[12:]
                        answer+=b'\xc0\x0c\x00\x01\x00\x01\x00\x00\x00\x3c\x00\x04'
                        sock.sendto(answer+bytes([203,0,113,self.server.last]),self.client_address)
                server=socketserver.UDPServer(('127.0.0.1',0),Handler)
                server.last=last
                thread=threading.Thread(target=server.serve_forever,daemon=True)
                thread.start()
                servers.append(server)
                threads.append(thread)
            private,public,other=['127.0.0.1:'+str(server.server_address[1]) for server in servers]
            policy={'corp.test,other.test':[private],'*.wild.test':[private],
                    '.dot.test':[private],'split.test':[private],'.split.test':[other],
                    'api.proxy.test':[private],'.lan':[private],'+.lan':[other],
                    'order.test':[private],'+.order.test':[other],
                    '+.reverse.test':[other],'reverse.test':[private]}
            setup='LOCAL_DNS.splice(0,LOCAL_DNS.length,'+json.dumps(public)+');'
            setup+='REMOTE_DNS.splice(0,REMOTE_DNS.length,'+json.dumps(public)+');'
            setup+='CUSTOM_DIRECT_DOMAINS.push("corp.test","api.wild.test","dot.test","split.test","order.test","reverse.test");'
            setup+='CUSTOM_PROXY_DOMAINS.push("proxy.test");'
            for script in SCRIPTS:
                with self.subTest(script=script):
                    config={'dns':{'enable':True,'nameserver-policy':policy}}
                    out=transformed(script,config,setup,'configureDns(config);config')
                    ordinary={key:value for key,value in out['dns']['nameserver-policy'].items()
                              if not key.startswith(('geosite:','rule-set:'))}
                    port=free_port(socket.SOCK_DGRAM)
                    native=base_config()
                    native['proxy-groups']=[{'name':'Proxies','type':'select','proxies':['DIRECT']}]
                    native['dns']={'enable':True,'listen':'127.0.0.1:'+str(port),
                        'enhanced-mode':'redir-host','use-hosts':False,'use-system-hosts':False,
                        'nameserver':[public],'nameserver-policy':ordinary}
                    with core(native) as (process,log):
                        wait_until(lambda:query(port,'ready.test')=='203.0.113.12',process,log)
                        for domain,last in [('corp.test',11),('other.test',11),('api.wild.test',11),
                            ('child.api.wild.test',11),('deep.other.wild.test',12),
                            ('dot.test',12),('child.dot.test',11),('deep.child.dot.test',11),
                            ('split.test',11),('child.split.test',13),('proxy.test',12),
                            ('api.proxy.test',11),('nas.lan',13),('order.test',13),
                            ('child.order.test',13),('reverse.test',11),('child.reverse.test',13)]:
                            self.assertEqual(query(port,domain),'203.0.113.'+str(last),(script,domain))
        finally:
            for server in servers:
                server.shutdown()
                server.server_close()
            for thread in threads:
                thread.join(timeout=2)

    def test_generated_health_checks_reject_503_and_mobile_avoids_second_head(self):
        class Handler(BaseHTTPRequestHandler):
            protocol_version='HTTP/1.1'
            def do_HEAD(self):
                self.server.requests+=1
                self.send_response(self.server.status)
                self.send_header('Content-Length','0')
                self.end_headers()
            def log_message(self,*args):
                pass
        server=ThreadingHTTPServer(('127.0.0.1',0),Handler)
        server.daemon_threads=True
        thread=threading.Thread(target=server.serve_forever,daemon=True)
        thread.start()
        try:
            for script in ['flclash-single.js','flclash-mobile.js']:
                for status in [204,503]:
                    with self.subTest(script=script,status=status):
                        server.status=status
                        server.requests=0
                        out=transformed(script,{'proxies':[{'name':'HK Test','type':'direct'}]})
                        native=base_config()
                        native['unified-delay']=out['unified-delay']
                        native['proxies']=out['proxies']
                        groups=[group for group in out['proxy-groups'] if group['type']!='select']
                        for group in groups:
                            group['url']='http://127.0.0.1:'+str(server.server_port)+'/probe'
                        native['proxy-groups']=groups
                        with core(native) as (process,log):
                            expected='true' if status==204 else 'false'
                            pattern=r'Health Checked, proxy: HK Test, url: [^\n]*?, alive: '+expected
                            wait_until(lambda:len(re.findall(pattern,log.read_text(encoding='utf-8')))>=3,process,log)
                            self.assertEqual(server.requests,6 if out['unified-delay'] else 3)
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=2)

    def test_retained_valid_tunnels_and_subrule_dependencies_parse_in_core(self):
        for script in SCRIPTS:
            with self.subTest(script=script):
                config={'proxies':[{'name':'JP Test','type':'direct'}],
                    'tunnels':['tcp,127.0.0.1:18082,127.0.0.1:18083,DIRECT'],
                    'listeners':[{'name':'entry','type':'mixed','listen':'127.0.0.1','port':18081,'proxy':'DIRECT','rule':'entry'}],
                    'sub-rules':{'entry':['AND,((RULE-SET,PrivateIP),(NETWORK,TCP)),DIRECT',
                        'OR,((NOT,((RULE-SET,PrivateIP))),(NETWORK,TCP)),DIRECT','MATCH,REJECT']},
                    'rule-providers':{'PrivateIP':{'type':'inline','behavior':'ipcidr','payload':['192.0.2.0/24']}}}
                out=transformed(script,config)
                native=base_config()
                for key in ['tunnels','listeners','sub-rules']:
                    native[key]=out[key]
                native['rule-providers']={'PrivateIP':out['rule-providers']['PrivateIP']}
                with tempfile.TemporaryDirectory(prefix='.kernel-test-',dir=ROOT) as directory:
                    folder=Path(directory)
                    self.assertEqual(folder.resolve().parent,ROOT.resolve())
                    filename=folder/'config.json'
                    filename.write_text(json.dumps(native,ensure_ascii=False),encoding='utf-8')
                    result=subprocess.run([BIN,'-d',str(folder),'-f',str(filename),'-t'],capture_output=True,
                        text=True,encoding='utf-8',timeout=10,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
                    self.assertEqual(result.returncode,0,result.stdout+result.stderr)


if __name__=='__main__':
    unittest.main()
