# 历史 Logo 来源记录（当前已停用）

2026-09-11 第二轮按用户要求移除了本目录全部官方 Logo 图片，运行时不再加载这些图片。当前仅保留本历史来源记录；外壳与衣橱直接渲染原创趣味字标：北孚、大米、铜霸王、AYD（A亚迪）、您德时代。


2026-09-11 从下列品牌官网页面或页面实际引用的静态资源获取。Logo 保留官方图形，品牌装扮是本应用的趣味创作，不表示联名或授权背书。

| 本地文件 | 官方页面 / 资源 |
| --- | --- |
| nanfu.png | [南孚官网](https://www.nanfu.com/)；[原图](https://www.nanfu.com/bocweb/web/img/logo.png)，请求使用官网 Referer |
| xiaomi.png | [小米官网](https://www.mi.com/global/) 页头无脚本 Logo；[原图](https://i01.appmifile.com/webfile/globalimg/logo/pwa-mi/72x72.png) |
| duracell.svg | [Duracell 官网](https://duracell.com/) 的 footer-logo 内嵌 SVG；保留路径并补充固定宽高，以便 Canvas 解码 |
| byd.png | [比亚迪官网](https://www.byd.com/cn)；[页头 Logo 原图](https://www.byd.com/material/domestic-official/header/logo.png)；原图为白色字标，界面在其后绘制红色底牌 |
| catl.svg | [宁德时代官网](https://www.catl.com/)；[页头 Logo 原图](https://www.catl.com/template/1/default/_files/svg/logo.svg) |

Logo 均存放在项目内，运行时不依赖第三方网络。身体外壳由 imagegen 单独生成，Logo、实时百分比、表情与四肢分别合成。
