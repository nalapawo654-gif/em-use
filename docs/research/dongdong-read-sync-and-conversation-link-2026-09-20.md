# 咚咚本机已读同步与会话跳转调研

日期：2026-09-20。对象：本机已安装咚咚 3.4.1 的静态客户端代码，以及项目现有只读消息接口。没有修改咚咚数据库、注入客户端或发送测试消息。

## 结论

可使用客户端已有协议，在用户点击时定位私聊或群聊。暂未找到可供外部程序调用、且不切换窗口的本机已读接口。现有服务端 batchRead 成功不等于本机红点消除。

## 已读链路的依据

安装目录 `Contents/Resources/app.asar` 中：

- `seagull/renderer/dist/assets/use-page-CrdSHG_x.js`（以归档内同名资源为准）：正常阅读先通过 `getAndReadAllUnreadMsgsOfChat` 更新本地 `has_read`，再发服务端回执并更新会话视图。
- 同一资源的 `syncread` 处理器仅在 `source !== PC` 时执行 `syncReadMsgHandler`，再调用本地阅读方法及 `requestNotifyMsgs({unreadMaybeErased:true})`。同类 PC 来源被跳过，可解释桌宠服务端回执成功后本机仍未读的现象；这是静态路径推断，未抓取服务器推送证明每条回执来源。
- `multiRead` / `checkRecentChatReadStatus` 更新发出消息的收件人阅读信息，不等同于清除当前用户收到消息的本地未读。
- `seagull/main/dist/index.cjs` 的外部 URL 分发器包含聊天打开等入口，未发现后台标读入口；内部数据库 worker / renderer IPC 不属于可供外部直接调用的公共接口。

不将“未发现接口”写成所有版本都绝对不可能。可靠的静默同步需要咚咚提供正式客户端接口，或进一步验证其官方支持能力。直接写消息库还缺少会话缓存和界面通知，不能作为一致性方案；伪装 APP 来源、注入内部事件亦未采用。

## 会话定位

归档 `RoomSkeleton.vue_vue_type_style_index_0_scoped_990d1907_lang-CtW-iDji.js` 的 SDK 实现：

- 私聊：`emdongdong://chat/start?userId=<badgeId>&from=em-use`。
- 群聊：`emdongdong://chat/start?groupId=<groupId>&from=em-use`。

主进程的 `open-url` / `second-instance` 分发为 `R_ENTER_CHAT_TASK` + `prepareAndEnterChat`。项目沿用当前运行的安装路径：macOS 通过 Launch Services 携带 URL，Windows 直接将 URL 作为客户端命令行参数。

前端只传账户 epoch 与已发放的不透明会话 key。原生只读查询当前账户的可见会话，区分私聊和群聊，校验 ID，复查来源；不接受前端 URL，不按姓名猜测。隐藏预览仍可显式打开对应提醒会话。列表页保留一般唤起。

## 验证边界

本文件中的协议和同步路径来源于本机 macOS 3.4.1 静态实现，不代表 Windows 或其他版本已经实测。协议交给系统成功，只能显示“已请求打开咚咚”；最终定位和本机红点变化须在原生客户端验证。测试结论另记于消息实现说明。
