---
title: "浏览器原生 ES 模块来了，对前端开发意味着什么？"
author: rianma
pubDatetime: 2018-07-06T00:00:00Z
slug: es6-modules-support-is-coming-to-browsers-what-does-it-mean-for-frontend-dev
featured: false
draft: false
tags:
  - javascript
description: "浏览器已原生支持 ES 模块，这对现代前端开发工作流意味着什么？"
---

还记得当初入门前端开发的时候写过的 Hello World 么？一开始我们先创建了一个 HTML 文件，在 `<body>` 标签里写上网页内容；后来需要学习页面交互逻辑时，在 HTML markup 里增加一个 `<script src="script.js">` 标签引入外部 script.js 代码，script.js 负责页面交互逻辑。

随着前端社区 JavaScript 模块化的发展，我们现在的习惯是拆分 JS 代码模块后使用 Webpack 打包为一个 bundle.js 文件，再在 HTML 中使用 `<script src="bundle.js">` 标签引入打包后的 JS。这意味着我们的前端开发工作流从“石器时代”跨越到了“工业时代”，但是对浏览器来说并没有质的改变，它所加载的代码依然一个 bundle.js ，与我们在 Hello World 时加载脚本的方式没什么两样。

——直到浏览器对 ES Module 标准的原生支持，改变了这种情况。目前大多数浏览器已经支持通过 `<script type="module">` 的方式加载标准的 ES 模块，正是时候让我们重新学习 script 相关的知识点了。

## 复习：defer 和 async 傻傻分不清楚？

请听题：

**Q：有两个 script 元素，一个从 CDN 加载 lodash，另一个从本地加载 script.js，假设总是本地脚本下载更快，那么以下 plain.html、async.html 和 defer.html 分别输出什么？**

```js
// script.js
try {
  console.log(_.VERSION);
} catch (error) {
  console.log("Lodash Not Available");
}
console.log(document.body ? "YES" : "NO");
```

```html
// A. plain.html
<head>
  true
  <script src="https://cdn.jsdelivr.net/npm/lodash@4.17.10/lodash.min.js"></script>
  <script src="script.js"></script>
</head>

// B. async.html
<head>
  true
  <script
    src="https://cdn.jsdelivr.net/npm/lodash@4.17.10/lodash.min.js"
    async
  ></script>
  <script src="script.js" async></script>
</head>

// C. defer.html
<head>
  true
  <script
    src="https://cdn.jsdelivr.net/npm/lodash@4.17.10/lodash.min.js"
    defer
  ></script>
  <script src="script.js" defer></script>
</head>
```

如果你知道答案，恭喜你可以跳过这一节了，否则就要复习一下了。

首先 A. plain.html 的输出是：

```plain
4.17.10
NO
```

也就是说 script.js 在执行时，lodash 已下载并执行完毕，但 document.body 尚未加载。

在 defer 和 async 属性诞生之前，最初浏览器加载脚本是采用同步模型的。浏览器解析器在自上而下解析 HTML 标签，遇到 script 标签时会暂停对文档其它标签的解析而读取 script 标签。此时：

- 如果 script 标签无 src 属性，为内联脚本，解析器会直接读取标签的 textContent，由 JS 解释器执行 JS 代码
- 如果 script 有 src 属性，则从 src 指定的 URI 发起网络请求下载脚本，然后由 JS 解释器执行

无论哪种情况，都会阻塞浏览器的解析器，刚刚说到浏览器是自上而下解析 HTML Markup 的，所以这个阻塞的特性就决定了，script 标签中的脚本执行时，位于该 script 标签以上的 DOM 元素是可用的，位于其以下的 DOM 元素不可用。

如果我们的脚本的执行需要操作前面的 DOM 元素，并且后面的 DOM 元素的加载和渲染依赖该脚本的执行结果，这样的阻塞是有意义的。但如果情况相反，那么脚本的执行只会拖慢页面的渲染。

正因如此，2006 年的《Yahoo 网站优化建议》中有一个著名的规则：

> 把脚本放在 body 底部

