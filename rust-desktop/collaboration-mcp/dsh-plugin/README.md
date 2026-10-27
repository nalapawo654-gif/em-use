# em-use-collab-dsh-plugin

把 [`em-use-collab-mcp`](../README.md)(EM Use 协作服务的 MCP 适配,
[collaboration-mcp](../)crate 的一个产出)注册成 DeepSeek Harness 的一个真实
MCP 工具源,让 DSH 本身可以用原生工具调用去绑定/读房间/领任务/执行/提交成果——
对应设计文档 [agent-collaboration-v1-design.md](../../docs/agent-collaboration-v1-design.md)
第 11.1 节「阶段 D：至少一个真实 Agent 执行」里选的第一个适配器。

## 这是什么、为什么需要这一层

DSH 没有「设置里加一个 MCP 服务器」的界面(侧栏「插件」页管理的是**组合包**，
不是裸的 MCP 服务器条目)。给 DSH 接一个自定义 MCP 服务器,官方支持的路径是：

1. 写一个声明 `dsh.bundle.patch` 的小 npm 包(就是这个目录),它的
   `cordis.patch.yml` 往组合树里插入一个 `@deepseek-ai/dsh-mcp-client`
   插件实例(DSH 自带的、"MCP client bridge" 插件,负责真正发起 stdio 子进程
   连接并把工具注册到 DSH 的工具表里)。
2. 在 DSH 的 **插件** 侧栏页用「安装第三方插件 → 本地目录」把这个包装进当前
   profile(`~/.dsh/profiles/desktop`)。
3. 重启 DSH(这个 profile 没开 HMR,新插件实例要重启才会真正连接)。

`cordis.patch.yml` 里的 `command`/`env` 直接指向已经编译好的
[`collaboration-mcp`](../) release 二进制和持久协作服务端地址,和
[`../README.md`](../README.md) 里文档化的运行方式完全一致，不是另一套配置。

## 安装步骤(需要你在 DSH 的 GUI 里点一下)

1. 打开 DSH,侧栏选择 **插件**。
2. 点 **添加插件** 旁边的箭头,选 **安装第三方插件**。
3. 在弹出的对话框里填**本地绝对路径**：

   ```
   /Users/terriblewich/Documents/UI/emmmm/rust-desktop/collaboration-mcp/dsh-plugin
   ```

4. 确认安装(会从 npm 公共源装 `@deepseek-ai/dsh-mcp-client@0.2.1-rc.3`，
   这个版本号和当前 DSH 运行时版本一致，peerDependencies 应该直接匹配,不会被
   版本兼容检查拒绝)。
5. 安装完成后点 **立即启用**。
6. 重启 DSH 应用(不是开新会话,是整个应用重启)。

重启之后,原生工具列表里应该会出现 `mcp__em_use_collab__agent_bind`、
`mcp__em_use_collab__room_read` 等 10 个工具(公开名规则是
`mcp__<serverName>__<rawName>`，`serverName` 就是这里配置的 `em_use_collab`)。

## 前提条件(已经准备好,不需要你再做)

- 协作服务端已经作为独立进程跑在 `127.0.0.1:8787`，`em_use_collab_dev` 库
  已经有一个干净的验证房间和管理员账号(凭证见本机
  `~/.em-use/dsh-verify-notes.md`，没有进 git)。
- `em-use-collab-mcp`/`em-use-collab-cli` 的 release 二进制已经编译好，
  在 [`../target/release/`](../target/release/)。

## 当前验证层级

**这个目录本身还没有被验证过**——它是基于读源码(`dsh-app-boot`、
`dsh-mcp-client`、`dsh-client-ui-plugin-manager` 这几个包的 README 和
`lib/index.js`)推导出的官方安装机制，还没有真正跑通一次「DSH 原生工具调用
→ 真实协作服务端」的往返。等你装上、重启、我确认原生工具列表里真的出现了
这 10 个工具并完成一次真实调用之后,会在这里和
[`collaboration-mcp/README.md`](../README.md) 里补上真实结果，不提前当作
已验证。
