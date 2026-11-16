#!/usr/bin/env node
'use strict';

// Passwords are read from an ignored local file and sent through child environments,
// never through command-line arguments or console output. No new keys are generated.
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const {X509Certificate} = require('node:crypto');
const ROOT = path.resolve(__dirname, '..');
const CERT_SHA256 = 'b08fc9b85314e227d8d97779db460830a7acfeac58e2e3c88fcde9c64ea5827f';

function loadConfig(root = ROOT) {
  const file = path.join(root, '.private', 'signing.json');
  const keystore = path.join(root, 'android', 'keystore.jks');
  if (!fs.existsSync(file) || !fs.existsSync(keystore)) {
    throw new Error('缺少原签名文件或 .private/signing.json。请按 docs/signing-backup.md 恢复私人备份；不会生成新密钥。');
  }
  let config;
  try { config = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')); }
  catch (_) { throw new Error('本机签名配置无法读取，请核对 JSON 格式。'); }
  for (const key of ['keyAlias', 'storePassword', 'keyPassword']) {
    if (typeof config?.[key] !== 'string' || !config[key] || /[\r\n\0]/.test(config[key]) || config[key].startsWith('REPLACE_WITH_')) {
      throw new Error('本机签名配置不完整，请恢复真实私有配置。');
    }
  }
  const suffix = process.platform === 'win32' ? '.exe' : '';
  return {...config, file, keystore,
    java: path.join(root, 'build/toolchain/jdk/bin/java' + suffix),
    keytool: path.join(root, 'build/toolchain/jdk/bin/keytool' + suffix),
    signer: path.join(root, 'build/toolchain/android-sdk/build-tools/34.0.0/lib/apksigner.jar')};
}

function run(executable, args, config) {
  const result = spawnSync(executable, args, {
    encoding: 'utf8', windowsHide: true, timeout: 120000, maxBuffer: 4 * 1024 * 1024,
    env: {...process.env, REMEMBER_STORE_PASSWORD: config.storePassword, REMEMBER_KEY_PASSWORD: config.keyPassword}
  });
  // Do not echo tool diagnostics: they may contain configuration or credentials.
  if (result.error || result.status !== 0) throw new Error('签名工具验证失败。请核对原密钥、密码、别名及 JDK／Android 工具链。');
  return result.stdout;
}

function checkSigning(root = ROOT) {
  const config = loadConfig(root);
  const pem = run(config.keytool, ['-exportcert', '-rfc', '-keystore', config.keystore,
    '-alias', config.keyAlias, '-storepass:env', 'REMEMBER_STORE_PASSWORD'], config);
  let fingerprint;
  try { fingerprint = new X509Certificate(pem).fingerprint256.replaceAll(':', '').toLowerCase(); }
  catch (_) { throw new Error('无法读取签名证书。'); }
  if (fingerprint !== CERT_SHA256) throw new Error('签名证书与已发布应用不一致，已停止构建。请恢复原签名备份。');
  return config;
}

function verifyApk(apk, config) {
  const output = run(config.java, ['-jar', config.signer, 'verify', '--print-certs', apk], config);
  const fingerprints = [...output.matchAll(/certificate SHA-256 digest:\s*([a-f0-9]+)/gi)].map(m => m[1].toLowerCase());
  if (fingerprints.length !== 1 || fingerprints[0] !== CERT_SHA256) throw new Error('安装包证书验证失败，不能发布。');
}

function signApk(input, output, root = ROOT) {
  const config = checkSigning(root);
  input = path.resolve(input); output = path.resolve(output);
  if (input === output || path.extname(output).toLowerCase() !== '.apk') throw new Error('签名输出必须是另一个 APK 文件。');
  run(config.java, ['-jar', config.signer, 'sign', '--v1-signing-enabled', 'true',
    '--v2-signing-enabled', 'true', '--v3-signing-enabled', 'true',
    '--ks', config.keystore, '--ks-key-alias', config.keyAlias,
    '--ks-pass', 'env:REMEMBER_STORE_PASSWORD', '--key-pass', 'env:REMEMBER_KEY_PASSWORD',
    '--out', output, input], config);
  verifyApk(output, config);
}

if (require.main === module) {
  try {
    const [command, input, output, ...extra] = process.argv.slice(2);
    if (command === 'check' && !input) checkSigning();
    else if (command === 'sign' && input && output && !extra.length) signApk(input, output);
    else throw new Error('用法：node tools/sign-apk.js check | sign 输入.apk 输出.apk');
    console.log('签名验证通过，证书与已发布版本一致：' + CERT_SHA256);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}

module.exports = {loadConfig, checkSigning, signApk, CERT_SHA256};
