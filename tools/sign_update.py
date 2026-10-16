"""Sign Luma update manifests with a publisher key protected by Windows DPAPI.

The encrypted key stays under .cache and is never included in release archives.
Run --init once on the publisher's Windows account; retain that account's
encrypted-key backup. Signing does not grant a Windows Authenticode certificate.
"""
import argparse
import ctypes
import hashlib
import json
import os
from pathlib import Path
import re
import struct
import unicodedata

ROOT = Path(__file__).resolve().parents[1]
KEY = ROOT / '.cache' / 'luma-update-signing.dpapi'
ENTROPY = b'Luma DPS publisher update signing v1'
MANIFEST_LIMIT = 16 * 1024
SIGNATURE_LIMIT = 2048
ARTIFACT_LIMIT = 64 * 1024 * 1024


def dpapi(data, protect):
    if os.name != 'nt':
        raise RuntimeError('Publisher signing requires this Windows account')
    class Blob(ctypes.Structure):
        _fields_ = [('size', ctypes.c_ulong), ('data', ctypes.POINTER(ctypes.c_ubyte))]
    def blob(value):
        buffer = (ctypes.c_ubyte * len(value)).from_buffer_copy(value)
        return Blob(len(value), buffer), buffer
    source, source_buffer = blob(data)
    entropy, entropy_buffer = blob(ENTROPY)
    output = Blob()
    api = ctypes.windll.crypt32.CryptProtectData if protect else ctypes.windll.crypt32.CryptUnprotectData
    api.argtypes = [ctypes.POINTER(Blob), ctypes.c_void_p, ctypes.POINTER(Blob), ctypes.c_void_p, ctypes.c_void_p, ctypes.c_ulong, ctypes.POINTER(Blob)]
    api.restype = ctypes.c_int
    if not api(ctypes.byref(source), None, ctypes.byref(entropy), None, None, 1, ctypes.byref(output)):
        raise ctypes.WinError()
    try:
        return ctypes.string_at(output.data, output.size)
    finally:
        ctypes.memset(output.data, 0, output.size)
        ctypes.windll.kernel32.LocalFree.argtypes = [ctypes.c_void_p]
        ctypes.windll.kernel32.LocalFree(output.data)


