---
title: 在阿里云上折腾 Tailscale 自定义 DERP：从域名 HTTPS 到 IP + sha256-raw pinning
date: 2026-04-11
author: rianma
pubDatetime: 2026-04-11T00:00:00Z
modDatetime: 2026-04-11T00:00:00Z
slug: tailscale-custom-derp-on-aliyun-debug
featured: false
draft: true
tags:
  - tailscale
  - derp
  - aliyun
  - networking
  - debugging
description: "记录一次在阿里云 ECS 上部署 Tailscale 自定义 DERP 的完整排查过程：从 derper、证书、nginx 反代、443/8443 对照实验，到最终通过 IP + sha256-raw 自签证书 pinning 跑通。"
---

# 在阿里云上折腾 Tailscale 自定义 DERP：从域名 HTTPS 到 IP + sha256-raw pinning

最近想解决一个很具体的问题：我日常使用的 Mac mini 和 iPhone 都在北京，但当它们一台走家里 Wi‑Fi、一台走 5G 时，经常会通过 `derp(hkg)` 中转，导致延迟偏高。

我手里正好有一台阿里云北京 ECS，于是想把它部署成一个自定义 DERP 节点，让官方 Tailscale tailnet 的设备优先走北京中继。

这篇文章不是一篇“标准教程”，而是一份完整的排查记录。因为这次过程中踩的坑比较多，尤其是：

- 以为只要 `derper` 跑起来就够了
- 误把一些 DERP 问题当成证书问题
- 被 `tailscale debug derp`、`openssl`、浏览器、`curl` 的不同行为绕晕
- 一度怀疑阿里云、怀疑 nginx、怀疑 TLS 1.3

最终结论是：

> 在我这个环境里，**基于域名 + 公网证书的 DERP 接入虽然部分探测能通，但真实客户端连接存在问题**；最终通过 **IP + `sha256-raw` pinning** 的方式跑通了自定义 DERP。

---

## 1. 目标和现象

### 目标

让我的官方 Tailscale tailnet 设备（Mac mini / iPhone）在需要 DERP 中继时，优先使用我在阿里云北京 ECS 上自建的 DERP，而不是香港节点。

### 初始现象

在 Mac mini 上执行：

```bash
tailscale netcheck
```

会发现最近的官方 DERP 往往是：

- `hkg`（Hong Kong）

设备互联时，尤其是：

- Mac mini 连接家里 Wi‑Fi
- iPhone 使用 5G

会出现中继延迟偏高的问题。

---

## 2. 正确认识 DERP：不是“装个 tailscale 服务器”

这里先纠正一个容易混淆的概念：

- `tailscaled` 是 Tailscale 节点守护进程
- `derper` 才是 DERP 服务本体

如果只是想让一台 Linux 云主机提供 DERP 服务，核心是：

- 安装并运行 `derper`
- 让 tailnet policy file 下发 `derpMap`

而不是手工去跑什么：

```bash
tailscaled --tun=userspace-networking
```

另外，IP forwarding 之类的设置也不是 DERP 本身的重点。

---

## 3. 服务器环境

本次使用的服务器：

- 系统：Alibaba Cloud Linux 3
- 机房：北京
- 公网 IP：`47.93.197.230`

开放的端口主要有：

- `3478/udp`：STUN
- `443/tcp` 或后续实验用的 `8443/tcp`

---

## 4. 服务端部署：derper 跑起来其实不难

### 安装 derper

我使用了和本机 Tailscale 版本接近的 `derper`：

```bash
go install tailscale.com/cmd/derper@v1.96.4
sudo install -m 0755 ~/go/bin/derper /usr/local/bin/derper
```

### systemd 管理

一开始我走的是域名证书模式，后来为了排查问题，切过多次 systemd 配置。

最终跑通时，使用的是：

- `8443/tcp`：DERP
- `3478/udp`：STUN
- `certmode=manual`
- `hostname` 直接使用公网 IP

核心命令形态类似：

