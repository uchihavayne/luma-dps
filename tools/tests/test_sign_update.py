"""Publisher update authentication tests. All signing keys here are disposable."""
import contextlib
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest import mock

try:
    from cryptography.hazmat.primitives.asymmetric import rsa
except ImportError:
    rsa = None

SPEC = importlib.util.spec_from_file_location('luma_sign_update', Path(__file__).resolve().parents[1] / 'sign_update.py')
signer = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(signer)


def pe_bytes():
    binary = bytearray(512)
    binary[:2] = b'MZ'
    binary[0x3c:0x40] = (128).to_bytes(4, 'little')
    binary[128:132] = b'PE\0\0'
    binary[132:134] = b'\x64\x86'
    binary[152:154] = b'\x0b\x02'
    return bytes(binary)


@unittest.skipUnless(rsa is not None, 'Optional publisher tooling requires cryptography')
class SigningTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.disposable_key = rsa.generate_private_key(public_exponent=65537, key_size=3072)

    def setUp(self):
        scratch = Path(__file__).resolve().parents[2] / '.cache'
        scratch.mkdir(exist_ok=True)
        self.temporary = tempfile.TemporaryDirectory(prefix='luma-update-test-', dir=scratch)
        self.addCleanup(self.temporary.cleanup)
        self.directory = Path(self.temporary.name)
        self.public_path = self.directory / 'src-tauri/src/update_key.rs'
        self.public_path.parent.mkdir(parents=True)
        self.public = signer.public_blob(self.disposable_key)
        self.key_id = hashlib.sha256(self.public).hexdigest()
        self.public_source = (f'pub const PUBLIC_KEY_BLOB_HEX: &str = "{self.public.hex()}";\n'
                              f'pub const KEY_ID: &str = "{self.key_id}";\n')
        self.public_path.write_text(self.public_source, encoding='utf-8')
        self.exe = self.directory / 'Luma-DPS-0.16.1.exe'
        self.exe.write_bytes(pe_bytes())
        self.manifest_path = self.directory / 'luma-update.json'
        self.signature_path = self.directory / 'luma-update.sig'
        self.manifest = {'schema_version': 1, 'version': '0.16.1', 'target': 'windows-x64',
                         'artifact': self.exe.name, 'artifact_sha256': hashlib.sha256(pe_bytes()).hexdigest(),
                         'artifact_bytes': 512, 'commit': '1' * 40, 'notes': 'Doğrulanmış test sürümü'}
        self.write_signed()

    def write_signed(self):
        message = json.dumps(self.manifest, ensure_ascii=False, separators=(',', ':')).encode()
        self.manifest_path.write_bytes(message)
        self.signature_path.write_text(json.dumps({'schema_version': 1, 'algorithm': 'rsa-pss-sha256',
                                                   'key_id': self.key_id,
                                                   'signature': signer.signature(self.disposable_key, message).hex()}), encoding='utf-8')

    def verify(self):
        return signer.verify_update(self.manifest_path, self.signature_path, self.exe, self.public_path)

    def test_signed_bytes_verify_and_even_whitespace_tampering_fails(self):
        self.assertEqual(self.verify()['version'], '0.16.1')
        self.manifest_path.write_bytes(self.manifest_path.read_bytes() + b' ')
        with self.assertRaisesRegex(ValueError, 'signature did not verify'):
            self.verify()

    def test_modified_executable_is_rejected_after_valid_signature(self):
        binary = bytearray(pe_bytes())
        binary[-1] = 1
        self.exe.write_bytes(binary)
        with self.assertRaisesRegex(ValueError, 'checksum'):
            self.verify()

    def test_signed_x86_or_pe32_payload_is_not_accepted_as_windows_x64(self):
        for offset, replacement in [(132, b'\x4c\x01'), (152, b'\x0b\x01')]:
            with self.subTest(offset=offset):
                binary = bytearray(pe_bytes())
                binary[offset:offset + 2] = replacement
                self.exe.write_bytes(binary)
                self.manifest['artifact_sha256'] = hashlib.sha256(binary).hexdigest()
                self.write_signed()
                with self.assertRaisesRegex(ValueError, 'AMD64 PE32'):
                    self.verify()
        self.assertFalse(signer.is_amd64_pe(b'MZ' + bytes(510)))

    @unittest.skipUnless(os.name == 'nt', 'A native Windows executable is required')
    def test_real_windows_python_executable_is_recognized(self):
        self.assertTrue(signer.is_amd64_pe(Path(sys.executable).read_bytes()))

    def test_exact_trust_constants_reject_duplicate_or_mismatched_key_id(self):
        self.public_path.write_text(self.public_source + self.public_source, encoding='utf-8')
        with self.assertRaisesRegex(ValueError, 'Exactly one'):
            self.verify()
        self.public_path.write_text(self.public_source.replace(self.key_id, '0' * 64), encoding='utf-8')
        with self.assertRaisesRegex(ValueError, 'key ID'):
            self.verify()

    def test_wrong_signature_and_duplicate_json_fields_are_rejected(self):
        signed = json.loads(self.signature_path.read_text())
        signed['signature'] = '0' * 768
        self.signature_path.write_text(json.dumps(signed))
        with self.assertRaisesRegex(ValueError, 'signature did not verify'):
            self.verify()
        self.write_signed()
        data = self.signature_path.read_text().rstrip()
        self.signature_path.write_text(data[:-1] + ',"schema_version":1}')
        with self.assertRaisesRegex(ValueError, 'Duplicate'):
            self.verify()
        with self.assertRaises(ValueError):
            signer.strict_json(b'{"unexpected":NaN}')
        with self.assertRaises(ValueError):
            signer.strict_json('{"schema_version":1}'.encode('utf-16'))

    def test_unicode_notes_share_rust_utf8_bound_and_control_filter(self):
        notes = signer.truncate_notes('\x7f\x80ş\n' * 3000)
        self.assertLessEqual(len(notes.encode('utf-8')), 6000)
        self.assertNotIn('\x7f', notes)
        self.assertNotIn('\x80', notes)
        self.manifest['notes'] = notes
        self.write_signed()
        self.assertEqual(self.verify()['notes'], notes)
        self.manifest['notes'] = 'ş' * 3001
        self.write_signed()
        with self.assertRaisesRegex(ValueError, 'Invalid signed'):
            self.verify()

    def test_manifest_traversal_and_oversized_metadata_are_rejected(self):
        self.manifest['artifact'] = '../Luma-DPS-0.16.1.exe'
        self.write_signed()
        with self.assertRaisesRegex(ValueError, 'Invalid signed'):
            self.verify()
        self.manifest_path.write_bytes(b' ' * (signer.MANIFEST_LIMIT + 1))
        with self.assertRaisesRegex(ValueError, 'size limit'):
            self.verify()

    def test_verify_cli_never_reads_or_decrypts_a_private_key(self):
        forbidden = mock.Mock()
        forbidden.read_bytes.side_effect = AssertionError('Private key must not be read')
        output = io.StringIO()
        with mock.patch.object(signer, 'ROOT', self.directory), mock.patch.object(signer, 'KEY', forbidden), \
                mock.patch.object(signer, 'dpapi', side_effect=AssertionError('DPAPI must not be called')), \
                contextlib.redirect_stdout(output):
            signer.main(['--verify', '--manifest', str(self.manifest_path),
                         '--signature', str(self.signature_path), '--exe', str(self.exe)])
        forbidden.read_bytes.assert_not_called()
        self.assertIn('Verified signed update: 0.16.1', output.getvalue())


if __name__ == '__main__':
    unittest.main()
