# 配置契约与验证

## 真实来源对齐

比较独立机场和链路 provider 时，在内存读取完整参数，仅输出差异字段名及统计。记录 URL 是否相同、最近更新时间、各协议数量、同名节点的服务器/端口/认证参数是否一致。新获取的订阅可能比本地缓存多节点，先解释更新和客户端能力差异。

HTTP User-Agent 可能影响机场返回的协议与节点类型。读取 `/version`，用机场支持的真实客户端标识请求订阅，再比较返回内容。验证过的特例中，`ClashMeta/1.19.0` 只返回 HY2，`mihomo/1.19.33` 返回 HY2、AnyTLS、Mieru。每次按当前内核验证，禁止把这两个字符串当作通用版本常量。

DNS 处理需要同时考虑机场服务器域名和普通目标域名。机场可能用账号专属 DoH 返回节点地址，常规 DNS 结果可能不同。提取节点域名匹配的策略，必要时同时填入 `nameserver-policy` 与 `proxy-server-nameserver-policy`。保留原解析服务 URL 中的认证信息，以及来源已使用的必要参数。新规则的 `DIRECT` 路由应避开依赖同一机场的解析循环。若参数涉及证书验证豁免，核对来源与必要性，避免扩展到其他 DNS。

现有普通 nameserver、default-nameserver、国内规则集 DNS、fake-ip、rules 和 rule-providers 应逐项比对。机场 provider 的更新方式同样需要验证，独立订阅卡片更新与 provider 更新是两条生命周期。

Mihomo 设置 `proxy-server-nameserver-policy` 时要求存在非空的 `proxy-server-nameserver`。新建配置或原配置缺少该字段时，先依据用户的 DNS 方案确定节点引导解析器并写入候选，再应用模板。该字段应能在机场尚未连通时解析需要引导的节点域名。

## 分流迁移

默认采用 `../assets/routing-override.yaml`，它依据用户于 2026-11-06 保存的覆写配置整理。此来源是保存文件，正式运行效果需另行验收。默认交付订阅扩展脚本与订阅扩展覆写两份完整文本，适配目标电脑后联合检查。

- 指定应用进程直连，覆盖已识别进程的纯 IP 连接。Windows 基线包含微信、企业微信、QQ 音乐、抖音、ToDesk、UU 远程、WPS 相关进程、游戏等。核对目标系统与实际进程名，进程无法识别时继续匹配后续规则。
- 显式指定的知网、分区表等域名直连，AI 及出口查询域名使用出口选择组，规则按从上到下顺序生效。
- 内网地址直连。国内手动名单和自动名单采用域名命中且 GEOIP 为 CN 的条件。自动名单来自 Loyalsoldier direct.txt，24 小时更新。
- 基线另含较宽的“UDP 且 GEOIP 为 CN”直连规则，作用于前面尚未匹配的流量。向目标用户说明这个范围，包括其可能覆盖其他应用的国内 UDP；采用“与现有一致”时保留，不静默扩展到所有国内 TCP。
- 国内名单使用国内 DNS，其余域名使用加密 DNS 并遵循分流规则。节点引导解析及机场专用 DNS 分别适配。避免将国外域名随意加入国内 DNS 名单。
- 最终 MATCH 指向出口选择组。选择住宅时默认走机场 → VPS → 住宅，选择纯 VPS 时默认走机场 → VPS；实际仍受前置组选择控制。

通用资产已移除个人物联网 MQTT 地址、个人 SSH IP 规则、个人面板域名以及机场专属域名。生成朋友配置时，仅按对方实际需求添加对应项，并说明与来源配置的差异。保留公开应用域名和规则行为。目标端口、控制接口、TUN 和系统 DNS 设置按目标电脑当前环境处理。

统一覆写中的 `AI服务`、脚本出口组和 rules/rule-providers 的策略引用。资产的 include-all-proxies 组供脚本改为双出口，最终配置不得被后续全局覆写重新替换。机场专用 DNS 也不得被后续覆写丢失。按目标版本的真实扩展执行顺序合成并校验，不能凭两份文件分别语法正确判断可用。验收应用进程直连、国内名单双条件、国内 UDP、默认出口及 provider 更新路径。

## 脚本参数

`scripts/build_script.cjs` 接受 JSON 参数文件和输出 `.txt` 路径。它只生成文件，由 agent 把真实数据写入用户专属参数文件，再生成脚本。示例全部为合成数据。

