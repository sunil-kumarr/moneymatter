import json, sys

path = sys.argv[1]
targets = sys.argv[2:]
txns = json.load(open(path))
for name in targets:
    print("===", name, "===")
    for t in txns:
        if t.get('name') == name:
            print(' ', t['kind'], '|', t['debit'], t['credit'], '|', t['narration'][:110])
    print()
