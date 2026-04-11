---
title: "我怎么用 Claude Code"
author: rianma
pubDatetime: 2026-04-10T00:00:00Z
slug: how-i-use-claude-code
featured: false
draft: true
tags:
  - ai
  - claude-code
  - tooling
  - developer-experience
description: "用 Claude Code 做日常开发一段时间后，我对任务分级、模型选择、成本控制的一些实践和思考。"
---

# 我怎么用 Claude Code

作为一个每天都在用 Claude Code 写代码的人，我最初的用法跟大多数人一样：打开终端，跟 Claude 对话，让它帮我改代码、跑测试、修 bug。但用了一段时间之后，我发现一个问题：**不是所有任务都值得用同一个模型、同一种方式来做。**

让 Opus 帮你 merge 一个分支然后盯着 CI 跑完，跟让 Opus 帮你做架构设计，消耗的资源是完全不一样的——但前者根本不需要那么强的推理能力。这就像你用一把瑞士军刀来拧螺丝，能用，但没必要。

这篇文章是我对 Claude Code 使用方式的一些整理：怎么给编码任务分级、怎么选模型、怎么用 subagent 来降本增效，以及过程中踩过的几个坑。

## 1 任务分级

日常的编码工作，按需要的推理深度大致可以分成四个层级：

### 1.1 机械操作（Tier 1）

不需要什么判断力，按流程执行就行：

- 合并分支、推送、等 CI 跑过
- 修 typo、格式化代码
- 版本号升级
- 重跑 flaky test

**特征：** 流程固定，没有决策分支，几条命令就能搞定。

### 1.2 简单任务（Tier 2）

有明确意图，改动范围小：

- 改一个文件里的几行代码
- 读一个文件理解上下文
- 创建一个标准的 commit
- 基础调试（"在这里加个 console.log"）

**特征：** 意图清晰，改动 < 3 个文件、< 50 行，决策空间小。

### 1.3 常规开发（Tier 3）

日常开发的主力场景：

- 跨文件重构
- 从明确的 spec 实现一个小功能
- 给现有代码写单元测试
- code review
- 定位一个已知类型的 bug

**特征：** 需要理解多个文件的关系，3-10 个文件，有一定设计选择。

### 1.4 复杂/架构级（Tier 4）

需要深度推理和权衡：

- 架构设计和 PR 影响分析
- 原因不明的 bug 排查
- 大范围重构
- 性能优化
- 安全分析

**特征：** 范围不确定，需要权衡利弊，影响跨模块。

## 2 模型选择

Claude Code 可以用三个模型：Haiku、Sonnet、Opus。在 Pro 订阅下，它们有实际区别。

### 2.1 不同模型的代价不同

Anthropic 并没有公开说明 Pro 订阅下每个模型具体消耗多少用量配额，但从 API 定价可以推断出大致比例：

| 模型 | API 输入价格 | API 输出价格 | 相对成本 |
|------|-------------|-------------|---------|
| Haiku 4.5 | $1/MTok | $5/MTok | 1x |
| Sonnet 4.6 | $3/MTok | $15/MTok | 3x |
| Opus 4.6 | $5/MTok | $25/MTok | 5x |

在 Pro 订阅下，Opus 会比 Haiku 更快地消耗你的用量配额。超出配额后的额外用量按 API 价格计费，此时模型之间的成本差异就是直接的。

**结论：** 用 Haiku 做 Tier 1 任务，不仅更快，还能实实在在地省配额。

### 2.2 不要在会话中途切换模型

这是一个很容易踩的坑：你正在用 Opus 工作，突然需要做一个简单的 merge，于是 `/model haiku` 切到 Haiku，做完了再 `/model opus` 切回来。

**问题在于：每次切换模型都会打破 prompt cache。**

Claude Code 的 prompt cache 是基于前缀匹配的。当你切换模型时，模型标识符变了，整个 cache 失效——你需要为这一轮对话重新支付全部上下文的 token 成本。切回去的时候，cache 又失效一次。

如果你的对话上下文已经很大（比如已经读了很多文件、跑了很多命令），两次 cache 失效带来的额外成本可能比你省下的还多。

Claude Code 团队的建议是：**不要在会话中途切换模型。**

### 2.3 用 Subagent 来隔离模型

既然不能在会话中途切换模型，那怎么在同一个工作流中用不同的模型？答案是 **subagent**。

Subagent 的关键特性：

- **独立的 context window**：subagent 有自己的对话上下文，跟父会话完全隔离
- **独立的 prompt cache**：subagent 的模型切换不会影响父会话的 cache
- **结果隔离**：subagent 内部的中间过程（CI 日志、git diff 输出等）不会污染父会话的上下文
- **只返回摘要**：父会话只收到 subagent 的最终结果

对比一下三种方案：

| 方案 | 对父会话 cache 的影响 | 成本效率 |
|------|---------------------|---------|
| `/model haiku` 切换 | 打破 cache 两次 | 上下文大时可能更贵 |
| Skill 配置 `model: haiku` | 可能同样打破 cache | 不确定 |
| **Subagent（Haiku）** | 父会话 cache 不受影响 | **最优** |

## 3 我的 Subagent 设计

基于上面的分析，我给不同级别的任务设计了专门的 subagent：

| Subagent | 模型 | 用途 |
|----------|------|------|
| `merge-and-ci` | Haiku | 合并分支 → 本地验证 → 推送 → 盯 CI 到绿 |
| `code-review` | Sonnet | 审查多文件改动 |
| `implement-feature` | Sonnet | 按 spec 实现功能 |
| `architect` | Opus | 架构设计、重构策略、方案权衡 |

### 3.1 merge-and-ci：一个具体的例子

这是我最先做的一个 subagent，因为这个场景太典型了：

