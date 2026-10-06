# yphone

一个运行在浏览器中的虚拟手机界面，面向角色扮演与 AI 对话场景。项目采用原生 HTML、CSS 与 JavaScript 实现，无构建步骤，支持作为 PWA 使用。

**在线体验：** <https://melody-yan.github.io/yphone/>

## 功能

- 虚拟桌面、锁屏、状态栏、壁纸与桌面小组件
- 通讯录与角色卡管理，支持导入 PNG、JSON、DOCX、TXT、Markdown 角色卡
- 多角色对话、群聊、消息记录、长期记忆与角色动态
- 人设管理：称呼、关系、年龄、MBTI、生日、兴趣、简介与互动边界
- 世界书：按关键词触发设定，支持分类、启停、导入导出与角色专属设定
- AI 接口配置：兼容 OpenAI Chat Completions 格式的接口、模型列表读取与请求监视
- 图片生成、图片编辑与角色发图能力
- 日历、备忘录、时钟、计算器、相册与音乐播放器
- 外卖与桃桃商城：AI 生成商家和商品，支持购物车、地址簿、钱包、支付密码与送礼
- 外观设置：壁纸、锁屏、图标布局、主题效果与通知设置
- 数据默认保存在浏览器本地，图片使用 IndexedDB 保存，支持存档导入与导出

## 使用

直接打开 `index.html` 即可运行。项目不依赖 Node.js 或其他构建工具。

首次使用 AI 对话时，在「设置」中填写：

- API 地址
- API Key
- 模型名称

API 请求从浏览器直接发出，密钥仅保存在当前浏览器的本地存储中。请使用可信的接口地址，并注意浏览器跨域限制。

## 技术实现

- 原生 HTML / CSS / JavaScript
- IIFE 组织脚本，运行时通过 `window.SJ`、`window.APPS` 与 `window.SHELL` 连接模块
- `localStorage` 保存设置、角色、消息和应用数据
- IndexedDB 保存较大的图片资源
- Service Worker / Web App Manifest 提供 PWA 能力
- 内联 SVG 图标与本地素材，不依赖外部 UI 图标库

## 目录

```text
index.html       页面入口
styles.css       全局样式与组件样式
js/core.js       状态、存储、世界书、AI 接口与数据层
js/apps.js       应用定义与各应用界面
js/app.js        手机壳、桌面、锁屏、手势与启动逻辑
manifest.json    PWA 配置
img/             壁纸与界面素材
icons/           应用图标
```

## 许可

项目中的代码与素材许可信息以仓库内实际文件说明为准。内置 Lucide 图标路径遵循 ISC License；OpenMoji 图标遵循 CC BY-SA 4.0。
