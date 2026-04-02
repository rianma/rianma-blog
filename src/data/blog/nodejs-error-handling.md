---
title: Node.js 服务端开发异常处理最佳实践
author: rianma
pubDatetime: 2024-06-13T00:00:00Z
slug: nodejs-error-handling
featured: false
draft: false
tags:
  - node.js
  - error-handling
  - backend
description: "Node.js 服务端异常处理的原则与最佳实践，涵盖如何正确抛出、捕获、记录和响应异常。"
---

# Node.js 服务端开发异常处理最佳实践

## 原则

1. **不要吞掉异常**：所有异常都应当被捕获到，并做相应的处理（避免未捕获的异常、uncaughtException）
2. **用户友好**：用户应当看到友好的、准确的、信息量充分的错误信息
3. **开发者友好/机器友好**：错误信息应当包含足够的技术细节（traceId、错误码等），方便开发人员分析和定位问题、也方便机器（第三方服务、前端代码等）识别不同异常
4. **异常必须有迹可循**：日志与监控是异常处理必不可少的环节

## 最佳实践

### 1. [建议] 函数执行异常时，应当 throw error，而不是吞掉异常让函数 return

99% 的情况下，程序发生了异常都是不可接受/不可降级的，不要默默地 catch 住异常然后吞掉，而应当直接抛出异常！避免函数已经调用失败了，还返回一个对象。

**反例：**

```javascript
const foo = () => {
  try {
    // dosomething()
    return { success: false, error: null };
  } catch (error) {
    // 捕获住异常之后，不 throw 却 return
    return { success: false, error };
  }
};
```

**正例：**

```javascript
const foo = () => {
  try {
    // dosomething()
    return { success: false, error: null };
  } catch (error) {
    // 捕获住异常之后，可以打日志，给 error 对象附加一些上下文、增加自定义属性等，但 99.99% 的情况一定要抛出！
    const customError = new Error("xxx", { cause: error });
    throw customError;
  }
};
```

**1% 的例外：**

- 捕获异常后，应用程序需要触发降级逻辑的：例如服务有一个动态配置放在配置中心（如 Nacos/Apollo 等）上，获取配置失败后希望降级到本地配置文件，就可以捕获异常后降级到读取文件：

  ```javascript
  async getXXXConfig () {
    try {
      const config = await configCenter.getXXXConfig()
      return config
    } catch (error) {
      // 将 "获取配置异常" 异常记录下来！
      apmSdk.logError('ConfigCenterGetConfigFailed', error)
      return DEFAULT_CONFIG_VALUE
    }
  }
  ```

  > 但即使是可降级的逻辑，也还是需要将异常记录并上报（参考最佳实践 8）

- 专门用于处理异常的兜底函数：例如 Koa/Express App 中，专门用来捕获异常、然后构建出友好的 error message 再返回 HTTP Response 给用户的中间件。

### 2. [强制] throw 的对象必须是 Error 或 Error 的子类