但现代浏览器早已支持给 `<script>` 标签加上 defer 或 async 属性，二者的共同点是都不会阻塞 HTML 解析器。

当文档只有一个 script 标签时，defer 与 async 并没有显著差异。但当有多个 script 标签时，二者表现不同：

- async 脚本每个都会在下载完成后立即执行，无关 script 标签出现的顺序
- defer 脚本会根据 script 标签顺序先后执行

所以以上问题中，后两种情况分别输出：

```plain
// B. async.html
Lodash Not Available
YES

// C. defer.html
4.17.10
YES
```

因为 async.html 中 script.js 体积更小下载更快，所以执行时间也比从 CDN 加载的 lodash 更早，所以 `_.VERSION` 上不可用，输出 `Lodash Not Available`；而 defer.html 中的 script.js 下载完毕后并不立即执行，而是在 lodash 下载和执行之后才执行。

以下这张图片可以直观地看出 Default、defer、async 三种不同 script 脚本的加载方式的差异，浅蓝色为脚本下载阶段，黄色为脚本执行阶段。

![](./images/es6-modules/1647de1539daec9b.png)

One more thing…

上文只分析了包含 src 属性的 script 标签，也就是需要发起网络请求从外部加载脚本的情况，那么当内联 `<script>` 标签遇到 async 和 defer 属性时又如何呢？

答案就是简单的**不支持**，把 async 和 defer 属性用以下这种方式写到 script 标签中没有任何效果，意味着内联的 JS 脚本一定是同步阻塞执行的。

```html
// defer attribute is useless
<script defer>
  console.log(_.VERSION);
</script>

// async attribute is useless
<script async>
  console.log(_.VERSION);
</script>
```

这一点之所以值得单独拎出来讲，是因为稍后我们会发现浏览器处理 ES Module 时与常规 script 相反，默认情况下是异步不阻塞的。

## 改变游戏规则的 `<script type=module>`

TLDR;

- 给 script 标签添加 type=module 属性，就可以让浏览器以 ES Module 的方式加载脚本
- type=module 标签既支持内联脚本，也支持加载脚本
- 默认情况下 ES 脚本是 defer 的，无论内联还是外联
- 给 script 标签显式指定 `async` 属性，可以覆盖默认的 defer 行为
- 同一模块仅执行一次
- 远程 script 根据 URL 作为判断唯一性的 Key
- 安全策略更严格，非同域脚本的加载受 CORS 策略限制
- 服务器端提供 ES Module 资源时，必须返回有效的属于 JavaScript 类型的 Content-Type 头

### #1 ES Module 101

#### 导入与导出

ES 标准的模块使用 `import`、`export` 实现模块导入和导出。

export 可以导出任意可用的 JavaScript 标识符（idendifier），显式的导出方式包括声明（declaration）语句和 `export { idendifier as name }` 两种方式。

```js
// lib/math.js
export function sum(x, y) {
  return x + y;
}
export let pi = 3.141593;
export const epsilon = Number.EPSILON;
export { pi as PI };
```

在另一个文件中，使用 `import ... from ...` 可以导入其他模块 export 的标识符，常用的使用方式包括：

- `import * as math from ...` 导入整个模块，并通过 math 命名空间调用
- `import { pi, epsilon } from ...` 部分导入，可直接调用 pi, epsilon 等变量

```js
// app.js
import * as math from "./lib/math.js";
import { pi, PI, epsilon } from "./lib/math.js";
console.log(`2π = ${math.sum(math.pi, math.pi)}`);
console.log(`epsilon = ${epsilon}`);
console.log(`PI = ${PI}`);
```

#### default

ES 模块支持 `default` 关键词实现无命名的导入，神奇的点在于它可以与其他显式 `export` 的变量同时导入。

```js
// lib/math.js
export function sum(x, y) {
  return x + y;
}
export default 123;
```

对于这种模块，导入该模块有两种方式，第一种为默认导入 default 值。

```js
import oneTwoThree from "./lib/math.js";
// 此时 oneTwoThree 为 123
```

第二种为 `import *` 方式导入 default 与其他变量。

