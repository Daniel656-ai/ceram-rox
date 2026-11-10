"""Run new RPCs only in a disposable local PostgreSQL cluster. Never uses PG* env credentials."""
import argparse
import pathlib
import subprocess
import tempfile
import os

parser = argparse.ArgumentParser()
parser.add_argument("--postgres-bin", required=True)
args = parser.parse_args()
root = pathlib.Path(__file__).resolve().parent.parent
stage = pathlib.Path(tempfile.mkdtemp(prefix="rox-equipment-", dir="/tmp"))
os.chmod(stage, 0o777)
data = stage / "data"
sock = stage / "socket"
sock.mkdir()
os.chmod(sock, 0o777)
binary = pathlib.Path(args.postgres_bin)
prefix = ["runuser", "-u", "nobody", "--"] if os.geteuid() == 0 else []
def run(command, **kwargs):
    return subprocess.run(command, check=True, text=True, **kwargs)
def psql(file):
    run([str(binary / "psql"), "-h", str(sock), "-p", "55432", "-U", "nobody", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-f", str(file)])
run(prefix + [str(binary / "initdb"), "-D", str(data), "-A", "trust"], stdout=subprocess.DEVNULL)
run(prefix + [str(binary / "pg_ctl"), "-D", str(data), "-l", str(stage / "postgres.log"), "-o", f"-p 55432 -k {sock}", "start"])
try:
    psql(root / "scripts/equipment-test-schema.sql")
    psql(root / "drizzle/migrations/0030_equipment_monitoring_phase1.sql")
    psql(root / "drizzle/migrations/0031_equipment_identity_and_isolation.sql")
    psql(root / "drizzle/migrations/0032_equipment_explicit_write_privileges.sql")
    psql(root / "scripts/test-equipment.sql")
finally:
    run(prefix + [str(binary / "pg_ctl"), "-D", str(data), "stop", "-m", "fast"])