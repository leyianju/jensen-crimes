# 黄仁勋罪行生成器 · Jensen Crimes Generator

![示例](docs/sample.jpg)

> 在线玩：**https://leyianju.github.io/jensen-crimes/**

复刻那个被下架的小网站：填几行字、拖两张图，一键导出一张

> **英伟达董事会调查发现，CEO 黄仁勋玩《丝之歌》一直到第三幕还在用收割者**
> 天哪是我们的第七纹章大人　　——一位明显受惊的英伟达高管说。

这种"假新闻截图"。纯前端、零依赖、图片不出浏览器。

## 能干什么

- **所见即所得**：左边改字，右边画布立刻重排，导出的 PNG 和预览一模一样（2400px 宽，2x）
- **标题自动适配**：三行以内自动找字号，长标题不会溢出、不会挤成蚂蚁字
- **中文断行**：标点不落行首、英文单词不拆开、左括号不落行尾
- **双图排版**：左图（默认是黄仁勋）+ 右图（你的游戏截图），高度和左右比例都能拖
- **随手换图**：点击画布左/右半边、拖拽文件进去、Ctrl+V 直接粘贴截图
- **随机文案**：内置 18 条现成段子，点一下换一条
- **分享链接**：文案和版式参数全部压进 URL，发给朋友打开就是同一张图（图片不上传，用默认素材）
- **快捷键**：`Ctrl/⌘ + S` 下载，`Ctrl/⌘ + V` 粘贴截图

## 怎么用

1. 打开网页，左边改标题 / 引言 / 署名句 / 日期
2. 点「右图」，选一张游戏截图（或者直接把图拖进画布）
3. 点「下载 PNG」

标题里的 `CEO黄仁勋` 之后想加游戏名，直接写就行，会自动换行。
想换"媒体名"（左上角那行红字）就改第一个输入框，`arknights`、`News-AI`、`Steam-AI` 之类都可以。

## 本地跑

不需要构建、不需要 npm。因为用了 `assets/` 下的相对路径，**建议起个静态服务器**而不是直接双击：

```bash
# 任选一种
python -m http.server 8080
npx serve .
```

然后打开 <http://localhost:8080>。
（直接双击 `index.html` 也能画图，只是「分享链接」「复制图片」会被浏览器权限挡住。）

## 想改点东西

| 想改什么 | 改哪里 |
| --- | --- |
| 内置段子 | `assets/presets.js`，往数组里加一条就行 |
| 版式间距、字号 | `assets/render.js` 顶部的 `M` 常量（`top` / `headGap` / `quoteGap` …） |
| 颜色、边距 | `assets/render.js` 里的 `C` 和 `PAD` |
| 页面外观 | `assets/style.css` |
| 默认素材 | 替换 `assets/img/jensen.jpg`、`assets/img/demo-game.jpg` |

渲染是手写 canvas，没有 html2canvas 这类库：预览和导出走同一个 `render()`，所以不会出现"预览好好的，导出错位"。

## 部署到你自己的 GitHub Pages

1. Fork 这个仓库（或者把文件夹推到你自己的 repo）
2. Settings → Pages → Source 选 `Deploy from a branch`，分支 `main`、目录 `/ (root)`
3. 等半分钟，访问 `https://<你的用户名>.github.io/<仓库名>/`

没有构建步骤，改完直接 commit 就生效。

## 素材与版权

- 代码：MIT
- `assets/img/jensen.jpg`、`assets/img/demo-game.jpg`：来自 Wikimedia Commons，**CC BY-SA 4.0**，作者与出处见 [CREDITS.md](CREDITS.md)
- 字体：`Noto Serif SC`（SIL Open Font License），通过 jsDelivr 加载；加载不到时自动退回系统宋体（宋体 / Songti SC / SimSun）

自己上传的截图不会被保存或上传，只活在你这次浏览器的内存里。
商用、或者想拿去当"真新闻"用，请自己替换素材并确认授权。

## 免责声明

本项目只是把"假新闻截图的排版"做成玩具，标题内容由使用者自己填写。
**和 NVIDIA、黄仁勋本人没有任何关系**，所有内容均为虚构恶搞，请勿当作真实新闻传播。

---

<sub>Unrelated to NVIDIA. A parody layout toy. All headlines are user-generated fiction.</sub>
