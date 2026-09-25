import json, sys

path = sys.argv[1]
targets = sys.argv[2:]
txns = json.load(open(path))
for name in targets:
    print("===", name, "===")
    for t in txns:
        if t['upi'] and t['upi']['name'] == name:
            print(' ', t['upi']['bank'], '|', t['upi']['vpa'], '|', t['debit'], t['credit'], '|', t['rawDetails'][:95])
    print()