```js
import * as allDeps from "./lib/math.js";
// 此时 allDeps 是一个包含了 sum 和 default 的对象，allDeps.default 为 123
// { sum: ..., default: 123}
```

#### 语法限制

ES 模块规范要求 import 和 export 必须写在脚本文件的最顶层，这是因为它与 CommonJS 中的 module.exports 不同，export 和 import 并不是传统的 JavaScript 语句（statement）。

- 不能像 CommonJS 一样将导出代码写在条件代码块中

  ```js
  // ./lib/logger.js

  // 正确
  const isError = true;
  let logFunc;
  if (isError) {
    logFunc = message => console.log(`%c${message}`, "color: red");
  } else {
    logFunc = message => console.log(`%c${message}`, "color: green");
  }
  export { logFunc as log };

  const isError = true;
  const greenLog = message => console.log(`%c${message}`, "color: green");
  const redLog = message => console.log(`%c${message}`, "color: red");
  // 错误！
  if (isError) {
    export const log = redLog;
  } else {
    export const log = greenLog;
  }
  ```

- 不能把 import 和 export 放在 try catch 语句中

  ```js
  // 错误！
  try {
    import * as logger from "./lib/logger.js";
  } catch (e) {
    console.log(e);
  }
  ```

另外 ES 模块规范中 import 的路径必须是有效的相对路径、或绝对路径（URI），并且不支持使用表达式作为 URI 路径。

```js
// 错误：不支持类 npm 的“模块名” 导入
import * from 'lodash'

// 错误：必须为纯字符串表示，不支持表达式形式的动态导入
import * from './lib/' + vendor + '.js'
```

### #2 来认识一下 `type=module` 吧

以上是 ES 标准模块的基础知识，这玩意属于标准先行，实现滞后，浏览器支持没有马上跟上。但正如本文一开始所说，好消息目前业界最新的几个主流浏览器 Chrome、Firefox、Safari、Microsoft Edge 都已经支持了，我们要学习的就是 `<script>` 标签的新属性：type=module。

只要在常规 `<script>` 标签里，加上 `type=module` 属性，浏览器就会将这个脚本视为 ES 标准模块，并以模块的方式去加载、执行。

一个简单的 Hello World 是这样子的：

```html
<!-- type-module.html -->
<html>
  <head>
    <script type="module" src="./app.js"></script>
  </head>
  <body></body>
</html>
```

```js
// ./lib/math.js
const PI = 3.14159;
export { PI as PI };

// app.js
function sum(a, b) {
  return a + b;
}
import * as math from "./lib/math.js";
document.body.innerHTML = `PI = ${math.PI}`;
```

打开 index.html 会发现页面内容如下：

![](./images/es6-modules/1647de21e76fd404.png)

可以从 Network 面板中看到资源请求过程，浏览器从 script.src 加载 app.js，在 Initiator 可以看到，app.js:1 发起了 math.js 的请求，即执行到 app.js 第一行 import 语句时去加载依赖模块 math.js。

模块脚本中 JavaScript 语句的执行与常规 script 所加载的脚本一样，可以使用 DOM API，BOM API 等接口，但有一个值得注意的知识点是，作为模块加载的脚本不会像普通的 script 脚本一样**污染全局作用域**。

例如我们的代码中 app.js 定义了函数 `sum`，math.js 定义了常量 `PI`，如果打开 Console 输入 PI 或 sum 浏览器会产生 ReferenceError 报错。

![](./images/es6-modules/1647de24a7fe8510.png)

（Finally…）

### #3 type=module 模块支持内联

在我们以上的示例代码中，如果把 type-module.html 中引用的 app.js 代码改为内联 JavaScript，效果是一样的。

```html
<!-- type-module.html -->
<html>
  <head>
    <script type="module">
      import * as math from "./lib/math.js";
      document.body.innerHTML = `PI = ${math.PI}`;
    </script>
  </head>
  <body></body>
</html>
```

当然内联的模块脚本只在作为 “入口” 脚本加载时有意义，这样做可以免去一次下载 app.js 的 HTTP 请求，此时 import 语句所引用的 math.js 路径自然也需要修改为相对于 type-module.html 的路径。

