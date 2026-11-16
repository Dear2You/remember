#!/usr/bin/env python3
"""Restore the authenticated GPG signing backup without exposing its passwords."""
from pathlib import Path
import argparse
import getpass
import hashlib
import io
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import zipfile

CERT_SHA256 = 'b08fc9b85314e227d8d97779db460830a7acfeac58e2e3c88fcde9c64ea5827f'
ENTRIES = {'android/keystore.jks', '.private/signing.json', 'SIGNING-CERT-SHA256.txt'}

class RestoreError(Exception):
    pass


def invoke(args, **kwargs):
    return subprocess.run([str(x) for x in args], capture_output=True, timeout=120,
                          creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0, **kwargs)


def private_directory(directory):
    if directory.is_symlink() or (hasattr(directory, 'is_junction') and directory.is_junction()):
        raise RestoreError('私有目录不能是链接。')
    directory.mkdir(parents=True, exist_ok=True)
    if os.name == 'nt':
        # Literal PowerShell quoting is intentional; no credentials are interpolated.
        literal = str(directory).replace("'", "''")
        script = "$ErrorActionPreference='Stop';$p='" + literal + "';$sid=[Security.Principal.WindowsIdentity]::GetCurrent().User;" \
            "$acl=New-Object Security.AccessControl.DirectorySecurity;" \
            "$acl.SetOwner($sid);$acl.SetAccessRuleProtection($true,$false);" \
            "foreach($id in @($sid.Value,'S-1-5-18')){" \
            "$who=New-Object Security.Principal.SecurityIdentifier($id);" \
            "$rule=New-Object Security.AccessControl.FileSystemAccessRule($who,'FullControl','ContainerInherit,ObjectInherit','None','Allow');" \
            "$acl.AddAccessRule($rule)};[IO.Directory]::SetAccessControl($p,$acl)"
        result = invoke(['powershell.exe', '-NoProfile', '-NonInteractive', '-Command', script])
        if result.returncode:
            raise RestoreError('无法设置私有目录权限，未解密备份。')
    else:
        directory.chmod(0o700)


def gpg_path(executable, value):
    result = Path(value).resolve().as_posix()
    if os.name == 'nt' and '/git/usr/bin/' in executable.as_posix().lower() and result[1:2] == ':':
        return '/' + result[0].lower() + result[2:]
    return result


