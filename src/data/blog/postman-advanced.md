---
title: Postman 高级使用技巧
author: rianma
pubDatetime: 2024-03-25T00:00:00Z
slug: postman-advanced
featured: false
draft: false
tags:
  - postman
  - api
  - testing
description: "Postman 高级功能使用技巧，包括环境变量、Pre-request 脚本、自动化测试等，解锁 API 调试新姿势。"
---

# Postman 高级使用技巧

Postman 是非常常用的 HTTP 请求调试工具，具备友好的界面、丰富的功能，相信大家已经很熟悉 Postman 基本的发送请求、查看响应功能了。但同时 Postman 还提供了许多高级功能，可以帮助我们更有效地进行 API 开发和测试。

本文将分享一些 Postman 的高级使用技巧，结合个人开发后端接口的实际应用场景，帮助你解锁 API 调试的新姿势。

## 环境变量、全局变量与集合变量

变量可以让你在不同的请求中重用数据，避免重复输入。Postman 支持三种类型的变量：

- **全局变量:** 在整个工作空间中可用（使用频率较低）
- **环境变量:** 在特定环境中可用（通过环境准备，用于 test/prod 等，不同环境有不同取值的场景）
- **集合变量:** 在特定集合中可用（Collection），常用于一个变量在同个 Collection 中多个请求中都需要使用的场景

不论以上哪种变量，都可以通过 `{{变量名}}` 的形式来获取到。

**实际应用场景**

- 调试多套环境（如 dev/test/staging/prod）的 API 时，为每个环境创建一整套环境变量集合，在调试时只需直接切换右上角的"环境"即可调试不同环境的接口。
- 在调试某模块的接口时，常常需要使用某些业务标识（appkey 等）调试多个接口，此时使用 Collection 的变量就可以快速切换。

## Pre-request 脚本

Pre-request 脚本**在请求发出前**执行，最常用的是需要动态计算或修改请求参数时，可以手动编写 JS 脚本实现。

例如某些内部接口需要在请求头中携带经过 Base64 编码的用户身份信息作为认证凭据。

在调试时，就可以使用以下 Pre-request 脚本，使 Postman 在发送请求前，动态获取 operator 参数，再进行如下计算，得到对应的认证请求头：

```javascript
const operator = pm.collectionVariables.get("operator");

const userInfo = {
  login: operator,
};

const source = JSON.stringify(userInfo);
const encoded = CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(source));

console.log(encoded);

pm.collectionVariables.set("authHeader", encoded);
```

## Test 脚本

Test 脚本**在收到响应后**执行，核心功能是用 JS 编写断言，验证请求是否成功等，或可视化响应内容。

例如最常见的脚本为：

```javascript
pm.test("Status code is 200", function () {
  pm.response.to.have.status(200);
});
```

除了手动编写 test 断言代码，Postman 从去年底开始集成了非常智能的 AI 辅助功能，在编写 test 脚本时可以直接用自然语言（仅支持英文）描述需求，自动生成对应的测试用例。

## 在 Test 脚本中可视化输出结果

Postman 的 test 脚本还提供了 Visualizer（可视化）功能，支持将 API 响应数据以直观易懂的方式呈现给用户，方便开发者更好地理解 API 接口的数据结构和内容。

使用方式：直接在请求的 test 标签页，用 `pm.visualizer.set($template, $data)` 实现即可。

```javascript
pm.visualizer.set(
  `
  <table border="1">
    <thead>
      <tr>
        <th>名称</th>
        <th>值</th>
      </tr>
    </thead>
    <tbody>
      {{#each response.data}}
      <tr>
        <td>{{name}}</td>
        <td>{{value}}</td>
      </tr>
      {{/each}}
    </tbody>
  </table>
  `,
  {
    response: pm.response.json(),
  }
);
```

与 test 脚本编写断言类似，Visualizer 功能也可以通过 Postman 的 Postbot AI 辅助工具用自然语言自动生成模板代码。在 WebStatic 项目中，最常用此功能以调试列表页形式的接口。

## 批量测试 API 请求

在开发部分功能时，需要构造出多种不同的请求参数，作为测试用例，观察响应的结果是否符合预期。此时，就可以使用 Postman 的"批量运行请求"功能，自动化地执行多个接口的测试用例，并给出完整的测试结果报告，代替人工逐个发送请求的繁琐步骤。

**实际应用场景：** 在开发泳道灰度相关需求时，存在着泳道、灰度、主干分别命中等 10 多种 case 需要测试与回归验证。对此为每一种 case 编写了对应的请求和 test 脚本，批量执行即可。

## 批量执行请求，并循环提供多个参数

在上一个功能的基础上，Postman 还支持重复运行请求，并且每次传入不同的参数，实现类似 JS 中使用 `Promise.all()` 遍历数组、循环执行某请求的效果：

```typescript
const list = ["appkey1", "appkey2"];

await Promise.all(
  list.map(async appkey => {
    const res = await fetch(`${url}?appkey=${appkey}`);
    return res;
  })
);
```

**使用方式：**

1. 编写请求时，将要循环遍历的参数用 `{{foo}}` 的形式表示出来
2. 点击请求所在目录右侧的菜单 "Run folder"，打开 Runner 页
3. 在 "Data" 上传 csv/json 文件，文件内容需要是 JSON 数组或 csv 表格格式，数组成员包含对应字段即可

例如 `appkey.csv` 内容如下：

```
appkey,note
com.example.myapp,123
com.example.myapp2,456
```

## 与浏览器共享 Cookie

在部分场景下，调用 API 接口需要携带有效的登录态 Cookie（如 login_token），此时可以通过安装 [Postman interceptors 扩展（Chrome 浏览器）](https://chromewebstore.google.com/detail/postman-interceptor/aicmkgpgakddgnaphhhpliifpcfhicfo)，将浏览器中的 Cookie 同步到 Postman 软件。

**操作步骤：**

1. 点击请求右侧的 Cookies 按钮，打开 Cookie 管理弹窗
2. 如果未安装 Postman Interceptor 扩展，根据界面引导完成扩展安装与配置
3. 安装并连接 Interceptor 扩展后，在 Sync Cookies 标签页可以看到连接状态，再添加要同步 Cookie 的域名
4. 再次发送请求，即可携带对应的 Cookie

## 其他功能

- [Postman Flows](https://www.postman.com/product/flows/)
- [Postman Mock Server](https://learning.postman.com/docs/designing-and-developing-your-api/mocking-data/setting-up-mock/)
