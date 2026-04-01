---
title: 使用环境变量和 .env 文件更好地管理应用配置
author: rianma
pubDatetime: 2021-03-10T00:00:00Z
slug: environment-variables-and-dotenv
featured: false
draft: false
tags:
  - node.js
  - dotenv
description: "为什么 if (NODE_ENV === 'production') 是不好的代码，以及如何用环境变量和 dotenv 解决它。"
---

# 使用环境变量和 .env 文件更好地管理应用配置

## 代码中的坏味道之：硬编码的配置

一个典型的 Web 类型业务项目，都会部署到多个环境中，通常包括 test 环境、预发布环境、线上稳定运行的生产环境。所以我们在项目开发过程中，往往会遇到不同环境下需使用不同「配置」的场景。

首先我们举一个最简单的例子，前端页面使用了某个 JS SDK（通过 index.html 中的外联 script 标签加载），而 SDK 同时提供了测试、正式两个版本的包，用来隔离测试环境和生产环境的数据。

于是我们可能看到这样的模板代码：

```javascript
<% if (process.env.NODE_ENV === 'production') { %>
  <script src="//cdn.example.com/v1/.../mtdframe/index.js"></script>
<% } else { %>
  <script src="//cdn.example.com/v1/.../mtdframe-test/index.js"></script>
<% } %>
```

与之类似的还有这样的 JS 代码片段：

```javascript
// static-server.js
return {
  template:
    process.env.NODE_ENV === "development"
      ? resolve(__dirname, "../src/index.ejs")
      : resolve(__dirname, "../dist/thunder.ejs"),
  data: {
    env: process.env.NODE_ENV,
    env_dev: process.env.NODE_ENV !== "production",
    noThunder: process.env.NODE_ENV === "development",
    hotdog_appkey:
      process.env.NODE_ENV !== "production"
        ? `com.example.app.test`
        : `com.example.app`,
  },
};
```

第二个例子，当我们在使用 Node.js 开发一个简单的后端服务，该服务需要在不同的部署环境下，使用对应环境的 S3 租户信息，并调用对应环境的 S3 Endpoint API。于是我们在代码中维护了一个完整的配置表：

```javascript
// config.s3.js
const configMap = {
  dev: {
    Host: "http://s3.example-test.internal",
    AK: "ABC",
    SK: "XYZ",
  },
  test: {
    Host: "http://s3.example-test.internal",
    AK: "ABC",
    SK: "XYZ",
  },
  production: {
    Host: "http://s3.example.internal",
    AK: "ABC",
    SK: "XYZ",
  },
};

const nodeEnv = process.env.NODE_ENV || "development";
module.exports = configMap[nodeEnv];
```

以上两段代码看起来很简单，但魔鬼都在细节中，我们会发现这样几个问题：

1. 第一个例子的条件语句模式，不可避免地需要在代码中出现很多类似 `if (NODE_ENV === 'production')` 的条件语句，这样的代码在配置项多了之后，不仅代码可读性降低，也不利于维护复杂的环境与配置项映射信息。

2. 第二个例子，维护一个 `configMap` 的模式相比第一种方案是一种提升，但这种模式需要我们在 configMap 中穷尽所有的 `NODE_ENV` 类型——如果某天我们需要新部署一个叫 `pre-prod` 的环境，就需要在这里的 configMap 中新增一个条目。

归根结底，这两种模式共同的根本性问题是：**将代码与配置混淆在了一起**，本质上这是一种硬编码。（评估是否硬编码的一个原则就是：如果我们需要修改某个配置项，而不变更业务逻辑，是否需要修改 Git 仓库中的源代码？）

另外值得一提的是，第二个例子中还隐含了一个安全隐患问题：SK 属于机密信息，将 SK 信息直接 check in 到代码仓库，是一种不可忽视的安全风险。

## 解决方案：将配置提升到环境变量中

那么如何解决这类问题呢？有一个很简单的解决方案：**使用环境变量**，将与环境相关的配置向上「提升」到环境变量中即可。

在 Node.js 中，环境变量可以通过 `process.env.VAR_NAME` 的方式读取到，改造步骤也很简单：

1. 整理代码中所需要的配置项，为每一个配置项创建一个环境变量名（惯例是使用全大写字母风格命名，即 `UPPER_CASE` 形式）
2. 修改业务代码，全部使用 `process.env.VAR_NAME` 读取这些配置