```bash
/usr/local/bin/derper \
  -hostname 47.93.197.230 \
  -a :8443 \
  -http-port -1 \
  -stun-port 3478 \
  -certmode manual \
  -certdir /var/lib/derper-certs-ip
```

---

## 5. 官方 Tailscale 是支持自定义 DERP 的

我一开始有个误区，以为“官方 Tailscale 不能用自建 DERP”。

后来确认，官方文档明确支持：

- 在 tailnet 的 policy file 中配置 `derpMap`
- region ID `900-999` 保留给用户自定义 DERP

所以关键不是“客户端本地手填地址”，而是：

> **在 Tailscale Admin Console 的 policy file 中下发自定义 DERP map**。

一个最小配置大致长这样：

```json
"derpMap": {
  "Regions": {
    "900": {
      "RegionID": 900,
      "RegionCode": "bj",
      "RegionName": "Beijing",
      "Nodes": [
        {
          "Name": "1",
          "RegionID": 900,
          "HostName": "...",
          "DERPPort": 8443,
          "STUNPort": 3478
        }
      ]
    }
  }
}
```

---

## 6. 第一轮方案：域名 + 公网证书 + nginx / derper 直连

我先后尝试过几种方式：

1. `derp.myan.im` + Let's Encrypt 证书
2. nginx 反代到 `derper`
3. 停掉 nginx，让 `derper` 直连 `443`
4. 改 `443` / `8443` 端口对照实验

### 表面现象很怪

- 浏览器访问 `https://derp.myan.im` 正常
- `openssl s_client -connect derp.myan.im:443 -servername derp.myan.im` 正常
- 但是：
  - `curl -vk https://derp.myan.im/` 失败
  - `tailscale debug derp bj` 失败
  - GUI 还会显示 `Relay Server Unavailable`

### 更怪的一点是

`tailscale netcheck` 明明显示：

- `Nearest DERP: Beijing`
- `bj: 11.9ms`

也就是说，**探测看上去已经成功了**，但 DERP 会话就是不好用。

---

## 7. 关键排查：不是证书链坏了

我一度怀疑是证书问题。

但是后来通过下面的实验，基本排除了“证书坏了”这件事：

### OpenSSL 成功

```bash
openssl s_client -connect derp.myan.im:443 -servername derp.myan.im -showcerts
```

能完整验证通过：

- 证书链正常
- 域名匹配正常
- `Verify return code: 0 (ok)`

### 浏览器成功

浏览器访问域名也能正常打开。

### curl / tailscale 失败

```bash
curl -vk https://derp.myan.im/
```

以及：

```bash
tailscale debug derp bj
```

都在 TLS 握手阶段失败。

这说明：

> 不是“证书链坏了”，而是**不同 TLS 客户端实现/路径行为不一致**。

---

## 8. 关键抓包：RST 来自客户端侧路径

为了搞清楚是谁在断开连接，我在服务器上抓包：

```bash
sudo tcpdump -ni any -s0 -w /tmp/derp8443.pcap 'host 111.193.234.77 and tcp port 8443'
```

然后在 Mac 上触发：

```bash
tailscale debug derp bj
```

抓包看到的时序大概是：

1. TCP 三次握手成功
2. 客户端发出一段数据（TLS ClientHello）
3. 服务器只回 ACK
4. 紧接着客户端侧公网 IP 发出 RST

也就是说：

> **服务器没有主动拒绝**，而是客户端这一侧的网络路径/实现，在发出 ClientHello 之后主动中断了连接。

因为 iPhone 5G 侧也出现类似问题，所以很难简单归咎为单台 Mac 本机代理设置，更像是：

- 域名/SNI/TLS 指纹
- 客户端侧网络路径
- 某类非浏览器 TLS 客户端行为

共同触发的兼容性问题。

---

## 9. 最终可用方案：IP + `sha256-raw` pinning

为了绕开：

- 域名
- SNI
- 公网 CA 证书路径
- 域名证书相关握手问题