```json
{
  "providerName": "user-airport-front-v1",
  "providerPath": "./providers/user-airport-front-v1.yaml",
  "frontGroup": "前置机场",
  "exitGroup": "AI服务",
  "bypassName": "不经过机场（直连）",
  "airportURL": "https://subscription.example.invalid/client/token",
  "userAgent": "verified-client/version",
  "testURL": "https://cp.cloudflare.com/generate_204",
  "interval": 86400,
  "excludeFilter": "^(官网|剩余流量|到期时间|套餐到期)",
  "airportDnsPolicies": {},
  "replaceExistingDialer": false,
  "targets": [
    {"role": "vps", "name": "纯VPS", "server": "vps.example.invalid", "port": 20001},
    {"role": "residential", "name": "住宅出口", "server": "vps.example.invalid", "port": 20002}
  ]
}
```

```text
node scripts/build_script.cjs 用户专属参数.json 用户专属输出目录/订阅脚本.txt
```

模板使用稳定 provider 名称及缓存路径。旧配置中同名 provider 来源不同、前置组来源不同、出口组包含其他用途、已有 dialer 指向其他链路时会明确报错。由 agent 判断如何合并，准备新候选后验证。`replaceExistingDialer` 仅在检查旧链路并确认本任务需要替换时设为 true。

`targets` 的服务器与端口来自实际节点。模板给两个节点设置同一个前置 dialer，保留其余连接字段。它保留已有规则，出口组名称应匹配原规则中的策略名称。新建组时由 agent 确认规则实际引用它。

机场节点通过 provider 全量动态加载，过滤规则应根据真实返回的占位项设置。核心支持情况、订阅返回能力及过滤后数量都要记录。模板使用已识别的两个出口，复杂多出口原配置应按任务要求适配。

## 验证顺序

1. 在工作目录用原配置副本执行脚本，比较预期差异并再次执行，确认结果幂等。新建模式使用完整候选做同样检查。
2. 使用实际版本的 Mihomo 配置校验命令。若校验需要 GeoIP 或 provider 缓存，使用独立目录里的副本，避免测试实例更新生产目录。
3. 临时内核设置 TUN 关闭、回环监听、随机未占用端口、独立 secret 与数据目录。所有创建与清理放在同一前台流程的 try/finally 中。
4. 通过候选实际 URL/客户端标识取得真实 provider，保留待验收的原 DNS 与分流。临时替换 DNS、使用其他节点快照进行对照时，明确记录它是哪个实验，正式候选再单独验证。
5. 同一测速 URL 与超时条件下，测试前置组、纯 VPS 和住宅入口，至少验证一个机场前置可完成端到端请求。额外节点测试按用户需求和故障定位需要安排。
6. 测试公网出口，结合 API 连接规则、链路信息和节点的 `dialer-proxy` 确认路径。API 的 `chains` 可能只列最终选择组，避免仅凭字段猜测前置是否参与。
7. 如用户要求测试 VPS 直连恢复，在隔离实例选择 bypass，再测纯 VPS 请求及实际出口。保留或恢复原选择依据用户意图，避免无说明地切换正在使用的出口。
8. 停止本次临时 PID，检查退出及对应监听端口。连接探测返回超时或权限错误时，如实报告该项未确认。
9. 用户导入后，再核查正式 provider 数量、前置/出口当前选项、实际网页请求和出口。隔离通过与正式验收分别报告。

## 测速失败的解释

选择组测速代表当前选项，机场节点测速与完整住宅链路测速目标不同。检查实际节点、DNS、HTTP/HTTPS 测试目标和超时限制，才能比较结果。测速成功仅反映当时访问该测试目标的情况。

如果所有前置突然超时，先取当前运行时快照。用户已切换到另一订阅时，原组的 API 404 表示组未加载，不能记录为节点断网。确认其切换目的后，可使用精确候选做隔离测试。

短期恢复的原因应有证据支撑。切换订阅、前置节点变化、DNS/连接缓存和上游波动可能同时发生，避免将同时发生的操作直接认定为修复原因。

## 工具使用

读取控制接口地址与 secret 时只在内存构造授权头。输出 provider 字段采用白名单，专用 DNS URL 也可能包含认证信息。先发现现有工具能力，再选择 API、后台命令或客户端界面。不同 Mihomo 版本对 provider 节点测速的 API 路径可能不同，按实际版本文档或能力验证，勿把未找到名称当作连接失败。

相关官方说明可在需要时查阅。

- [Mihomo 代理集合](https://wiki.metacubex.one/config/proxy-providers/)
- [Mihomo 出站代理](https://wiki.metacubex.one/config/proxies/)
- [Mihomo DNS](https://wiki.metacubex.one/config/dns/)
- [Clash Verge Rev](https://github.com/clash-verge-rev/clash-verge-rev)