### #4 默认 defer，支持 async

细心的你可能注意到了，我们的 Hello World 示例中 script 标签写在 head 标签中，其中用到了 `document.body.innerHTML` 的 API 去操作 body，但无论是从外部加载脚本，还是内联在 script 标签中，浏览器都可以正常执行没有报错。

这是因为 `<script type=module>` 默认拥有**类似** `defer` 的行为，所以**脚本的执行不会阻塞页面渲染**，因此会等待 document.body 可用时执行。

> 之所以说 **类似** defer 而非确定，是因为我在浏览器 Console 中尝试检查默认 script 元素的 defer 属性（执行 `script.defer`），得到的结果是 false 而非 true。

这就意味着如果有多个 `<script type=module>` 脚本，浏览器下载完成脚本之后不一定会立即执行，而是按照引入顺序先后执行。

另外，与传统 script 标签类似，我们可以在 `<script>` 标签上写入 async 属性，从而使浏览器按照 async 的方式加载模块——**下载完成后立即执行**。

### #5 同一模块执行一次

ES 模块被多次引用时只会执行一次，我们执行多次 import 语句获取到的内容是一样的。对于 HTML 中的 `<script>` 标签来说也一样，两个 script 标签先后导入同一个模块，只会执行一次。

例如以下脚本读取 count 值并加一：

```js
// app.js
const el = document.getElementById("count");
const count = parseInt(el.innerHTML.trim(), 10);
el.innerHTML = count + 1;
```

如果重复引入 `<script src="app.js">` 只会执行一次 app.js 脚本，页面显示 `count: 1`：

```html
<!-- type-module.html -->
<html>
  <head>
    <script type="module" src="app.js"></script>
    <script type="module" src="app.js"></script>
  </head>
  <body>
    count: <span id="count">0</span>
  </body>
</html>
```

问题来了？如何定义“同一个模块”呢，答案是相同的 URL，不仅包括 pathname 也包括 `?` 开始的参数字符串，所以如果我们给同一个脚本加上不同的参数，浏览器会认为这是两个不同的模块，从而会执行两次。

如果将上面 HTML 代码中第二个 app.js 加上 url 参数：

```html
<script type="module" src="app.js"></script>
<script type="module" src="app.js?foo=bar"></script>
```

浏览器会执行两次 app.js 脚本，页面显示 `count: 2`：

![](./images/es6-modules/1647de304d0547d8.png)

### #6 CORS 跨域限制

我们知道常规的 script 标签有一个重要的特性是不受 CORS 限制，script.src 可以是任何非同域的脚本资源。正因此，我们早些年间利用这个特性“发明”了 JSONP 的方案来实现“跨域”。

但是 type=module 的 script 标签加强了这方面的安全策略，浏览器加载不同域的脚本资源时，如果服务器未返回有效的 `Allow-Origin` 相关 CORS 头，浏览器会禁止加载改脚本。

如下 HTML 通过 5501 端口 serve，而去加载 8082 端口的 app.js 脚本：

```html
<!-- http://localhost:5501/type-module.html -->
<html>
  <head>
    <script type="module" src="http://localhost:8082/app.js"></script>
  </head>
  <body>
    count: <span id="count">0</span>
  </body>
</html>
```

浏览器会禁止加载这个 app.js 脚本。

![](./images/es6-modules/1647de32ba126a14.png)

### #7 MIME 类型

浏览器请求远程资源时，可以根据 HTTP 返回头中的 `Content-Type` 确定所加载资源的 MIME 类型（脚本、HTML、图片格式等）。

因为浏览器一直以来的宽容特性，对于常规的 script 标签来说，即使服务器端未返回 Content-Type 头指定脚本类型为 JavaScript，浏览器默认也会将脚本作为 JavaScript 解析和执行。

但对于 type=module 类型的 script 标签，浏览器不再宽容。如果服务器端对远程脚本的 MIME 类型不属于有效的 JavaScript 类型，浏览器会禁止执行该脚本。

