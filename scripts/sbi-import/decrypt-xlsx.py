"""
Decrypt a password-protected SBI account-statement xlsx into a plain xlsx
that openpyxl can read. Requires msoffcrypto-tool (pip install msoffcrypto-tool).

Usage: python3 decrypt-xlsx.py <encrypted.xlsx> <password> <output.xlsx>
"""
import io
import sys

import msoffcrypto


def decrypt(in_path, password, out_path):
    with open(in_path, "rb") as f:
        office_file = msoffcrypto.OfficeFile(f)
        office_file.load_key(password=password)
        decrypted = io.BytesIO()
        office_file.decrypt(decrypted)
    with open(out_path, "wb") as out:
        out.write(decrypted.getvalue())


if __name__ == "__main__":
    in_path, password, out_path = sys.argv[1], sys.argv[2], sys.argv[3]
    decrypt(in_path, password, out_path)
    print(f"Decrypted {in_path} -> {out_path}", file=sys.stderr)