禁止将 string、number 等类型的错误用 throw 抛出，详细参考 [ESLint Rule: no-throw-literal](https://eslint.org/docs/latest/rules/no-throw-literal)。

建议直接在 `.eslintrc` 中配置规则：

```json
{
  "rules": {
    "no-throw-literal": "error"
  }
}
```

### 3. [建议] 借助 verror 库，创建带有详细上下文的错误对象

在 JS 中，基本的 Error 对象支持 name, stack, cause 等上下文信息。[verror](https://www.npmjs.com/package/verror) 库可以用来自定义错误信息、封装已有 Error 并附带更多其他信息。

VError 的核心功能是针对调用链为 A→B 这样的场景，如果 B 发生了错误，A 作为调用方可以用 verror 将 B 抛出的异常与自身调用时的一些信息拼接起来。这样新的 Error 对象既包含了根因（B抛出的异常），也包含了 A 在调用时传递的一些上下文信息。

```javascript
const VError = require("verror");

// 创建基本错误
const err1 = new Error("something went wrong");

// 使用 VError 包装原始错误，并添加上下文信息
const err2 = new VError(
  err1,
  "failed to process request for user %s",
  "user123"
);

console.error(err2.message); // 输出: failed to process request for user user123: something went wrong
console.error(err2.cause()); // 输出: Error: something went wrong
console.error(err2.stack); // 输出完整的错误堆栈信息，包括原始错误堆栈
```

VError 库在处理多层调用链的错误时非常实用，推荐在 Node.js 服务端项目中引入。

### 4. [建议] 编写友好的错误信息 error message

好的 error message 应尽量做到：

- 精确描述问题根因
- 包含足够的上下文信息
- 描述解决方案：例如 "xxx 无权限操作某某项目，请前往哪里哪里申请权限"

建议参考 [Google 技术协作指南：错误处理](https://developers.google.com/tech-writing/error-messages/error-handling)。

### 5. [强制] 对 API 接口异常响应，制定统一的数据结构

使用一致的返回体结构有利于调用方采取统一的错误处理逻辑。

例如：

```typescript
{
  "code": number;
  "data": ResponseDataType;
  "message": string;
}
```

此格式只是范例，不一定每个项目都用这样的结构，但每个项目内部必须要保持一致！

### 6. [建议] 使用符合 HTTP 规范的状态码

建议成功响应直接返回 200，客户端类异常响应 4xx，服务端异常响应 5xx。

不推荐使用 200 状态码表示异常的原因：

- 不符合 HTTP 协议规范
- 使用 Chrome 浏览器调试时，4xx、5xx 状态码的请求会直接标红，便于快速发现问题并调试

推荐相关工具库：[http-errors](https://www.npmjs.com/package/http-errors)

参考：[MDN - HTTP 状态码](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status)

### 7. [建议] 列举常见的、可预测的异常，并分配独特的错误码

原因：

- 看到错误码后可以快速识别根因
- 对于调用者，可以针对不同的异常做不同的处理（例如针对部分异常可以重试、有些异常不需要重试等），比判断 error message 要健壮得多

理论上使用唯一的字符串作为错误码可以提供更好的可读性。

参考：[微软 Azure 云常用错误码](https://learn.microsoft.com/en-us/rest/api/storageservices/common-rest-api-error-codes)

更好的做法是把代码中的错误码，用自动化的方式同步到文档中。

### 8. [强制] 记录下每一个异常，即使是可忽略或可降级的异常

实践中推荐使用 logger 记录日志，并结合 APM 监控 SDK（如 SkyWalking、Datadog 等）进行错误上报。

- logger 可以用框架自带的 logger，或使用 [log4js](https://npm.im/log4js)
- APM 监控可使用 SkyWalking、Datadog 等 APM SDK 进行错误上报

### 9. [建议] Koa 应用: 使用 ctx.throw/ctx.assert 抛出标准 HTTP 异常，并使用统一的异常处理中间件处理

Koa 本身封装了 [http-errors](https://npm.im/http-errors) 库专门用来生成异常的 HTTP 响应。

**使用方式：**

1. 在 Controller 或 Router 中，捕获到业务代码逻辑的异常后，使用 `ctx.throw` 抛出异常：

   ```javascript
   async function routeFoo(ctx) {
     try {
       const body = await doSomething();
       ctx.body = body;
     } catch (error) {
       ctx.throw(500, error, { expose: true, data: {}, code: 1234 });
     }
   }
   ```

2. 开发一个通用的 `errorHandler` 中间件，专门用于捕获 Controller/Router 抛出的 http error 对象：

   ```javascript
   async function errorHandlerMiddleware(ctx, next) {
     try {
       await next();
     } catch (err) {
       ctx.logger.error("[ERROR_HANDLER]", err);
       ctx.apm?.logError("ErrorResponse", err); // 使用 APM SDK 上报错误（如 SkyWalking、Datadog 等）
       ctx.app.emit("error", err, app);

       const {
         status = 500,
         expose = true,
         message,
         code = -1,
         data = null,
       } = err;
       const msg = expose ? message : "Internal Server Error";

       ctx.status = status;
       ctx.type = "json";
       ctx.body = {
         code,
         message: msg,
         data,
       };
     }
   }
   ```

## 参考资料

- [微软 Azure 通用 REST API 错误码](https://learn.microsoft.com/en-us/rest/api/storageservices/common-rest-api-error-codes)
- [Google 错误处理指南](https://developers.google.com/tech-writing/error-messages/error-handling)
- [Postman 异常处理最佳实践](https://blog.postman.com/best-practices-for-api-error-handling/)