用事实说话：如果我们把 app.js 重命名为 app.xyz，会发现页面会禁止执行这个脚本。因为在 Network 面板中可以看到浏览器返回的 Content-Type 头为 `chemical/x-xyz`，而非有效的 JavaScript 类型如：`text/javascript`。

```html
<html>
  <head>
    <script type="module" src="app.xyz"></script>
  </head>
  <body>
    count: <span id="count">0</span>
  </body>
</html>
```

页面内容依然是 `count: 0`，数值未被修改，可以在控制台和 Network 看到相关信息：

![](./images/es6-modules/1647de369a3441aa.png)

## 真实世界里的 ES Module 实践

### 向后兼容方案

OK 现在来聊现实——旧版本浏览器的兼容性问题，浏览器在处理 ES 模块时有非常巧妙的兼容性方案。

首先在旧版浏览器中，在 HTML markup 的解析阶段遇到 `<script type="module">` 标签，浏览器认为这是自己不能支持的脚本格式，会直接忽略掉该标签；出于浏览器的宽恕性特点，并不会报错，而是静默地继续向下解析 HTML 余下的部分。

所以针对旧版浏览器，我们还是需要新增一个传统的 `<script>` 标签加载 JS 脚本，以实现向后兼容。

其次，而这种用于向后兼容的第二个 `<script>` 标签需要被新浏览器忽略，避免新浏览器重复执行同样的业务逻辑。

为了解决这个问题，script 标签新增了一个 `nomodule` 属性。已支持 type=module 的浏览器版本，应当忽略带有 nomodule 属性的 script 标签，而旧版浏览器因为不认识该属性，所以它是无意义的，不会干扰浏览器以正常的逻辑去加载 script 标签中的脚本。

```html
<script type="module" src="app.js"></script>
<script nomodule src="fallback.js"></script>
```

如上代码所示，新版浏览器加载第一个 script 标签，忽略第二个；旧版不支持 type=module 的浏览器则忽略第一个，加载第二个。

相当优雅对不对？不需要自己手写特性检测的 JS 代码，直接使用 script 的属性即可。

正因如此，进一步思考，我们可以大胆地得出这样的结论：

> 不特性检验，我们**可以立即在生产环境中**使用 `<script type=module>`

### 带来的益处

聊到这里，我们是时候来思考浏览器原生支持 ES 模块能给我们带来的实际好处了。

#### #1 简化开发工作流

在前端工程化大行其道的今天，前端模块化开发已经是标配工作流。但是浏览器不支持 type=module 加载 ES 模板时，我们还是离不开 webpack 为核心的打包工具将本地模块化代码打包成 bundle 再加载。

但由于最新浏览器对 `<script type=module>` 的天然支持，**理论上**我们的本地开发流可以完全脱离 webpack 这类 JS 打包工具了，只需要这样做：

1.  直接将 entry.js 文件使用 `<script>` 标签引用
2.  从 entry.js 到所有依赖的模块代码，全部采用 ES Module 方案实现

当然，之所以说是**理论上**，是因为第 1 点很容易做到，第 2 点要求我们所有依赖代码都用 ES 模块化方案，在目前前端工程化生态圈中，我们的依赖管理是采用 npm 的，而 npm 包大部分是采用 CommonJS 标准而未兼容 ES 标准的。

但毋庸置疑，只要能满足以上 2 点，本地开发可以轻松实现**真正的模块化**，这对我们的**调试体验**是相当大的改善，`webpack --watch`、source map 什么的见鬼去吧。

现在你打开 devtools sg的 Source 面板就可以直接打断点了朋友！Just debug it！

#### #2 作为检查新特性支持度的*水位线*

ES 模块可以作为一个天然的、非常靠谱的浏览器版本检验器，从而在检查其他很多新特性的支持度时，起到**水位线** 的作用。

这里的逻辑其实非常简单，我们可以使用 caniuse 查到浏览器对 `<script type="module">` 的支持状况，很显然对浏览器版本要求很高。