最终采用了当前官方源码已支持的一条方案：

## `HostName` 直接写公网 IP
并在 `DERPMap` 中固定证书哈希：

```json
"900": {
  "RegionID": 900,
  "RegionCode": "bj",
  "RegionName": "Beijing",
  "Nodes": [
    {
      "Name": "1",
      "RegionID": 900,
      "HostName": "47.93.197.230",
      "CertName": "sha256-raw:b4784c7cbb39a66612d4ca7381754dadebadf40da68011fd037d2c41b7be4b9e",
      "DERPPort": 8443,
      "STUNPort": 3478
    }
  ]
}
```

这里的 `CertName` 不是手算出来的，而是 `derper` 在使用 IP 自签证书模式启动时自动打印出来的。

### 切到这个方案后
- Mac / iPhone 顶部的 `Relay Server Unavailable` 消失
- 连接恢复正常
- DERP 实际可用

### 唯一的“看起来还在报错”的地方
`tailscale debug derp bj` 仍然会报一条：

```text
x509: certificate signed by unknown authority
```

但这更像是该调试命令走的是普通 Web PKI 校验路径，而不完全理解 `sha256-raw:` pinning 这种模式。因为从真实使用效果看：

- warning 已消失
- 连接已可用

所以应当以真实连接结果为准。

---

## 10. 最终保留的服务端形态

为了不影响已有网站，最终保留为：

### nginx
- 正常提供网站
- 监听 `80/443`

### derper
- 监听 `8443/tcp`
- `3478/udp`
- 不占用 `443`
- 采用 IP 自签模式

这样既不影响站点，也保留了可工作的自定义 DERP。

---

## 11. 这次排查得到的几个经验

### 1）`tailscale netcheck` 成功，不代表真实 DERP 会话一定成功
它说明“探测能到”，但不代表完整数据通道一定已经健康。

### 2）浏览器能打开，不代表 Tailscale / curl 这种客户端也一定没问题
浏览器、OpenSSL、curl、Go TLS 的行为可能完全不同。

### 3）不要太早把锅扔给证书
如果：

- OpenSSL 成功
- 浏览器成功
- 证书链验证 OK

那更应该怀疑的是：

- TLS 端点行为
- ClientHello 指纹
- 中间链路兼容性

### 4）官方已经支持 IP + `sha256-raw` pinning
不一定需要按照一些旧文章去 hack 源码，当前版本的 `derper` 已经原生支持这种模式。

---

## 12. 当前结论

如果你在国内网络环境、阿里云 ECS、官方 Tailscale tailnet 的组合下遇到类似现象：

- `tailscale netcheck` 能看到自定义 DERP
- 浏览器 / OpenSSL 访问域名证书正常
- 但 `curl` / `tailscale debug derp` / GUI 报错
- `Relay Server Unavailable`

那么值得尝试的最终解法是：

> **不要继续死磕域名证书路径，直接改成 IP + `sha256-raw` pinning。**

至少在我这次实践里，这条路是最终跑通的。

---

## 参考命令

### 查看 DERP map

```bash
tailscale debug derp-map
```

### 查看最近 DERP

```bash
tailscale netcheck
```

### 调试某个 DERP region

```bash
tailscale debug derp bj
```

### 服务器实时看 derper 日志

```bash
sudo journalctl -u derper -f
```

### 服务器抓包

```bash
sudo tcpdump -ni any -s0 -w /tmp/derp8443.pcap 'host <your-client-public-ip> and tcp port 8443'
```

---

## 尾声

这次排查花的时间比最开始预计的长很多，但也算把几个问题弄清楚了：

- 什么是 DERP，什么不是 DERP
- 官方 Tailscale 如何接入自定义 DERP
- 为什么“能打开网页”不等于“DERP 一定能用”
- 为什么有些问题看起来像证书问题，其实并不是
- 以及，什么时候该果断切到更直接的实验方案

后面如果这个方案稳定跑一阵子，我可能会再补一篇更偏教程性质的整理版。 