我们开篇提到的问题，就可以改造成这样的代码：

```javascript
// config.s3.js
const config = {
  Host: process.env.S3_HOST,
  AK: process.env.S3_AK,
  SK: process.env.S3_SK,
};

module.exports = config;
```

在执行时，就需要保证这几个环境变量已存在：

```shell
# 使用 export 命令在 Shell 会话中设置环境变量
export S3_HOST="http://s3.example-test.internal"
export S3_AK="ABC"
export S3_SK="XYZ"
node main.js

# 或直接在 node 命令前通过 VAR_NAME=value 的形式设置
S3_AK="ABC" S3_SK="XYZ" node ./main.js
```

改造后的代码，代码已经不对配置项的值负责了，配置值的维护职责转移到了**代码仓库的使用者**：

- 在程序员使用 PC 进行本地开发时，使用者就是程序员自己，程序员需要在 Shell 调用 node 进程时设置好环境变量
- 在 CI/CD 环境中，使用者就是 CI/CD 系统的"运行时"环境，一般的 CI/CD 系统都会向用户提供设置环境变量的功能

（大多数 CI/CD 平台都会提供环境变量配置的界面，例如在发布流水线中设置不同环境的配置项。）

> Tip：环境变量中不应该包含两个功能相同、却属于不同环境的互斥配置项，例如下面这种代码，就是一个错误示范：
>
> ```javascript
> <% if (process.env.NODE_ENV === 'production') { %>
>   <script src="<%= process.env.OWL_SDK %>" />
> <% } else { %>
>   <script src="<%= process.env.OWL_DEV_SDK %>" />
> <% } %>
> ```

## 使用 dotenv 将 .env 文件中的配置加载到环境变量中

当然，维护环境变量的职责转移给了调用方之后，我们就会遇到另一个现实问题：程序依赖的环境变量太多，程序员启动进程时要记住每一个环境变量并提供配置值，实在是不切实际，忘记某个环境变量是常有的事。

针对这个问题，最简单的方法就是在代码中为每一个依赖的环境变量以硬编码的方式指定一个默认值——但通常情况下，复杂的应用会依赖越来越多的环境变量，动辄就有一二十项。

此时我们自然就想到：**如果有一个文件可以集中提供默认的环境变量就好了！**

——接下来要介绍的 `.env` 文件就是起到了这样的作用。

### 认识 .env 配置文件

`.env` 文件存放在项目的根目录中，格式是一个纯文本文件，内容是以下格式的简单键值对配置：

```shell
# .env
S3_HOST=http://s3.example-test.internal
S3_AK=ABCDEFG
```

**改造步骤：**

Step 1. 在项目根目录下创建一个 `.env` 文件，使用 `KEY=VALUE` 的格式设置若干配置项

Step 2. 安装 dotenv 库

Step 3. 在脚本的最上方调用 `require('dotenv/config')` 即可

```javascript
// main.js
require("dotenv/config");
const s3Config = require("./config.s3.js");
console.log(s3Config.Host); // 输出: http://s3.example-test.internal
console.log(s3Config.AK); // 输出: ABCDEFG
```

值得一提的是，如果在调用 `node main.js` 的 Shell 环境中，已经存在了与 `.env` 文件中同名的环境变量，那么 dotenv 会默认直接使用已有的环境变量，而忽略掉 `.env` 文件中定义的值。

这个原则可以总结为：**Shell 中已有的环境变量是最高优先级的。**

### 多环境 .env 文件模式 —— 以 Vue CLI 模式为例

除了使用单个 `.env` 文件以外，还有一种模式是针对不同环境创建各自的 `.env*` 文件，通常命名为 `.env.development`、`.env.production` 等模式。

这一模式的最著名践行者就是 Vue CLI 项目，Vue CLI 在构建一个前端项目时，可以通过 `--mode` 参数指定构建模式：

```shell
vue-cli-service build --mode production
```

在多个 `.env` 文件的优先级问题上，Vue CLI 的处理逻辑如下（越往下优先级越高）：

```
.env                # 在所有的环境中被载入
.env.local          # 在所有的环境中被载入，但会被 git 忽略
.env.[mode]         # 只在指定的模式中被载入
.env.[mode].local   # 只在指定的模式中被载入，但会被 git 忽略
```