def public_blob(key):
    numbers = key.public_key().public_numbers()
    exponent = numbers.e.to_bytes((numbers.e.bit_length() + 7) // 8, 'big')
    modulus = numbers.n.to_bytes((numbers.n.bit_length() + 7) // 8, 'big')
    return struct.pack('<6I', 0x31415352, key.key_size, len(exponent), len(modulus), 0, 0) + exponent + modulus


def signature(key, message):
    from cryptography.hazmat.primitives import hashes
    from cryptography.hazmat.primitives.asymmetric import padding
    return key.sign(message, padding.PSS(mgf=padding.MGF1(hashes.SHA256()), salt_length=32), hashes.SHA256())


def read_trust_anchor(public_path=None):
    """Read the exact public constants, rejecting duplicate or mismatched keys."""
    source = (public_path or ROOT / 'src-tauri/src/update_key.rs').read_text(encoding='utf-8')
    blobs = re.findall(r'^\s*pub\s+const\s+PUBLIC_KEY_BLOB_HEX\s*:\s*&str\s*=\s*"([a-f0-9]+)"\s*;', source, re.MULTILINE)
    ids = re.findall(r'^\s*pub\s+const\s+KEY_ID\s*:\s*&str\s*=\s*"([a-f0-9]{64})"\s*;', source, re.MULTILINE)
    if len(blobs) != 1 or len(ids) != 1:
        raise ValueError('Exactly one publisher public key and key ID are required')
    public = bytes.fromhex(blobs[0])
    if len(public) != 411 or hashlib.sha256(public).hexdigest() != ids[0]:
        raise ValueError('Publisher trust anchor does not match its key ID')
    magic, bits, exponent_bytes, modulus_bytes, prime1_bytes, prime2_bytes = struct.unpack('<6I', public[:24])
    if (magic, bits, exponent_bytes, modulus_bytes, prime1_bytes, prime2_bytes) != (0x31415352, 3072, 3, 384, 0, 0):
        raise ValueError('Publisher key must be an RSA-3072 public blob')
    if int.from_bytes(public[24:27], 'big') != 65537 or int.from_bytes(public[27:], 'big').bit_length() != 3072:
        raise ValueError('Invalid publisher RSA public key')
    return public, ids[0]


def is_amd64_pe(binary):
    if len(binary) < 512 or binary[:2] != b'MZ':
        return False
    offset = int.from_bytes(binary[0x3c:0x40], 'little')
    return (0x40 <= offset <= len(binary) - 26
            and binary[offset:offset + 4] == b'PE\0\0'
            and binary[offset + 4:offset + 6] == b'\x64\x86'
            and binary[offset + 24:offset + 26] == b'\x0b\x02')


def read_bounded(path, maximum):
    with Path(path).open('rb') as stream:
        if os.fstat(stream.fileno()).st_size > maximum:
            raise ValueError('Update file exceeds its size limit')
        data = stream.read(maximum + 1)
    if len(data) > maximum:
        raise ValueError('Update file exceeds its size limit')
    return data


def truncate_notes(notes):
    # Rust measures UTF-8 bytes. Removing an incomplete final code point keeps
    # Turkish and other non-ASCII notes valid at the same 6000-byte boundary.
    notes = ''.join(character for character in notes if unicodedata.category(character) != 'Cc' or character in '\n\r\t')
    return notes.encode('utf-8')[:6000].decode('utf-8', errors='ignore')


def strict_json(data):
    def pairs(values):
        result = {}
        for name, value in values:
            if name in result:
                raise ValueError('Duplicate update metadata field')
            result[name] = value
        return result
    def invalid_constant(_value):
        raise ValueError('Non-JSON update metadata constant')
    return json.loads(data.decode('utf-8'), object_pairs_hook=pairs, parse_constant=invalid_constant)


def verify_update(manifest_path, signature_path, exe_path, public_path=None):
    """Verify public release files without reading or decrypting a private key."""
    from cryptography.exceptions import InvalidSignature
    from cryptography.hazmat.primitives import hashes
    from cryptography.hazmat.primitives.asymmetric import padding, rsa
    public, key_id = read_trust_anchor(public_path)
    message = read_bounded(manifest_path, MANIFEST_LIMIT)
    signed = strict_json(read_bounded(signature_path, SIGNATURE_LIMIT))
    if (not isinstance(signed, dict)
            or set(signed) != {'schema_version', 'algorithm', 'key_id', 'signature'}
            or type(signed['schema_version']) is not int or signed['schema_version'] != 1
            or signed['algorithm'] != 'rsa-pss-sha256' or signed['key_id'] != key_id
            or not isinstance(signed['signature'], str) or not re.fullmatch('[a-f0-9]{768}', signed['signature'])):
        raise ValueError('Update publisher signature is not trusted')
    key = rsa.RSAPublicNumbers(65537, int.from_bytes(public[27:], 'big')).public_key()
    try:
        key.verify(bytes.fromhex(signed['signature']), message,
                   padding.PSS(mgf=padding.MGF1(hashes.SHA256()), salt_length=32), hashes.SHA256())
    except InvalidSignature as error:
        raise ValueError('Update publisher signature did not verify') from error
    manifest = strict_json(message)
    if not isinstance(manifest, dict) or set(manifest) != {'schema_version', 'version', 'target', 'artifact', 'artifact_sha256', 'artifact_bytes', 'commit', 'notes'}:
        raise ValueError('Invalid signed update manifest')
    version = manifest['version']
    if (type(manifest['schema_version']) is not int or manifest['schema_version'] != 1
            or not isinstance(version, str) or not re.fullmatch(r'(0|[1-9][0-9]{0,8})\.(0|[1-9][0-9]{0,8})\.(0|[1-9][0-9]{0,8})', version)
            or manifest['target'] != 'windows-x64' or manifest['artifact'] != f'Luma-DPS-{version}.exe'
            or type(manifest['artifact_bytes']) is not int or not 512 <= manifest['artifact_bytes'] <= ARTIFACT_LIMIT
            or not isinstance(manifest['artifact_sha256'], str) or not re.fullmatch('[a-f0-9]{64}', manifest['artifact_sha256'])
            or not isinstance(manifest['commit'], str) or not re.fullmatch('[a-f0-9]{40}', manifest['commit'])
            or not isinstance(manifest['notes'], str) or len(manifest['notes'].encode('utf-8')) > 6000
            or any(unicodedata.category(character) == 'Cc' and character not in '\n\r\t' for character in manifest['notes'])):
        raise ValueError('Invalid signed update manifest')
    binary = read_bounded(exe_path, ARTIFACT_LIMIT)
    if len(binary) != manifest['artifact_bytes'] or hashlib.sha256(binary).hexdigest() != manifest['artifact_sha256']:
        raise ValueError('Executable does not match the signed update checksum')
    if not is_amd64_pe(binary):
        raise ValueError('Update executable must be Windows AMD64 PE32+')
    return manifest


def initialize():
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric import rsa
    public_path = ROOT / 'src-tauri/src/update_key.rs'
    if KEY.exists() or public_path.exists():
        raise RuntimeError('A publisher key already exists; refusing to replace update trust')
    key = rsa.generate_private_key(public_exponent=65537, key_size=3072)
    encoded = key.private_bytes(serialization.Encoding.DER, serialization.PrivateFormat.PKCS8, serialization.NoEncryption())
    KEY.parent.mkdir(exist_ok=True)
    with KEY.open('xb') as stream:
        stream.write(dpapi(encoded, True))
    public = public_blob(key)
    public_path.write_bytes(('// Public publisher verification key. The private key is not distributed.\n'
        f'pub const PUBLIC_KEY_BLOB_HEX: &str = "{public.hex()}";\n'
        f'pub const KEY_ID: &str = "{hashlib.sha256(public).hexdigest()}";\n').encode())
    # An unrelated disposable key signs public test vectors. No production-key
    # signature or executable test payload is distributed as a future update.
    test_key = rsa.generate_private_key(public_exponent=65537, key_size=3072)
    message = b'{"schema_version":1,"version":"0.16.1","target":"windows-x64","artifact":"Luma-DPS-0.16.1.exe","artifact_sha256":"' + b'0' * 64 + b'","artifact_bytes":4096,"commit":"' + b'1' * 40 + b'","notes":"Test vector"}'
    vectors = '// Public test vectors use an unrelated disposable key.\n'
    vectors += f'pub const PUBLIC_KEY_BLOB_HEX: &str = "{public_blob(test_key).hex()}";\n'
    vectors += 'pub const MANIFEST: &[u8] = br#"' + message.decode() + '"#;\n'
    vectors += f'pub const SIGNATURE_HEX: &str = "{signature(test_key, message).hex()}";\n'
    (ROOT / 'src-tauri/src/update_test_vectors.rs').write_bytes(vectors.encode())
    print('Publisher update trust initialized; key ID:', hashlib.sha256(public).hexdigest())


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--init', action='store_true')
    mode.add_argument('--verify', action='store_true', help='Verify public release assets without loading a private key')
    parser.add_argument('--version')
    parser.add_argument('--exe', type=Path)
    parser.add_argument('--commit')
    parser.add_argument('--notes-file', type=Path)
    parser.add_argument('--out-dir', type=Path, default=ROOT / 'release')
    parser.add_argument('--manifest', type=Path)
    parser.add_argument('--signature', type=Path)
    args = parser.parse_args(argv)
    if args.init:
        initialize()
        return
    if args.verify:
        if not args.manifest or not args.signature or not args.exe:
            parser.error('--verify requires --manifest, --signature and --exe')
        verified = verify_update(args.manifest, args.signature, args.exe)
        print('Verified signed update:', verified['version'], verified['artifact_sha256'])
        return
    if not re.fullmatch(r'(0|[1-9][0-9]{0,4})\.(0|[1-9][0-9]{0,4})\.(0|[1-9][0-9]{0,4})', args.version or '') or not re.fullmatch(r'[a-f0-9]{40}', args.commit or ''):
        parser.error('A release version and exact lowercase commit SHA are required')
    if not args.exe or not args.exe.is_file():
        parser.error('A built Windows executable is required')
    from cryptography.hazmat.primitives import serialization
    trusted, key_id = read_trust_anchor()
    key = serialization.load_der_private_key(dpapi(KEY.read_bytes(), False), password=None)
    public = public_blob(key)
    if public != trusted or hashlib.sha256(public).hexdigest() != key_id:
        raise RuntimeError('Publisher key does not match the application trust anchor')
    binary = read_bounded(args.exe, ARTIFACT_LIMIT)
    if not is_amd64_pe(binary):
        raise ValueError('Invalid update executable')
    notes = truncate_notes(args.notes_file.read_text(encoding='utf-8-sig')) if args.notes_file else ''
    manifest = {'schema_version': 1, 'version': args.version, 'target': 'windows-x64', 'artifact': f'Luma-DPS-{args.version}.exe',
        'artifact_sha256': hashlib.sha256(binary).hexdigest(), 'artifact_bytes': len(binary), 'commit': args.commit, 'notes': notes}
    message = json.dumps(manifest, ensure_ascii=False, separators=(',', ':')).encode()
    signed = {'schema_version': 1, 'algorithm': 'rsa-pss-sha256', 'key_id': hashlib.sha256(public).hexdigest(), 'signature': signature(key, message).hex()}
    args.out_dir.mkdir(parents=True, exist_ok=True)
    (args.out_dir / 'luma-update.json').write_bytes(message)
    (args.out_dir / 'luma-update.sig').write_bytes(json.dumps(signed, separators=(',', ':')).encode())
    verify_update(args.out_dir / 'luma-update.json', args.out_dir / 'luma-update.sig', args.exe)
    print('Signed update manifest:', args.version, manifest['artifact_sha256'])


if __name__ == '__main__':
    main()