1. `git fetch origin && git merge origin/main`
2. 有冲突就解决
3. `npm run lint && npm run build && npm test`
4. 本地过了就 `git push`
5. `gh run watch` 盯 CI
6. CI 红了就看日志、修、再 push
7. 重复直到绿

这整个流程完全不需要 Opus 级别的推理能力。Haiku 完全够用，而且更快、更省。

Subagent 的定义放在 `.claude/agents/merge-and-ci.md`：

```markdown
---
name: merge-and-ci
model: haiku
description: Merge a branch, verify locally, push, watch CI until green.
tools: Bash, Read, Edit, Write, Grep, Glob
---

[详细的工作流指令...]
```

配置好之后，Claude 在识别到合适的任务时会自动委派给这个 subagent，或者你可以手动让它用。

## 4 实际效果

用这套方案一段时间后的体感：

- **Tier 1 任务的速度明显变快：** Haiku 的输出速度比 Opus 快很多，一个 merge-and-ci 循环跑下来体感差别很大
- **Pro 配额更耐用了：** 把高频的机械操作从 Opus 迁到 Haiku 之后，同样的工作周期内不容易触顶
- **主会话上下文更干净：** CI 日志、git diff 这些噪音都留在了 subagent 里，主会话的 context window 留给了真正需要深度思考的工作

当然这套方案也不是没有代价——subagent 的多轮对话整体 token 消耗大约是单 agent 的 4-7 倍（因为每个 subagent 需要自己的 system prompt、工具定义等开销）。但对于 Tier 1 任务来说，Haiku 的单价足够低，这个开销完全可以接受。

## 5 一些建议

如果你也在用 Claude Code 做日常开发：

1. **先分级再动手：** 花 5 秒想一下这个任务是什么级别的，选合适的模型
2. **不要在会话中途切模型：** 如果需要不同的模型，用 subagent 隔离
3. **把重复流程做成 subagent：** 特别是那些不需要判断力的机械操作
4. **保持主会话上下文干净：** 大量的中间输出（日志、diff）让 subagent 消化，只拿结果回来
5. **Opus 留给真正需要它的地方：** 架构设计、复杂 bug 排查、需要权衡利弊的决策

---

## Fact Notes

> 以下是写作过程中收集的事实来源，仅供我自己参考用，最终发布时会精简。

### Prompt Cache

- Prompt cache 基于前缀匹配（prefix match），工具定义 → system prompt → 对话历史的层级结构中，上层变化会导致下层全部失效
- 切换模型会导致整个 cache 失效，该轮对话需要重新支付全部 context 的 token 成本
- Claude Code 团队建议：不要在会话中途切换工具或模型
- 来源：[How Prompt Caching Actually Works in Claude Code](https://www.claudecodecamp.com/p/how-prompt-caching-actually-works-in-claude-code)
- 来源：[Prompt caching - Claude API Docs](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)
- 来源：[Issue #27048 - Prompt Cache Invalidation on Session Resume](https://github.com/anthropics/claude-code/issues/27048)

### Subagent 上下文隔离

- 每个 subagent 运行在自己独立的 context window 中（最大 200K token）
- 中间的工具调用和结果留在 subagent 内部，只有最终消息返回给父会话
- 父会话的 prompt cache 不受 subagent 的模型选择影响
- 来源：[Create custom subagents - Claude Code Docs](https://code.claude.com/docs/en/sub-agents)
- 来源：[Subagents & Context Isolation - ClaudeWorld](https://claude-world.com/tutorials/s04-subagents-and-context-isolation/)

### 模型定价（API）

- Haiku 4.5: $1 input / $5 output per MTok
- Sonnet 4.6: $3 input / $15 output per MTok
- Opus 4.6: $5 input / $25 output per MTok
- 来源：[Pricing - Claude API Docs](https://platform.claude.com/docs/en/about-claude/pricing)

### Pro 订阅用量

- Pro 计划提供约 5 倍于免费版的用量，在 Claude.ai 和 Claude Code 之间共享
- Anthropic 没有公开披露 Pro 订阅下每个模型具体消耗多少配额
- 但多个第三方分析确认：Opus 消耗配额的速度明显快于 Sonnet，Sonnet 快于 Haiku
- 超出配额后的额外用量按标准 API 价格计费
- 来源：[Using Claude Code with your Pro or Max plan](https://support.claude.com/en/articles/11145838-using-claude-code-with-your-pro-or-max-plan)
- 来源：[Manage extra usage for paid Claude plans](https://support.claude.com/en/articles/12429409-manage-extra-usage-for-paid-claude-plans)
- 来源：[Claude Plans & Pricing](https://claude.com/pricing)

### Skill vs Subagent

- Skill 支持 `model` frontmatter 字段，可以指定运行时使用的模型
- Skill 在父会话的 context 中 inline 执行，不隔离上下文
- Skill 的 model override 是否会触发与 `/model` 相同的 cache 失效行为，Anthropic 没有明确文档说明
- Subagent 有独立 context，是唯一确认不会影响父会话 cache 的方案
- 来源：[Model configuration - Claude Code Docs](https://code.claude.com/docs/en/model-config)
- 来源：[Create custom subagents - Claude Code Docs](https://code.claude.com/docs/en/sub-agents)

### 多 Agent 的 Token 开销

- 多 agent 工作流的 token 消耗大约是单 agent 的 4-7 倍
- Agent Teams（实验性功能）约 15 倍
- 来源：[Claude Code Agents & Subagents: What They Actually Unlock](https://www.ksred.com/claude-code-agents-and-subagents-what-they-actually-unlock/)
- 来源：[Claude Code Subagents: How They Work, What They See & When to Use Them](https://www.morphllm.com/claude-subagents)