但即便是 `.env.[mode].local` 文件中的环境变量，**优先级依然没有 Shell 中已有的环境变量优先级高。**

如果你自己也需要在项目中实现类似 Vue CLI 的多环境 `.env` 配置文件模式，可以选择 [dotenv-flow](https://npm.im/dotenv-flow) 这个库来实现。

## 从方法到方法论：我们能从一个小小的工具学到什么

### 12-Factor 的启示：配置与代码分离思想

The Twelve-Factor App 是由 Adam Wiggins 提出的编写现代 SaaS 应用的最佳实践，包含了 12 条要素，对于任何后端应用乃至前端应用构建都有很好的借鉴意义。

12-Factor 的开篇第一要素就提到了：**一份基准代码（Codebase）、多份部署（Deploy）**。

![12-Factor Codebase 示意图](images/environment-variables-and-dotenv/12factor-codebase.png)

正如图中所示，同一套基准代码部署到不同的环境下，就得到了多个 Deploy，每个 Deploy 可以理解为运行了一个**应用实例**。而决定了两个实例运行不同的地方，就是**配置**。

这正是**代码与配置分离**思想的体现，这样一来对配置项的关注，就全部收敛到环境变量这个层级中，简单而直接。

### 在较高层级放置可配置数据

这是《Clean Code》一书中提到的一条设计原则，也就是说如果某一个程序的配置项影响程序运行行为，那么该配置项要在较高层级配置。

区分高层级和低层级的原则是什么？一个小 Tip 是：**离用户（使用者）越近层级越高，离用户越远层级越低。**

### 文本/字符串往往是更简单和通用的数据通信格式

在 [POSIX 标准](https://zh.wikipedia.org/zh-hans/可移植操作系统接口)中，[环境变量的值是字符串格式](https://pubs.opengroup.org/onlinepubs/009696899/basedefs/xbd_chap08.html)。为什么是字符串而不是其他格式？这背后反映的是一个朴实无华的哲学：**字符串是最简单的数据通信格式，虽然它不是性能最好的方式。**

这一点在《UNIX 编程艺术》一书中提到的可组合性原则也是相通的。Unix 编程鼓励开发者开发可以与其他程序组合在一起的程序，不同程序通过管道的形式通信——最常见的通信数据格式就是文本。

## 为什么有时 .env 不是最好的选择？

目前为止我们对 dotenv 的介绍，实际上都是针对部署多环境的 Web 应用，并且需要在不同环境中维护不同配置的场景，这也就是 `.env` 模式最适合的场景了。

如果不是这样的场景，通常有其他更好的方案可以选择。

一个典型的场景是在开发 CLI 工具类软件时，通常需要考虑用户在不同路径下执行 CLI 命令，能够采用不同的配置。针对这样的诉求，使用 `.*rc` 配置文件是更好的方案。

前端开发人员最熟悉的 npm 工具就采用了这种模式：npm 支持多个级别的 `.npmrc` 配置文件。用户 HOME 目录中可以提供一个 `~/.npmrc` 文件，项目根目录也可以提供一个 `.npmrc` 文件，命令行参数也可以指定 `--registry` 这样的参数，三个配置源的优先级从低到高排列：

```shell
# 在 ~/.npmrc 中指定源为 npm 官方源
registry=https://registry.npmjs.org/

# 在 ~/my-app/.npmrc 中指定源为公司内部私有源
registry=http://npm.example-internal.com/
```

如果你也想实现类似 `.npmrc` 的多级别配置方案，[rc](https://npm.im/rc) 库是更好的选择。

## 参考资料

- [模式和环境变量 | Vue CLI](https://cli.vuejs.org/zh/guide/mode-and-env.html)
- [dotenv - npm](http://npm.im/dotenv)
- [dotenv-flow - npm](http://npm.im/dotenv-flow)
- [rc - npm](https://npm.im/rc)
- [The Twelve-Factor App（简体中文）](https://12factor.net/zh_cn/)
- [Clean Code - 代码整洁之道 / [美]Robert C. Martin](https://book.douban.com/subject/4199741/)
- [UNIX编程艺术 / [美]Eric S·Raymond](https://book.douban.com/subject/5387401/)
