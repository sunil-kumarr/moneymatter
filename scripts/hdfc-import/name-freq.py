import json, sys
from collections import Counter

txns = json.load(open(sys.argv[1]))
names = Counter()
for t in txns:
    if t.get('name'):
        names[t['name']] += 1
for n, c in sorted(names.items(), key=lambda x: -x[1]):
    print(c, repr(n))