def restore(archive, project, phrase_file=None, gpg=None):
    archive, project = archive.resolve(), project.resolve()
    if not (project/'app/index.html').is_file() or not (project/'tools/sign-apk.js').is_file():
        raise RestoreError('目标应为已解压源码或克隆好的 remember 项目目录。')
    key, config_file = project/'android/keystore.jks', project/'.private/signing.json'
    if not key.parent.resolve().is_relative_to(project):
        raise RestoreError('签名目标目录不能指向项目外部。')
    if key.exists() or config_file.exists():
        raise RestoreError('目标已有签名文件或私有配置；不会覆盖，请在全新项目副本中恢复。')
    suffix = '.exe' if os.name == 'nt' else ''
    keytool = project/('build/toolchain/jdk/bin/keytool' + suffix)
    if not keytool.is_file():
        raise RestoreError('请先将构建工具链恢复到项目的 build/toolchain，再恢复签名。')
    if not archive.is_file() or archive.stat().st_size > 2 * 1024 * 1024:
        raise RestoreError('签名备份不存在或大小不符合预期。')
    candidates = [gpg, shutil.which('gpg'), 'C:/Program Files/Git/usr/bin/gpg.exe', 'C:/Program Files (x86)/GnuPG/bin/gpg.exe']
    executable = next((Path(x).resolve() for x in candidates if x and Path(x).is_file()), None)
    if not executable:
        raise RestoreError('请安装 Git for Windows 或 GnuPG；也可用 --gpg 指定 gpg 程序。')
    if phrase_file:
        phrase = phrase_file.read_text(encoding='utf-8-sig').rstrip('\r\n')
    else:
        if not sys.stdin.isatty():
            raise RestoreError('请在本机终端隐藏输入口令，或使用 --passphrase-file 指定私人口令文件。')
        phrase = getpass.getpass('备份解锁口令（输入不显示）：')
    if not phrase or any(x in phrase for x in '\r\n\0'):
        raise RestoreError('备份口令格式无效。')

    private = project/'.private'
    private_directory(private)
    work = Path(tempfile.mkdtemp(prefix='restore-', dir=private)).resolve()
    if not work.is_relative_to(private.resolve()):
        raise RestoreError('恢复暂存路径不安全。')
    try:
        home = work/'gpg'; home.mkdir()
        result = invoke([executable, '--no-options', '--homedir', gpg_path(executable, home),
            '--batch', '--yes', '--pinentry-mode', 'loopback', '--passphrase-fd', '0',
            '--no-symkey-cache', '--decrypt', gpg_path(executable, archive)], input=(phrase+'\n').encode('utf-8'))
        if result.returncode:
            raise RestoreError('解密未通过验证：口令不正确或备份损坏。没有写入签名文件。')
        with zipfile.ZipFile(io.BytesIO(result.stdout)) as bundle:
            entries = bundle.infolist()
            if len(entries) != len(ENTRIES) or {item.filename for item in entries} != ENTRIES:
                raise RestoreError('备份内容不符合签名恢复格式。')
            if any(item.file_size > 1024 * 1024 for item in entries):
                raise RestoreError('签名备份内容超出大小限制。')
            if bundle.read('SIGNING-CERT-SHA256.txt').decode().strip() != CERT_SHA256:
                raise RestoreError('备份声明的证书与本应用不一致。')
            config_bytes = bundle.read('.private/signing.json')
            config = json.loads(config_bytes)
            for field in ['keyAlias', 'storePassword', 'keyPassword']:
                if not isinstance(config.get(field), str) or not config[field] or re.search(r'[\r\n\0]', config[field]):
                    raise RestoreError('备份内私有配置无效。')
            staged_key = work/'keystore.jks'
            staged_key.write_bytes(bundle.read('android/keystore.jks'))
        env = {**os.environ, 'REMEMBER_RESTORE_PASSWORD': config['storePassword']}
        result = invoke([keytool, '-exportcert', '-keystore', staged_key, '-alias', config['keyAlias'],
                         '-storepass:env', 'REMEMBER_RESTORE_PASSWORD'], env=env)
        if result.returncode or hashlib.sha256(result.stdout).hexdigest() != CERT_SHA256:
            raise RestoreError('恢复出的密钥无法通过原发布证书核验。没有替换现有文件。')
        staged_config = work/'signing.json'
        staged_config.write_bytes(config_bytes)
        staged_key.chmod(0o600); staged_config.chmod(0o600)
        # Targets were checked absent; use exclusive creation to avoid overwriting a concurrent restore.
        for staged, target in [(staged_key, key), (staged_config, config_file)]:
            if target.exists():
                raise RestoreError('恢复期间目标文件出现，已停止，未覆盖已有文件。')
        # Hard-link creation fails if a target appears concurrently and retains the private ACL.
        os.link(staged_config, config_file)
        try:
            os.link(staged_key, key)
        except Exception:
            config_file.unlink()
            raise
        print('已恢复原签名文件与私有配置；证书校验通过：'+CERT_SHA256)
    finally:
        # Only our newly-created private child directory may be recursively removed.
        if work.is_relative_to(private.resolve()) and work.resolve() == work and not work.is_symlink():
            shutil.rmtree(work, ignore_errors=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='从加密备份恢复原签名，口令不会进入命令行。')
    parser.add_argument('archive', type=Path)
    parser.add_argument('project', type=Path)
    parser.add_argument('--passphrase-file', type=Path)
    parser.add_argument('--gpg')
    args = parser.parse_args()
    try:
        restore(args.archive, args.project, args.passphrase_file, args.gpg)
    except Exception as error:
        # Show only our known validation messages; never print tool output or secret-bearing payloads.
        message = str(error) if isinstance(error, RestoreError) else '恢复失败，未显示私有内容。请检查路径、工具和备份完整性。'
        print(message, file=sys.stderr)
        sys.exit(1)
