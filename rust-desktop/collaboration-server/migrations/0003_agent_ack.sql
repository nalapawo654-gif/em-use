-- 补一个 Agent 自己的房间读取游标（room_ack 工具用），与人类已读、任务完成是
-- 四种不同事实中的一种（文档 7.3：「设备收到、Agent 已处理、人已读、任务完成是
-- 四种不同事实」），这里只做 Agent 已处理这一种，不代替人类已读。
ALTER TABLE agent_instances
    ADD COLUMN acked_seq BIGINT NOT NULL DEFAULT 0;
