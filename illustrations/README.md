# 潜令 · 角色插图库

更新于 2026-10-26T21:08:43.935965+08:00，共 **145 张入选插图**。

| 角色 | 入选 | SFW | NSFW |
|---|---:|---:|---:|
| 云弦 | 37 | 18 | 19 |
| 云绫 | 36 | 20 | 16 |
| 云岁宁 | 36 | 17 | 19 |
| 云穗 | 36 | 23 | 13 |

按角色、地点、画面时段、场景元素及 SFW／NSFW 分类。故事日期、精确钟点和地图节点留待剧情绑定。

- `manifest.json`：图片总清单、相对路径、尺寸、分类和文件校验值。
- `by-character/`、`by-place.json`：按角色与地点查询固定图片编号。
- `images/`：原尺寸无损 WebP，逐张核对与本地原图的解码像素一致。
- `thumbnails/`：供图片库浏览的轻量缩略图。
- `gallery.html`：内置清单的分类总览，下载此目录后可直接浏览；GitHub 文件页面展示源码。
- `image-library.mjs`：前端加载、筛选、按固定编号取图与缺图回退。
- `media-manifest.json`：图片的字节数、SHA256、按需加载和回退清单。

## 前端与角色卡接入

清单入口：`https://raw.githubusercontent.com/Asriel134/qianling-assets/main/illustrations/manifest.json`。图片路径相对清单地址解析，不能相对角色卡页面解析。

```js
// 将本目录 image-library.mjs 随前端工程一起引入。
import { loadImageLibrary } from './image-library.mjs';
const library = await loadImageLibrary('https://raw.githubusercontent.com/Asriel134/qianling-assets/main/illustrations/manifest.json');
const pictures = library.list({ character: 'ling', place: 'kitchen', contentType: 'SFW' });
// 以 asset_id 保存已选插图；不要保存数组序号。
if (pictures.length) library.bindImage(document.querySelector('img'), pictures[0].asset_id);
```

普通插图也可直接用 `<img src="完整图片地址" loading="lazy" decoding="async">`。这套资源不要求安装生成工具，不触发图片生成。

列表先加载缩略图，查看大图时才加载原尺寸文件；全图均为 on-demand，避免一次预载整套图片。脚本按 asset_id 精确取图，缺图显示中性占位图。

3264 按用户确认归云弦，展示名保留“云弦 · 厨房 · 傍晚 · 3264”。固定 asset_id 和图片 URL 不随分类调整改变。

## 后续追加

维护本地入选资料库、核对新图分类后重新导出本目录。既有图片编号和链接保留；取消入选的图移出清单，历史文件继续保留以免旧插图链接失效。
更新同一份 manifest 即可让使用方读取新图。正式角色卡可将 URL 的 main 换为本次提交 SHA，固定所用版本。

本包准备的是图片资源和接入接口；具体剧情事件、地图节点和现有角色卡脚本需由对应前端工程绑定并实测。