```plain
~> caniuse typemodule
JavaScript modules via script tag ✔ 70.94% ◒ 0.99% [WHATWG Living Standard]
  Loading JavaScript module scripts using `<script type="module">` Includes support for the `nomodule` attribute. #JS

  IE ✘
  Edge ✘ 12+ ✘ 15+¹ ✔ 16+
  Firefox ✘ 2+ ✘ 54+² ✔ 60+
  Chrome ✘ 4+ ✘ 60+¹ ✔ 61+
  Safari ✘ 3.1+ ◒ 10.1+⁴ ✔ 11+
  Opera ✘ 9+ ✘ 47+¹ ✔ 48+

    ¹Support can be enabled via `about:flags`
    ²Support can be enabled via `about:config`
    ⁴Does not support the `nomodule` attribute
```

> PS: 推荐一个 npm 工具：[caniuse-cmd](https://www.npmjs.com/package/caniuse-cmd)，调用 `npm i -g caniuse-cmd` 即可使用命令行快速查询 caniuse，支持模糊搜索哦

这意味着，如果一个浏览器支持加载 ES 模块，其版本号一定大于以上表格中指定的这些版本。

以 Chrome 为例，进一步思考，这也就意味着我们在 ES 模板的代码中可以**脱离 polyfill** 使用所有 Chrome 61 支持的特性。这个列表包含了相当丰富的*新*特性，其中有很多是我们在生产环境中不敢直接使用的，但有了 `<script type=module>` 的保证，什么 Service Worker，Promise，Cache API，Fetch API 等都可以大胆地往上怼了。

> 这里是一张来自 Google 工程师 Sam Thorogood 在 Polymer Summit 2017 上的分享 [ES6 Modules in the Real World](https://www.youtube.com/watch?v=fIP4pjAqCtQ) 的 slides 截图，大致描述了当时几款主要浏览器对 type=module 与其他常见新特性支持度对比表格，可以帮我们了解个大概。

![](./images/es6-modules/1647de395ddd83dc.png)

## 面临的挑战——重新思考前端构建

OK 现在是时候再来思考不那么好玩的部分了，软件开发没有银弹，今天我们讨论的 ES 模板也不例外。来看如果让浏览器原生引入 ES 模板可能带来的新的问题，以及给我们带来的新的挑战。

### #1 请求数量增加

对于已支持 ES 模板的浏览器，如果我们从 script 标签开始引入 ES Module，就自然会面临这样的问题。假设我们有这样的依赖链，就意味着浏览器要先后加载 6 个模块：

```plain
entry.js
├──> logger.js -> util.js -> lodash.js
├──> constants.js
└──> event.js -> constants.js
```

对于传统的 HTTP 站点，这就意味着要发送 6 个独立的 HTTP 请求，与我们常规的性能优化实践背道而驰。

因此这里的矛盾点实际是**减少 HTTP 请求数**与**提高模块复用程度**之间的矛盾：

- 模块化开发模式下，随着代码自然增长会有越来越多模块
- 模块越多，浏览器要发起的请求数也就越多

面对这个矛盾，需要我们结合业务特点思考优化策略，做出折衷的决策或妥协。

一个值得思考的方向是借助 HTTP 2 技术进行模块加载的优化。

借助 Server Push 技术，可以选出应用中复用次数最多的公用模块，尽可能提早将这些模块 push 到浏览器端。例如在请求 HTML 时，服务器使用同一个连接将以上示例中的 util.js、lodash.js、constants.js 模块与 HTML 文档一并 push 到浏览器端，这样浏览器在需要加载这些模块时，可以免去再次主动发起请求的过程，直接执行。

> PS: 强烈推荐阅读 Jake Archibald 大神的文章：[HTTP/2 push is tougher than I thought](https://jakearchibald.com/2017/h2-push-tougher-than-i-thought/)

借助 HTTP/2 的合并请求和头部压缩功能，也可以改善请求数增加导致的加载变慢问题。

当然使用 HTTP/2 就对我们的后端 HTTP 服务提供方提出了挑战，当然这也可以作为一个契机，推动我们学习和应用 HTTP/2 协议。

> PS：其他文章也有讨论使用prefetch 缓存机制来进行资源加载的优化，可以作为一个方向进一步探索

### #2 警惕依赖地狱——版本与缓存管理

软件工程有一个著名的笑话：

> There are only two hard things in Computer Science: cache invalidation and naming things.
>
> – Phil Karlton

可见缓存的管理是一件不应当被小看的事。

传统上我们如何进行 JS 脚本的版本控制部署呢？结合 HTTP 缓存机制，一般的最佳实践是这样的：

- 文件命名加上版本号
- 设置 max-age 长缓存
- 有版本更新时，修改文件名中的版本号部分，修改 script.src 路径

如果我们每次只引入一两个稳定的 `*.js` 库脚本，再引入业务脚本 `bundle.xxx.js`，这样的实践可以说问题不大。

但设想我们现在要直接向新版浏览器 ship ES 模块了，随着业务的发展，我们要管理的就是十几个甚至几十个依赖模块了，对于一个大型的站点来说，几十个页面，拥有几百个模块也一点不意外。

依赖图谱这么复杂，模块数量这么多的情况下，JS 文件的缓存管理和版本更新还那么容易做么？

例如我们有这样的依赖图谱：

```plain
./page-one/entry.js
├──> logger.js -> util.js -> lodash.js
├──> constants.js
├──> router.js -> util.js
└──> event.js -> util.js

./page-two/entry.js
├──> logger.js -> util.js -> lodash.js
└──> router.js -> constants.js
```

现在我们修改了一个公用组件 `util.js`，在生产环境，浏览器端存有旧版的 `util-1.0.0.js` 的长缓存，但由于 logger、router、event 组件都依赖 util 组件，这就意味着我们在生成 `util-1.1.0.js` 版本时，要相应修改其他组件中的 import 语句，也要修改 HTML 中的 `<script>` 标签。

```plain
// router-2.0.0.js -> router-2.1.0.js
import * as util from './util-1.1.0.js'

// page-one/entry-3.1.2.js -> page-one/entry-3.2.0.js
import * as util from './util-1.1.0.js'

// page-one.html
<script type="module" src="./page-one/entry-3.2.0.js">

// ... page-two 相关脚本也要一起修改
```

这些依赖组件的版本号，沿着这个依赖图谱一直向上追溯，我们要一修改、重构。这个过程当然可以结合我们的构建工具实现，免去手动修改，需要我们开发构建工具插件或使用 npm scripts 脚本实现。

### #3 必须保持向后兼容

在上文我们已经提到这点，在实践中我们务必要记得在部署到生产环境时，依然要打包一份旧版浏览器可用的 bundle.js 文件，这一步是已有工作流，只需要给 script 标签加一个 nomodule 属性即可。

那么问题来了，有时候为了尽可能减少页面发起请求的数量，我们会将关键 JS 脚本直接**内联**到 HTML markup 中，相比 `<script src=...>` 引入外部脚本的方式，再次减少了一次请求。

如果我们采用 `<nomodule>` 属性的 script 标签，会被新版浏览器忽略，所以对于新版浏览器来说，这里 nomodule 脚本内容最好不要内联，否则徒增文件体积，却不会执行这部分脚本，why bother？

所以这里 `<script nomodule>` 脚本是内联还是外联，依然要由开发者来做决策。

### #4 升级 CommonJS 模块为 ES 标准模块

如果我们在生产环境使用 script 标签引入了 ES 标准模块，那么一定地，我们要把所有作为依赖模块、依赖库的代码都重构为 ES 模块的形式，而目前，前端生态的现状是：

- 大部分依赖库模块都兼容 CommonJS 标准，少数才兼容 ES 标准。
- 依赖包部署在 npm 上，安装在 node_modules 目录中。
- 已有的业务代码采用 `require(${npm模块名})` 方式引用 node_modules 中的 package。

给我们带来的挑战是：

- 需重构大量 CommonJS 模块为 ES 标准模块，工作量大。
- 需重构 node_modules **包** 的引用方式，使用相对路径方式引用。

### #5 别忘了压缩 ES 模块文件

生产环境部署传统 JS 静态资源的另一个重要的优化实践是 minify 处理代码，以减小文件体积，因为毋庸置疑文件越小传输越快。

而如果我们要向新版浏览器 ship 原生 ES 模块，也不可忽略压缩 ES 模块文件这一点。

OK 我们想到处理 ES5 代码时常用的大名鼎鼎的 uglify 了，不幸的是 uglify 对 ES6 代码的 minify 支持度并不乐观。目前 uglify 常用的场景，是我们先使用 babel 转义 ES6 代码得到 ES5 代码，再使用 uglify 去 minify ES5 代码。

要压缩 ES6 代码，更好的选择是来自 babel 团队的 [babel-minify](https://github.com/babel/minify) （原名 Babili）。

![](./images/es6-modules/1647de3ba9ce4cd2.png)

### #6 结论？

大神说写文章要有结论，聊到现在，我们惊喜地发现问题比好处的篇幅多得多（我有什么办法，我也很无奈啊）。

所以我对浏览器加载 ES 模块的态度是：

- 开发阶段，只要浏览器支持，尽管激进地使用！Just do it！
- 不要丢掉 webpack 本地构建 bundle 那一套，本地构建依然是并将长期作为前端工程化的核心
- 即使生产环境直接 serve 原生模块，也一样需要构建流程
- 生产环境不要盲目使用，首先要设计出良好的依赖管理和缓存更新方案，并且部署好后端 HTTP/2 支持

## ES 模块的未来？

有一说一，目前我们目前要在生产环境中拥抱 ES 模块，面临的挑战还不少，要让原生 ES Module 发挥其最大作用还需要很多细节上的优化，也需要踩过坑，方能沉淀出最佳实践。还是那句话——没有银弹。

但是在前端模块化这一领域，ES 模块毫无疑问代表着未来。

EcmaScript 标准委员会 TC39 也一直在推进模块标准的更新，关注标准发展的同学可以进一步去探索，一些值得提及的点包括：

- [tc39/proposal-dynamic-import](https://github.com/tc39/proposal-dynamic-import) 动态导入特性支持，已进入 Stage 3 阶段
- [tc39/proposal-import-meta](https://github.com/tc39/proposal-import-meta) 指定 import.meta 可以编程的方式，在代码中获取模块相关的元信息
- [tc39/tc39-module-keys](https://github.com/tc39/tc39-module-keys) 用于第三方模块引用时，进行安全性方面的强化，现处于 Stage 1 阶段
- [tc39/proposal-modules-pragma](https://github.com/tc39/proposal-modules-pragma) 类似 “user strict” 指令指明严格模式，使用 “use module” 指令来指定一个常规的文件以**模块**模式加载，现处于 Stage 1 阶段
- [tc39/proposal-module-get](https://github.com/tc39/proposal-module-get) 类似 Object.defineProperty 定义某一个属性的 getter，允许 `export get prop() { return ... }` 这种语法实现动态导出

## 参考资源

- [Using JavaScript modules on the web](https://developers.google.com/web/fundamentals/primers/modules) Web Fundamentals 教程文章
- [ES6 Modules in the Real World](https://www.youtube.com/watch?v=fIP4pjAqCtQ) Polymer Summit 2017 演讲视频（Youtube）
- [ES6 modules support lands in browsers: is it time to rethink bundling?](https://www.contentful.com/blog/2017/04/04/es6-modules-support-lands-in-browsers-is-it-time-to-rethink-bundling/)
- [Can I use… JavaScript modules via script tag](https://caniuse.com/#feat=es6-module)
- [How Well Do You Know the Web? (Google I/O ‘17)](https://www.youtube.com/watch?v=vAgKZoGIvqs) Google I/O 2017 现场答题
- [为什么 ES Module 的浏览器支持没有意义](https://zhuanlan.zhihu.com/p/25046637) —— 一些相反的声音，帮助思考与讨论

> 题图来自：[Contentful](https://www.contentful.com/blog/2017/04/04/es6-modules-support-lands-in-browsers-is-it-time-to-rethink-bundling/)
