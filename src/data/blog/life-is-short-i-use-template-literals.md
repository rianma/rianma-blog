---
title: "人生苦短，我用 ES6 模板"
author: rianma
pubDatetime: 2018-05-19T00:00:00Z
slug: life-is-short-i-use-template-literals
featured: false
draft: false
tags:
  - template literals
description: "ES6 模板字面量可能是最容易被低估的特性，本文深入讲解它被忽视的强大能力。"
---

ES6（ES2015）为 JavaScript 引入了许多新特性，其中与字符串处理相关的一个新特性——模板字面量，提供了多行字符串、字符串模板的功能，相信很多人已经在使用了。模板字面量的基本使用很简单，但大多数开发者还是仅仅把它当成字符串拼接的语法糖来使用的，实际上它的能力比这要强大得多哦。夸张一点地说，这可能是 ES6 这么多特性中，最容易被低估的特性了。Here is why。

## 基础特性

模板字面量在 ES2015 规范中叫做 [Template Literals](http://www.ecma-international.org/ecma-262/6.0/#sec-template-literals)，在规范文档更早的版本中叫 _Template Strings_，所以我们见过的中文文档很多也有把它写成 _模板字符串_ 的，有时为表述方便也非正式地简称为 ES6 模板。

在 ES6 之前的 JavaScript，字符串作为基本类型，其在代码中的表示方法只有将字符串用引号符（单引号 ‘ 或 双引号 “）包裹起来，ES6 模板字面量（下文简称 ES6 模板）则使用反撇号符（\`）包裹作为字符串表示法。

两个反撇号之间的常规字符串保持原样，如：

```javascript
((`hello world` ===
  "hello world" // --> true
  `hello "world"`) ===
  'hello "world"' // --> true
  `hello 'world'`) ===
  "hello 'world'" // --> true
  `\``; // --> "`" // --> true
```

换行符也只是一个字符，因此模板字面量也自然就支持多行字符 ：

```javascript
console.log(`TODO LIST:
    * one
    * two
`);
// TODO LIST:
//     * one
//     * two
```

两个反撇号之间以 `${expression}` 格式包含任意 JavaScript 表达式，该 expression 表达式的值会转换为字符串，与表达式前后的字符串拼接。expression 展开为字符串时，使用的是 `expression.toString()` 函数。

```javascript
const name = "Alice";
const a = 1;
const b = 2;
const fruits = ["apple", "orange", "banana"];
const now = new Date();
console.log(`Hello ${name}`);
console.log(`1 + 2 = ${a + b}`);
console.log(`INFO: ${now}`);
console.log(`Remember to bring: ${fruits.join(", ")}.`);
console.log(`1 < 2 ${1 < 2 ? "✔︎" : "✘"}`);
// Hello Alice
// 1 + 2 = 3
// INFO: Sun May 13 2018 22:28:26 GMT+0800 (中国标准时间)
// Remember to bring: apple, orange, banana.
// 1 < 2 ✔︎
```

正因为 expression 可以是 _任意 JavaScript 表达式_ ，而任意一个模板字符串本身也是一个表达式，所以模板中的 expression 可以嵌套另一个模板。

```javascript
const fruits = ["apple", "orange", "banana"];
const quantities = [4, 5, 6];
console.log(
  `I got ${fruits
    .map((fruit, index) => `${quantities[index]} ${fruit}s`)
    .join(", ")}`
);
// I got 4 apples, 5 oranges, 6 bananas
```

## 与传统模板引擎对比

从目前的几个示例，我们已经掌握了 ES6 模板的基础功能，但已足够见识到它的本领。通过它我们可以很轻易地进行代码重构，让字符串拼接的代码不再充满乱七八糟的单引号、双引号、`+` 操作符还有反斜杠 `\`，变得清爽很多。

于是我们很自然地想到，在实际应用中字符串拼接最复杂的场景——HTML 模板上，如果采用 ES6 模板是否可以胜任呢？传统上我们采用专门的模板引擎做这件事情，不妨将 ES6 模板与模版引擎做对比。我们选择 `lodash` 的 `_.template` 模板引擎，这个引擎虽不像 mustache、pug 大而全，但提供的功能已足够完备，我们就从它的几个核心特性和场景为例，展开对比。

第 1，基本的字符串插值。`_.template` 使用 `<%= expression %>` 作为模板插值分隔符，expression 的值将会按原始输出，与 ES6 模板相同。所以在这一个特性上，ES6 模板是完全胜任的。

- lodash

  ```javascript
  const compiled = _.template("hello <%= user %>!");
  console.log(compiled({ user: "fred" }));
  // hello fred
  ```

- ES6 模板

  ```javascript
  const greeting = data => `hello ${data.user}`;
  console.log(greeting({ user: "fred" }));
  // hello fred
  ```

第 2，字符串转义输出，这是 HTML 模板引擎防范 XSS 的标配功能，其原理就是要将插值表达式的值中包含的 `<`、`>` 这种可能用于 XSS 攻击的字符转义为 HTML Entity。要让 lodash 输出转义后的插值表达式，使用 `<%- expression %>` 语法即可；而如果要使用 ES6 模板方案，就要靠自己实现一个单独的函数调用了。在下面的示例代码中，就定义了简单的 escapeHTML 函数，在模板字符串中调用该函数对字符串进行转义。

在这个特性上，ES6 可以的确可以做到相同的效果，但代价是要自己定义转义函数并在表达式中调用，使用起来不如模板引擎封装好的接口方便。

- lodash

  ```javascript
  const compiled = _.template("<b><%- value %></b>");
  ```

- ES6 模板

  ```javascript
  const entityMap = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
    "/": "&#x2F;",
    "`": "&#x60;",
    "=": "&#x3D;",
  };
  const escapeHTML = string =>
    String(string).replace(/[&<>"'`=\/]/g, s => entityMap[s]);
  const greeting = data => `hello ${escapeHTML(data.user)}`;
  console.log(greeting({ user: "<script>alert(0)</script>" }));
  // hello &lt;script&gt;alert(0)&lt;&#x2F;script&gt;
  ```

第 3，模板内嵌 JavaScript 语句，也就是模板引擎支持通过在模板中执行 JavaScript 语句，生成 HTML。说白了其原理与世界上最好的语言 php 的 idea 是一样的。在 lodash 模板中，使用 `<% statement %>` 就可以执行 JS 语句，一个最典型的使用场景是使用 for 循环在模版中迭代数组内容。

但 ES6 模板中的占位符 `${}` 只支持插入表达式，所以要在其中直接执行 for 循环这样的 JavaScript 语句是不行的。但是没关系，同样的输出结果我们用一些简单的技巧一样可以搞定，例如对数组的处理，我们只要善用数组的 `map`、 `reduce`、`filter` ，令表达式的结果符合我们需要即可。

- lodash

  ```javascript
  /* 使用 for 循环语句，迭代数组内容并输出 */
  const compiled = _.template(
    "<ul><% for (var i = 0; i < users.length; i++) { %><li><%= list[i] %></li><% } %></ul>"
  );
  console.log(compiled({ users: ["fred", "barney"] }));
  // <ul><li>fred</li><li>barney</li></ul>
  ```

- ES6 模板

  ```javascript
  const listRenderer = data =>
    `<ul>${data.users.map(user => `<li>${user}</li>`).join("")}</ul>`;
  console.log(listRenderer({ users: ["fred", "barney"] }));
  // <ul><li>fred</li><li>barney</li></ul>
  ```

在以上这 3 个示例场景上，我们发现 lodash 模板能做的事，ES6 模板也都可以做到，那是不是可以抛弃模板引擎了呢？

的确，如果在开发中只是使用以上这些基本的模板引擎功能，我们可以确实可以直接使用 ES6 模板做替换，API 更轻更简洁，还节省了额外引入一个模板库的成本。

但如果我们使用的是 pug、artTemplate、Handlebars 这一类大而全的模板引擎，使用 ES6 模板替换就不一定明智了。尤其是这些模板引擎在服务器端场景下的模板缓存、管道输出、模板文件模块化管理等特性，ES6 模板本身都不具备。并且模板引擎作为独立的库，API 的封装和扩展性都比 ES6 模板中只能插入表达式要好。

## 走向进阶——给模板加上标签

截至目前介绍的特性，我们可以从上面 HTML 模板字符串转义和数组迭代输出两个例子的代码发现这样一个事实：

_要用 ES6 模板实现复杂一点的字符串处理逻辑，要依赖我们写函数来实现。_

幸运的是，除了在模板的插值表达式里想办法调用各种字符串转换的函数之外，ES6 还提供了更加优雅且更容易复用的方案——带标签的模板字面量（tagged template literals，以下简称标签模板）。

标签模板的语法很简单，就是在模板字符串的起始反撇号前加上一个标签。这个标签当然不是随便写的，它必须是一个可调用的函数或方法名。加了标签之后的模板，其输出值的计算过程就不再是默认的处理逻辑了，我们以下面这一行代码为例解释。

```javascript
const message = l10n`I bought a ${brand} watch on ${date}, it cost me ${price}.`;
```

在这个例子里，`l10n` 就是标签名，反撇号之间的内容是模板内容，这一行语句将模板表达式的值赋给 `message`，具体的处理过程为：

1.  JS 引擎会先把模板内容用占位符分割，把分割得到的字符串存在数组 `strings` 中（以下代码仅用来演示原理）

    ```javascript
    const strings =
      "I bought a ${brand} watch on ${date}, it cost me ${price}".split(
        /\$\{[^}]+\}/
      );
    // ["I bought a ", " watch on ", ", it cost me ", "."]
    ```

2.  然后再将模板内容里的占位符**表达式**取出来，依次存在另一个数组 `rest` 中

    ```javascript
    const rest = [brand, date, price];
    ```

3.  执行 `i18n(strings, ...rest)` 函数，即调用 `l10n`，并传入两部分参数，第一部分是 `strings` 作为第一个参数，第二部分是将 `rest` 展开作为余下参数。

    ```javascript
    const message = l10n(strings, ...rest);
    ```

因此，如果将以上单步分解合并在一起，就是这样的等价形式：

```javascript
const message = l10n(
  ["I bought a ", " watch on ", ", it cost me ", "."],
  brand,
  date,
  price
);
```

也就是说当我们给模板前面加上 `l10n` 这个标签时，实际上是在调用 `l10n` 函数，并以上面这种方式传入调用参数。 `l10n` 函数可以交给我们自定义，从而让上面这一行代码👆输出我们想要的字符串。例如我们如果想让其中的日期和价格用本地字符串显示，就可以这样实现：

```javascript
const l10n = (strings, ...rest) => {
  return strings.reduce((total, current, idx) => {
    const arg = rest[idx];
    let insertValue = "";
    if (typeof arg === "number") {
      insertValue = `¥${arg}`;
    } else if (arg instanceof Date) {
      insertValue = arg.toLocaleDateString("zh-CN");
    } else if (arg !== undefined) {
      insertValue = arg;
    }
    return total + current + insertValue;
  }, "");
};
const brand = "G-Shock";
const date = new Date();
const price = 1000;

l10n`I bought a ${brand} watch on ${date}, it cost me ${price}.`;
// I bought a G-Shock watch on 2018/5/16, it cost me ¥1000.
```

这里的 `l10n` 就是个简陋的傻瓜式的本地化模板标签，它支持把模板内容里的数字当成金额加上人民币符号，把日期转换为 `zh-CN` 地区格式的 `2018/5/16` 字符串。

乍一看没什么大不了的，但设想一下相同的效果用没有标签的模板要怎样实现呢？我们需要在模板之内的日期表达式和价格数字表达式上调用相应的转换函数，即 `${date.toLocaleDateString('zh-CN')}` 和 `${ '¥' + price}` 。一次调用差别不大，两次、三次调用的情况下，带标签的模板明显胜出。不仅符合 DRY（Don’t Repeat Yourself）原则，也可以让模板代码更加简洁易读。

## 超越模板字符串

带标签的模板字面量建立在非常简单的原理上——通过自己的函数，自定义模板的输出值。

```javascript
tag`template literals`;
```

而 ES6 规范没有对这里可以使用的 `tag` 函数做任何限制，意味着 **任何函数** 都可以作为标签加到模板前面，也就意味着这个函数：

- 可以是立即返回的同步函数，也可以是异步的 `async` 函数（支持函数内 `await` 异步语句并返回 Promise）
- 可以是返回字符串的函数，也可以是返回数字、数组、对象等任何值的函数
- 可以是纯函数，也可以是有副作用的非纯函数

所以只要你愿意，A：你可以把 **任意 JavaScript 语句** 放到标签函数里面去；B：你可以让标签函数返回 **任意值** 作为模板输出。有了如此强大的扩展能力，也难怪一开始 ES6 标准中对模板规范的命名是 _Template Strings_，后来正式命名却改成了 _Template Literals_，因为它的能力已经超越了模板字符串，去追求诗和远方了。

当然在实际的使用中还是应该保持理智，不能手里拿着锤子看什么都像钉子。而以下这 5 种应用场景，倒是可以算是真正的钉子。

### 用例 1：使用 `String.raw` 保留原始字符串

`String.raw` 是 ES2015 规范新增的 `String` 对象的静态成员方法，但通常并不作为函数直接调用，而是作为语言标准自带的模板字面量标签使用，用来保留模板内容的原始值。

其作用与 Python 语言中，字符串表达式的引号前加 `r` 前缀效果类似。JavaScript 需要这样的特性，只是刚好用 `String.raw` 实现了它。

```javascript
var a = String.raw`

`
var b === '

'
// a === b -> false
// a.length === 4 -> true
// b.length === 2 -> true
```

`String.raw` 标签在某些场景下可以帮我们节省很多繁琐的工作。其中一个典型的场景就是，实际开发中我们常遇到在不同编程语言之间通过 JSON 文本传输协议数据的情况，如果遇到包含转义字符和 `"` （JSON 属性需用引号）的文本内容，很容易因细节处理不当导致 JSON 解析出错。

而我本人遇到过这样一个真实案例，就是由 Android 终端向 JavaScript 传输 JSON 数据时，有一条数据中用户的昵称包含了 `"` 字符。JavaScript 收到的 JSON 字符串文本为：

```javascript
{"nickname":"枪锅&[{锅}]\"锅\":锅","foo":"bar"}
```

但这里如果直接将内容用引号赋值给 `JSON.parse('{"nickname":"枪锅&[{锅}]\"锅\":锅","foo":"bar"}')` 就会遇到 `SyntaxError: Unexpected token 锅 in JSON at position 22` 的错误，因为单引号中的 `\` 被作为转义字符，未保留在 `input` 的值中。要得到正确的 JSON 对象，使用 String.raw 处理即可：

```javascript
JSON.parse(String.raw`{"nickname":"枪锅&[{锅}]\"锅\":锅","foo":"bar"}`);
// { nickname: '枪锅&[{锅}]"锅":锅', foo: 'bar' }
```

### 用例 2：从标签模板到 HTML 字符串

前面讲到 ES6 模板与模板引擎的对比时，提到模板引擎通过手动 escapeHTML 模板转义不安全的字符的问题。现在我们了解了标签模板之后，可以将外部定义的 escapeHTML 逻辑直接放到标签函数中，这样就不需要在模板中每一个插入表达式前，都调用 escapeHTML 函数了。

```javascript
const safeHTML = (strings, ...rest) => {
    const entityMap = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
        '/': '&#x2F;',
        '`': '&#x60;',
        '=': '&#x3D;'
true}
    const escapeHTML = string => String(string).replace(/[&<>"'`=\/]/g, (s) => entityMap[s]);
    return strings.reduce((total, current, idx) => {
true    const value = rest[idx] || ''
truetruereturn total + current + escapeHTML(value)
    }, '');
}

const evilText = '<script>alert(document.cookie)</script>'
safeHTML`${evilText}`
// "&lt;script&gt;alert(document.cookie)&lt;&#x2F;script&gt;"
```

我们这里实现的 safeHTML 作为 demo 用，并不保证生产环境完备。

你一定想到了，像 HTML 模板这样的常用模板标签一定有现成的 npm 库了。没错， `common-tags` 库就是我们想要的这个库了。`common-tags` 是一个小而精的模板标签库，被包括 Angular, Slack, Ember 等在内的很多大型项目所依赖。它包含了十几个常用的用于字符串模板处理的函数，例如 `html`, `safeHTml` 等，让我们可以偷懒少造一些轮子。

```javascript
const safeHtml = require("common-tags/lib/safeHtml");
const evilText = "<script>alert(document.cookie)</script>";
safeHtml`<div>${evilText}</div>`;
```

`common-tags` 也提供了扩展 API，生成可以让我们更轻松地实现自定义的标签。

### 用例 3：从模板标签到 DOM 元素

`common-tags` 库里包含的 `html` 和 `safeHtm` 模板标签，依然是返回字符串的函数。这意味着如果我们将它用在浏览器端得到了模板值 `output` 字符串，依然要进一步使用 `element.innerHTML = output` 才可以将模板内容渲染到 DOM 元素，显示到界面。

不过既然模板字面量的标签函数可以返回任意值，我们不妨直接再进一步将 `element.innerHTML = output` 语句也放到标签函数中，并将 element 作为返回值。这样一来我们就可以直接用模板字面量的值作为真实的 DOM Element ，并且直接用 DOM API 操作其返回值了。

不出意外，这个想法当然也有人已想到了，`@choojs/nanohtml` 就是做这件事的。`choojs` 是一个还很年轻的前端框架（又来），不过我们今天不讨论它，只看它所包含的 `nanohtml` 。nanohtml 的基本思路可以用这样的 Hello World 来演示：

```javascript
var nanohtml = require("nanohtml");
var element = nanohtml`<div>Hello World!</div>`;
document.body.appendChild(element);
```

除了像代码所示返回 DOM Element，nanohtml 也支持在模板中的插值表达式中插入任意的标准 DOM Element，插入的元素会根据模板 markup 渲染，作为返回值 element 的子元素。

```javascript
var nanohtml = require("nanohtml");
var h3 = document.createElement("h3");
h3.textContent = "Hello World";
var element = nanohtml`<div>${h3}</div>`;
document.body.appendChild(element);
```

### 用例 4：异步操作

结合 ES2017 的 `async` `await` 特性，我们还可以定义一个 async 类型的标签函数，并在函数中调用异步操作以达到。

例如上面实现的傻瓜式 `l10n` 标签，我们可以让它更傻瓜一些，把模板最后拼接出的英文句子，翻译为本地语言之后再输出。而翻译的过程，就可以通过异步调用第三方的翻译 API 例如 Google Translate API 等来实现。于是我们就有这样的伪代码：

```javascript
const l10n = async (strings, ...rest) => {
    return strings.reduce((total, current, idx) => {
        const arg = rest[idx]
        let insertValue = ''
        if (typeof arg === 'number') {
            insertValue = `¥${arg}`
        } else if (arg instanceof Date) {
            insertValue = arg.toLocaleDateString('zh-CN')
        } else if (arg !== undefined) {
            insertValue = arg
        }
        const line = total + current + insertValue
        const language = navigator.language // "zh-CN"
        // 假装 TRANSLATE_SERVICE 是一个可用的翻译服务
        const translated = await TRANSLATE_SERVICE.translate(line, { language })
        return translated
    }, '')
}

l10n`I bought a ${'G-Shock'} watch on ${new Date()}, it cost me ${1000}`.then(console.log)
// "我在 2018/5/16 买了一个 G-Shock 手表，花了我 1000 元"
```

当然在不支持 async、await 也不支持 generator 生成器的环境下，使用 Promise 封装异步调用，使标签函数返回 Promise 实例，也可以实现异步操作。

```javascript
const tag = (strings, ...rest) => {
  return new Promise(resolve => {
    setTimeout(resolve, 1000, "Hello World");
  });
};

tag`Anything`.then(console.log);
// 1s 后 console 将输出：
// "Hello World"
```

### 用例 5：DSL

DSL（领域专用语言）是一个挺唬人的概念，顾名思义所谓 DSL 是指未解决某一特定领域的问题推出的语言。DSL 有按某种条件约束的规则——语法，故称得上是语言。通常 DSL 用于编程领域，通过计算机程序处理 DSL，有些功能强大的 DSL 语言也会被认为是 mini 编程语言。

典型的 DSL 有：

- 正则表达式
- 数据库查询语言（SQL）
- CSS Selector 的规则也是一种 DSL
- 文本处理的瑞士军刀 awk，sed 因为其复杂的使用规则也被认为是 DSL

合理使用 ES6 标签模板，可以让 JavaScript 对内嵌 DSL 的处理更加简洁。严格来说，我们上面用例 2 和用例 3 对中的 `html` 类模板标签，就算是 DSL 的范畴了。下面是一些典型的案例：

> 注意：以下模板标签仅作描述，需要自行实现

#### 案例 1：DOM 选择器

例如我们可以用标签实现一个 DOM 选择器，形如：

```javascript
var elements = query`.${className}`; // the new way
```

虽然第一眼看上去只是另一个 jQuery 选择器，但这种调用方式天然支持我们在模板之中嵌入任意的插值表达式，在 API 的 expressive 这个特性上有提升。而且 query 函数由我们自由实现，意味着可以自由地在 query 函数中加入 selector 值规范化校验，返回值规范化等额外功能。

#### 案例 2：Shell 脚本

在 Node.js 环境下，我们还可以实现一个 `sh` 标签用于描述 shell 脚本的调用：

```javascript
var proc = sh`ps aux | grep ${pid}`;
```

看到这行语句我们下意识地会想到，这里的 API 会调用 shell 执行模板拼接出来的命令，而 proc 应该是该命令执行的结果或输出。

#### 案例 3：正则表达式构造器

以 `re` 标签实现一个动态的正则表达式构造器，这种运行时生成的正则表达式，通常要自己定义函数，并调用 new RegExp 实现。

```javascript
var match = input.match(re`\d+${separator}\d+`);
```

#### 案例 4：国际化与本地化

可以实现这样一个 `i18n` 和 `l10n` 模板标签：约定在模板字符串中的插值表达式 `${expression}` 后，以 `:type` 格式指定 expression 表达式期望的文本显示格式，实现自定义的模板输出功能。

```javascript
var message = l10n`Hello ${name}; you are visitor number ${visitor}:n!
You have ${money}:c in your account!`;
```

这里的 `l10n` 标签与我们在上文 hard-code 的版本相比，增加了 `:type` 标识符以表示类别，例如 `:n` 表示数字，`:c` 表示货币。这些类型标识符的规则可以在 `l10n` 的实现代码中约定。而这个**约定**的意味就有点自行定义 DSL 的味道了。

以上 4 个 case 的共同点是，我们首先约定了有相似模式的 API 接口，它们都表现为带标签的模板的形式——一个模板名后跟模板内容。

虽然我们作为实现者知道，实际上在调用标签模板时，本质上是将模板内容重组为 `(strings, ...rest)` 形式再传给标签函数调用的。但这样的 API 调用看上去却很像是只有一个函数和一个参数，让人一眼看到就能猜出来 API 的用途。

好的 API 应当有良好的**自我描述性**，将复杂的实现细节封装起来，并且尽量**专注做好一件事**。从这个角度来说带标签的 ES6 模板非常适合处理 JS 内嵌的 DSL，甚至可以帮助我们在特定的业务逻辑中实现一个 mini DSL。

## 更多探索

以上就是对 ES6 模板语法和实用价值的介绍。讲到实践，得益于其原理的简洁，我们可以立即享受到它带来的好处。在 Node.js 环境下，毫无疑问我们可以立即使用不用迟疑；在浏览器环境下，使用我们的老朋友 Babel 就可以将其转换为兼容的 ES5 代码。

总结起来，ES6 模板中最激动人心的特性还是标签，小小的标签用简单的原理提供了异常丰富的扩展能力，颇有点四两拨千金的感觉。基于它，JavaScript 社区已经产生了很多新的想法并产生了很多实实在在的工具库。

除了我们在前面示例中有简单提到 `common-tags` 和 `nano-html` 两个库，也有很多实现了特定领域功能的标签库，例如 SQL 相关的、国际化和本地化相关的，用 tagged template literals 这几个关键词在 npm 搜索就可以找到别人造的轮子。

社区关注量最大的探索还是集中在将模板字面量与 HTML 模板的结合上，有 3 个代表性的框架致力于采用 template literals 的方案并结合其他 good stuff 实现可以媲美 Virtual DOM 的快速渲染方案。

- [hyperHTML](https://github.com/WebReflection/hyperHTML) 旨在成为 Virtual DOM 替代品的仓库，在官方文档中明确直出，其核心理念就是采用 ES6 模板 作为 Virtual DOM Alternative
- [lit-html](https://github.com/Polymer/lit-html) Google Polymer 团队推出的库，理念与 hyperHTML 类似，结合了 ES6 模板和 HTML `<template>` 元素的优点，实现 DOM 元素的快速渲染和更新
- [choojs](https://github.com/choojs/choo) 一个 minify+gzip 后只有 4KB 的现代前端开发框架，与 hyperHTML 和 lit-html 不同，是一个更加全功能的框架，目前（2018 年 5 月）Star 数比前两者都多

这 3 个框架的共同点是都采用了 tagged template literals，并且放弃使用 Virtual DOM 这种现在非常火爆的概念，但号称一样能实现快速渲染和更新真实 DOM。从各自提供的数据上看，也的确都有着不俗的表现。碍于篇幅在这里我们就不再展开讨论了。

这些框架的也反映出 ES6 模板的确潜力很大，更深入的就留给我们未来探索，以下这些文章都是不错的参考。

- [模板字符串 - MDN 文档](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/template_strings)
- [What can you do with ES6 string template literals? - dherman/template-literals.md](https://gist.github.com/dherman/6165867)
- [Template strings: embedded DSLs in ECMAScript 6](http://2ality.com/2011/09/quasi-literals.html)
- [ES6 Template Literals, the Handlebars killer?](https://www.keithcirkel.co.uk/es6-template-literals/)
- [lit-HTML 在 Chrome Dev Summit 2017 上的演示](https://www.youtube.com/watch?v=Io6JjgckHbg)
- [Efficient, Expressivelit-HTML 在 Polymer Summit 2017 上的演示](https://www.youtube.com/watch?v=Io6JjgckHbg)
- [hyperHTML 与 lit-html 对比](https://gist.github.com/WebReflection/fadcc419f5ccaae92bc167d8ff5c611b)
- [hyperHTML 与 Virtual DOM 对比](https://www.zeolearn.com/magazine/hyperhtml-vs-vdom)
- [Choo 框架架构与性能介绍](https://medium.com/choojs/choo-architecture-performance-f6f0c44e8a6a)
