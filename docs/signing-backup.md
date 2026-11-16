# 私有签名配置与加密备份

签名由原 `android/keystore.jks` 和本机 `.private/signing.json` 提供；两者均被Git忽略。示例格式见 `android/signing.example.json`，其中只有占位文字，不能直接用于发布。真实密码不得填进示例或其他跟踪文件。

## 本次迁移

2026-11-16将脚本中的固定密码移出仓库，并为当前密钥容器和私钥更换保护密码。保留原私钥、别名及证书，签名身份没有更换。Git历史仍保留旧脚本；当前密钥文件已验证不能使用旧密码打开，不通过强推破坏已有发布记录。

`tools/sign-apk.js` 读取私有JSON，仅通过子进程环境变量向keytool与apksigner传递密码，不把密码拼进命令行或输出工具诊断。构建开始时核对原证书，缺少文件、密码不正确或证书不一致时停止，不再自动生成新密钥。使用的环境参数来自 [keytool 文档](https://docs.oracle.com/en/java/javase/17/docs/specs/man/keytool.html) 与 [apksigner 文档](https://developer.android.com/tools/apksigner)。

原证书SHA-256：

```text
b08fc9b85314e227d8d97779db460830a7acfeac58e2e3c88fcde9c64ea5827f
```

仅检查签名环境：

```bash
bash tools/build-apk.sh --check-signing
```

## 备份中分别是什么

- `签名密钥与私有配置.zip.gpg`：当前密钥、对应密码配置及证书指纹，整体加密。恢复日常发布能力使用这个文件。
- `签名-迁移前回退.zip.gpg`：本次修改前的独立加密回退副本，仅在处理迁移事故时核对使用，正常换机优先恢复当前备份。
- 备份解锁口令：单独随机生成，与签名密码不同，保存在使用者的C盘私人目录；应另存到本人密码管理器。它不放在D盘备份包里，也不上传GitHub。
- 源码ZIP、Git历史bundle、工具链ZIP、已发布APK与维护说明可以随备份目录迁移，不包含当前明文签名配置或Git登录令牌。

加密包采用GnuPG的AES-256对称加密、SHA-256口令派生、S2K计数参数65011712和完整性校验；解密必须成功通过校验才会读取里面的ZIP。口令通过标准输入传入GPG，使用独立临时GPG目录并禁用对称口令缓存；参见 [GnuPG 口令选项](https://www.gnupg.org/documentation/manuals/gnupg/GPG-Esoteric-Options.html)。口令文件与私有配置目录在Windows上仅授予当前用户和SYSTEM访问。

本地路径和每份备份的校验值只写在对应备份目录中，不把个人口令或具体私人路径记进本公开文档。备份是创建时的快照，后续更改密钥、配置或源码后应更新备份。

## 新电脑恢复

1. 带走整个备份目录，并确认密码管理器中已有对应的备份解锁口令。只有密文或只有口令都不足以恢复。
2. 安装Git for Windows、Python 3.10或更新版，以及Node.js；备份中也提供了可用的 `node.exe`。不要执行不明来源的“密钥修复工具”。
3. 克隆GitHub仓库，或者用备份中的Git历史bundle离线克隆。使用bundle时显式选择main，再把origin改回原GitHub地址；新电脑需自行完成GitHub登录授权。

   ```bash
   git clone -b main "项目历史.bundle" remember
   cd remember
   git remote set-url origin https://github.com/Dear2You/remember.git
   ```

4. 将 `构建工具链.zip` 解压到项目根目录，使JDK和Android SDK位于 `build/toolchain/`。源码ZIP也可用于查看代码，但没有Git历史；继续发布建议用上述克隆方式。
5. 在项目根目录运行下面命令，将路径替换成实际位置；在本机终端输入备份口令，输入过程不显示。也可通过 `--passphrase-file` 指向单独保存的私人文件，不要把真实口令直接作为命令行参数。

   ```bash
   python tools/restore-signing.py "备份目录/签名密钥与私有配置.zip.gpg" "."
   bash tools/build-apk.sh --check-signing
   ```

6. 恢复工具先验证密文、文件列表和真实证书，再写入原密钥与 `.private/signing.json`。已有任一签名文件或配置时会停止，不覆盖现有内容；可在全新项目副本中演练。原证书核对通过后，按 [维护与发布流程](maintenance.md) 开发新版本。

## 已完成的验证

- 改密码前后证书指纹一致，当前密钥拒绝旧密码。
- 两份加密备份均可用正确口令完整解密；错误口令被拒绝。
- 当前备份在独立项目副本中恢复成功，密钥字节、私有配置字段均与当前文件一致。
- 恢复后的密钥实际签名APK并通过apksigner验证，证书与已发布v2.34相同。
- 篡改密文、错误备份口令、错误签名密码、缺少配置和覆盖既有签名文件均被拒绝；恢复校验失败不写入签名文件。
- 本次只修改构建和备份工具，未替换公开发布的v2.34 APK，也未更换应用签名身份。
