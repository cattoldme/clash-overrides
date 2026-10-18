"""Verify Global/Apple domain + residual coverage, offline or at one upstream SHA."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import urllib.request

import yaml


def canonical_digest(rules):
    return hashlib.sha256(('\n'.join(sorted(set(rules)))+'\n').encode()).hexdigest()


def combined(domains, residual):
    expanded=[]
    for domain in domains:
        if domain.startswith('+.' ):
            expanded.append('DOMAIN-SUFFIX,'+domain[2:])
        elif '*' not in domain and not domain.startswith('.'):
            expanded.append('DOMAIN,'+domain)
        else:
            raise ValueError('Unexpected domain pattern: '+domain)
    return set(expanded).union(residual)


def payload(content):
    return yaml.safe_load(content)['payload']


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    mode=parser.add_mutually_exclusive_group(required=True)
    mode.add_argument('--snapshot',type=Path,help='Offline reviewed fixture directory')
    mode.add_argument('--commit',help='Full blackmatrix7 upstream commit SHA; fetch all files at this same SHA')
    args=parser.parse_args()
    if args.commit and not re.fullmatch('[0-9a-fA-F]{40}',args.commit):
        parser.error('--commit must be a full 40-character SHA')
    manifest=json.loads((args.snapshot/'reviewed-sources.json').read_text(encoding='utf-8')) if args.snapshot else None
    result={}
    for name in ['Global','Apple']:
        if args.snapshot:
            domain=(args.snapshot/(name.lower()+'-domain.yaml')).read_bytes()
            residual=(args.snapshot/(name.lower()+'-residual.yaml')).read_bytes()
            expected=manifest['splits'][name]
            rules=combined(payload(domain),payload(residual))
            if len(rules)!=expected['count'] or canonical_digest(rules)!=expected['canonical_sha256']:
                raise SystemExit(name+' split differs from the pinned full classical snapshot')
            for filename,content in [(name.lower()+'-domain.yaml',domain),(name.lower()+'-residual.yaml',residual)]:
                if hashlib.sha256(content).hexdigest()!=manifest['files'][filename]['sha256']:
                    raise SystemExit(name+' fixture checksum mismatch: '+filename)
        else:
            def fetch(suffix):
                url='https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/'+args.commit+'/rule/Clash/'+name+'/'+name+suffix+'.yaml'
                with urllib.request.urlopen(url,timeout=30) as response:
                    return payload(response.read())
            rules=combined(fetch('_Domain'),fetch(''))
            full=set(fetch('_Classical'))
            if rules!=full:
                raise SystemExit(name+' missing='+repr(sorted(full-rules))+' extra='+repr(sorted(rules-full)))
        result[name]=len(rules)
    print(json.dumps(result))


if __name__=='__main__':
    main()
