# 会议记录 / Meeting Notes

> [!TIP] 怎么用 / How to use
> 1. 尖括号「<>」里是提示，替换成自己的内容后把尖括号一并删掉。 / Words in angle brackets are hints — replace them and delete the brackets.
> 2. 开会时就填「议程」和「讨论要点」，散会前一定要把「行动项」写成带负责人和截止日的任务。 / Fill agenda and notes during the meeting; never leave the room without action items that have an owner and a due date.
> 3. 行动项用三态任务写，点方框即可在 `[ ]` / `[~]` / `[x]` 之间切换。 / Write action items as three-state tasks; click the box to cycle their state.

## 基本信息 / At a glance

- **时间 / When**：<2026-11-26 14:00 - 15:00>
- **地点 / Where**：<线上 · 腾讯会议 / Online>
- **参会人 / Attendees**：<李工、王设计、我>
- **记录人 / Notes by**：<我>
- **相关文档 / Links**：<[0.7 版本说明](https://example.com/docs/0-7)>

## 议程 / Agenda

1. <0.7 版本还剩哪些收尾工作>
2. <Markdown 链接被包成尖括号的问题怎么处理>
3. <模板文件的中英双语怎么写>

## 讨论要点 / Discussion

### 1. 版本收尾 / Release wrap-up

- <导出对话框只差页码范围校验，本周内补完>
- <桌面端需要在 WebView2 里复测一次快捷键>

### 2. 链接序列化 / Link serialization

- <根因是 GFM 自动链接被序列化成 `<url>` 简写>
- <结论：统一输出 `[文字](url)` 标准形式，旧文档下次保存自动归正>

### 3. 模板 / Templates

- <文件名全部改成英文，避免中文名在某些系统上乱码>
- <内容要中英双语，新人照着改就能写完>

## 决议 / Decisions

- [x] <链接统一输出标准形式，不做「不处理」的方案>
- [x] <模板文件名英文化，旧文件名首次启动时自动迁移>

## 行动项 / Action items

- [~] <补导出对话框的页码范围校验> · 负责人 / Owner：<我> · 截止 / Due：<11-28>
- [ ] <在 WebView2 里复测 Ctrl + Alt 组合键> · 负责人 / Owner：<李工> · 截止 / Due：<11-29>
- [ ] <确认模板文案与四条提示> · 负责人 / Owner：<王设计> · 截止 / Due：<12-01>

## 下次会议 / Next meeting

- 时间 / When：<2026-12-03 14:00>
- 议题 / Topics：<0.7 版本发布检查、模板使用反馈>

> [!INFO] 备注 / Note
> 会议记录只写结论和行动项，过程细节留在这里但不必逐字记录发言。
