"""
Decrypt a password-protected HGB (Haryana Gramin Bank) mPassbook PDF export.
The password is the account number, which is also the trailing numeric
segment of the filename, e.g.
HGB_mPassbook_1-5-2025_30-4-2026_82511900044623.pdf -> password 82511900044623.
"""
import os
import re
import sys

import pikepdf

FILENAME_PASSWORD_RE = re.compile(r'(\d{6,})\.pdf$')


def password_from_filename(path):
    m = FILENAME_PASSWORD_RE.search(os.path.basename(path))
    if not m:
        raise ValueError(f'Could not derive password from filename: {path}')
    return m.group(1)


def decrypt(input_pdf, output_pdf, password=None):
    password = password or password_from_filename(input_pdf)
    pdf = pikepdf.open(input_pdf, password=password)
    pdf.save(output_pdf)
    return output_pdf


if __name__ == '__main__':
    input_pdf = sys.argv[1]
    output_pdf = sys.argv[2]
    password = sys.argv[3] if len(sys.argv) > 3 else None
    decrypt(input_pdf, output_pdf, password)
    print(f'Decrypted -> {output_pdf}', file=sys.stderr)
