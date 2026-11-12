"""Migration replay and rollback checks use synthetic task identities."""
import importlib.util
from pathlib import Path
import sqlite3
import tempfile
import unittest
from contextlib import closing

spec = importlib.util.spec_from_file_location('migration', Path(__file__).with_name('import-speed.py'))
migration = importlib.util.module_from_spec(spec)
spec.loader.exec_module(migration)


class SpeedImport(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temporary = Path(__file__).resolve().parents[1]/'.wrangler'/'import-tests'
        cls.temporary.mkdir(parents=True, exist_ok=True)

    def test_replay_preserves_maximum_and_identity_conflict_rolls_back(self):
        with tempfile.TemporaryDirectory(dir=self.temporary) as directory:
            root = Path(directory)
            target, source = root/'storage.sqlite', root/'private.sql'
            task = '12345678-1234-4123-8123-123456789012'
            with closing(sqlite3.connect(target)) as db:
                db.execute(migration.SCHEMA)
                db.execute('INSERT INTO speed_runs VALUES (?,?,?,?,?,?,?)', (task, 'a'*64, 100, 20, 1, 4, 0))
                db.commit()
            source.write_text(migration.SCHEMA + "; INSERT INTO speed_runs VALUES ('"+task+"','"+'a'*64+"',50,30,2,5,1);", encoding='utf-8')
            first = migration.merge(source, target)
            second = migration.merge(source, target)
            self.assertEqual((first['bytes'], first['sessions'], second['storedRows']), (100, 1, 1))
            source.write_text(source.read_text(encoding='utf-8').replace('a'*64, 'b'*64), encoding='utf-8')
            with self.assertRaisesRegex(ValueError, 'identity conflict'):
                migration.merge(source, target)
            with closing(sqlite3.connect(target)) as db:
                self.assertEqual(db.execute('SELECT bytes,duration_ms,created_at,finished FROM speed_runs').fetchone(), (100, 30, 1, 1))

    def test_export_cannot_attach_another_database(self):
        with tempfile.TemporaryDirectory(dir=self.temporary) as directory:
            source = Path(directory)/'bad.sql'
            source.write_text("ATTACH DATABASE 'outside.sqlite' AS outside;", encoding='utf-8')
            with self.assertRaises(sqlite3.DatabaseError):
                migration.load_export(source)


if __name__ == '__main__':
    unittest.main()
