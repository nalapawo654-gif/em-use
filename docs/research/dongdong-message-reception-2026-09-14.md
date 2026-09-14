# 咚咚新消息接收验证

验证对象：本机 macOS 26.6.2、正在运行的咚咚 3.4.1。日期：2026-09-14。

## 当前结论

已验证外部进程可以使用本机咚咚自身的数据库派生逻辑，以只读模式打开当前账户的加密消息库，并捕获监听启动后的真实新消息。用户发送测试标记 `EMUSE-DD-0914` 后，两个独立只读观察器均捕获到两条匹配的新增文本记录，正文可读、发送人姓名关联成功。会话未读数字段也可关联读取。此结果证明本机咚咚运行期间的只读接收路线可行；尚未接入正式桌宠或验证 Windows。

## 已验证与待验证

| 层面 | 结果 |
| --- | --- |
| 运行环境 | 咚咚 3.4.1 主进程正在运行 |
| 本地监听接口 | 本次未发现主进程的 TCP 监听端口；不能据此断言所有子进程和接口都不存在 |
| 消息存储 | 当前账户目录的 `msg/msg.db` 为加密 SQLite；包含 `message`、`chat`、`user` |
| 解锁 | 从安装包读取其 WASM 的 `getDbEncryptionKey`，在内存中派生并使用本账户数据库密钥；成功执行真实数据库查询 |
| 只读约束 | 数据库句柄 `readonly=true`，连接 `PRAGMA query_only=1`；仅执行 SELECT / 只读元数据查询 |
| 数据可用性 | 真实文本记录正文存在、发送人姓名关联成功、会话未读数字段关联成功；输出仅为布尔结果 |
| 安装与登录配置 | 两秒探针及 84 秒真实接收探针前后 SHA-256 均一致；没有修改、注入或重启咚咚 |
| 新消息接收 | 通过。500ms 检查一次 `data_version`，只观察启动后的新增记录；用户确认已发送后核对，两条新增记录均匹配测试标记 |
| 桌宠显示 | 尚未接入正式桌宠；本次是独立只读验证 |
| Windows | 未进行 Windows 运行验证；不把 macOS 结果推广为跨平台通过 |

正式保留脚本的本次收尾结果（无正文和身份信息）：

```json
{"event":"done","arrivals":2,"testMarkerMatched":true,"durationMs":84181,"installationUnchanged":true,"loginConfigUnchanged":true}
```

两条记录的正文长度均为 13，发送人姓名均可关联，均非撤回状态。其中一条 `from_id` 与本账户目录 ID 相同，另一条不同；这里只记录比较结果，不据此断言已经覆盖私聊、群聊或文件传输助手的完整语义。时间戳算出的消息年龄约为 -2.1 / -1.7 秒，提示消息时间与本机时钟存在偏差，不能用它声称端到端延迟。探针已结束，没有留下持续读库进程。

## 复现工具

脚本：[dongdong-message-probe.cjs](../../rust-desktop/scripts/research/dongdong-message-probe.cjs)。依赖在临时目录独立安装，不改变产品依赖：本次为 `better-sqlite3-multiple-ciphers` 13.0.3，Node.js 24.18.0。

```bash
npm install --prefix /tmp/em-use-dd-message-runtime --no-audit --no-fund better-sqlite3-multiple-ciphers@13.0.3
node rust-desktop/scripts/research/dongdong-message-probe.cjs \
  --sqlite-module /tmp/em-use-dd-message-runtime/node_modules/better-sqlite3-multiple-ciphers \
  --seconds 180 --marker EMUSE-DD-0914
```

`ready` 后，由用户通过其他设备或同事发来测试消息；探针只输出消息类型、长度、年龄、发送人是否可关联、是否自身发送、是否命中测试标记。不会输出正文、姓名、会话 ID、账户 ID、密钥、票据或密码。`--seconds` 限制为 1–600 秒；Ctrl+C 可提前结束。多个账户目录时不猜测当前账户，需要明确指定本账户 `--db`。

验证脚本不发送网络请求，不发送聊天消息，不标记已读，不更改提醒设置，不执行写入 SQL。密钥仅在进程内使用，WASM 内存用后清零；JavaScript 字符串副本无法保证立即清除，正式产品应在原生层采用可清零缓冲区。

## 产品化边界

- 这是一条依赖咚咚本地存储格式的接入路线，尚未发现或验证官方第三方消息订阅 API。咚咚升级需要重新验证兼容性。
- 原型使用数据库新增 rowid 观察变化，旧记录更新、撤回、历史同步、库替换或迁移均不能直接当成新消息；正式实现要以消息 ID 去重，识别启动基线、消息时间与撤回状态，并跟随账户切换重建连接。
- 需遵守原会话的免打扰、已读和隐藏状态，合并连续提醒；实际通知行为还需逐项验收。
- 接收依赖咚咚把消息同步到本机；咚咚退出、断网等情况下不能承诺继续接收。
- 若接入 Rust/Tauri，应共享一个原生读取服务，验证兼容的加密 SQLite 实现，避免为每只宠物启动一个读库进程或捆绑 Node.js。
- 精确跳转聊天、私聊 / 群聊 / @我、附件、撤回与断线重连尚未验证。

## 补充依据

安装包中通知通过 Electron `Notification` 发出，未读 UI 通过 `webContents.send` 接收内部 IPC。它们不是现成的外部消息订阅接口，参见 [Electron IPC 文档](https://www.electronjs.org/docs/latest/tutorial/ipc)。macOS 的 [AXObserver](https://developer.apple.com/documentation/applicationservices/1460133-axobservercreate) 可观察辅助功能事件，但本次没有把辅助功能 UI 读取作为成功的消息接收路线。
