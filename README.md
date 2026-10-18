# Clash 通用分流覆写

为自己的机场订阅添加统一的策略组、国内直连、AI 分流、Steam 下载分流和 DNS 策略。

**这里提供的是覆写文件，不是机场订阅。** 不包含可用节点、节点密码、订阅地址或作者的个人服务器/内网例外。每台设备仍需使用自己的节点订阅。

## FlClash：只导入一个 JS

**FlClash 单文件地址：**

```text
https://raw.githubusercontent.com/cattoldme/clash-overrides/main/flclash-single.js
```

这个文件已经包含下方通用 JS 和配套 YAML 的基础设置，不需要再导入 YAML，也不要同时叠加原通用 JS。

1. 先导入并启用自己的机场订阅，备份原有扩展和覆写设置。
2. 在 FlClash 的脚本管理页点“＋”，选择“从 URL 导入”，粘贴上面的地址。
3. 在要使用的机场配置的“扩展脚本”中选中该脚本。仅下载脚本而不绑定到配置不会生效。
4. 重新应用配置，使用规则模式。检查 AI、TikTok、Spotify、Steam 等分组、33 个基础规则集和 DNS 是否加载正确，再按自己的节点选择出口。
5. 后续需要获取新版时，在该远程脚本菜单选择“同步”。不要将其当作机场订阅 URL，也不要将外部规则集自动更新等同于脚本定时同步。

菜单名称会因版本和平台不同而略有差异；没有 URL 导入入口时，可以下载同一 JS，在脚本编辑器中粘贴并绑定。

脚本通过 `main(config)` 合入基础配置并生成分流。它保留节点、hosts、原有具体域名 DNS 策略和 Fake-IP 过滤项；已有 whitelist/rule 过滤模式不会被改为 blacklist。DNS 基础设置按配套 YAML 启用。没有节点、provider-only 或混合 provider 的输入仍按原通用版行为跳过。

FlClash 会在生成最终配置时回写部分客户端设置，脚本无法保证覆盖它们。端口、全局 IPv6、TUN 开关、地理数据来源/更新、连接选项等以实际配置预览为准；显式选择的 DNS/TUN 覆写项也可能覆盖脚本。使用完整 MetaCubeX geosite 数据、检查地理数据自动更新，并让 AI/内网 DNS 策略及 Fake-IP 兼容项在最终配置中保留。Android 的 DNS 监听地址也可能由客户端安全模式调整。

依据：[FlClash 脚本导入入口](https://github.com/chen08209/FlClash/blob/main/lib/views/config/scripts.dart)、[绑定到订阅配置](https://github.com/chen08209/FlClash/blob/main/lib/views/profiles/extend/script.dart)、[最终配置生成](https://github.com/chen08209/FlClash/blob/main/lib/common/task.dart)。

该单文件已完成独立回归、与双文件输出等价检查和 Mihomo 内核配置检查；尚未在 FlClash Android/Windows 客户端上完成实际联网验收。其他设备需验证自己的节点、最终 DNS 和常用应用。

## Clash Verge Rev：两个配套文件

| 文件 | 用途 | 原始文件链接 |
| --- | --- | --- |
| `linkcube-generic.js` | 生成策略组、规则及 DNS 分流 | [下载脚本](https://raw.githubusercontent.com/cattoldme/clash-overrides/main/linkcube-generic.js) |
| `linkcube-generic-merge.yaml` | DNS、Fake-IP、规则数据更新等基础配置 | [下载配套 YAML](https://raw.githubusercontent.com/cattoldme/clash-overrides/main/linkcube-generic-merge.yaml) |

请使用同一版本的两个文件。`main` 链接随仓库更新；需要固定版本时，将链接中的 `main` 换成所选提交的完整 SHA。

## 在 Clash Verge Rev 中使用

适用于支持 JavaScript `main(config)` 扩展、使用 Mihomo 内核的 Clash Verge Rev。仓库名称中的 LinkCube 只是文件命名来源，不要求使用该机场。

1. 导入并启用自己的机场订阅，先确认原订阅可以联网。
2. 备份该订阅现有的扩展配置和扩展脚本。将需要保留的内网 DNS、Fake-IP 过滤项及特殊分流例外迁移到自己的副本中。
3. 在“订阅”页右键自己的订阅，打开“扩展配置”，填入配套 YAML 的内容并保存。
4. 打开同一订阅的“扩展脚本”，填入 JS 内容并保存。执行顺序应为订阅扩展配置在前、订阅扩展脚本在后。
5. 重新激活该订阅，使用规则模式，检查配置验证结果、规则集加载状态及实际命中。若启用了客户端 DNS 覆写，检查最终运行配置，确认所需 DNS 策略和 Fake-IP 项仍保留。
6. 检查旧的分组选择是否被保留：主代理不要误选 DIRECT；Final 建议选 Proxies；AI、TikTok、Spotify、Streaming 默认跟随 Proxies，也可分别选择实际可用地区或 Manual（客户端若保留旧选择需手动切换）；Bilibili、Microsoft、Apple、PayPal 可按需求选 DIRECT。

**不要把 JS URL 或配套 YAML URL 粘贴到机场“订阅导入”框。** 它们不是包含节点的完整订阅，Clash Verge Rev 中应按以上方式放入扩展编辑器。

其他设备可以打开上述公开链接获取同一份内容。其他客户端只有在兼容该脚本接口及 Mihomo 配置字段时才适用；不能仅凭支持 Clash 就认定兼容。若某客户端提供兼容的远程覆写 URL 功能，可在其对应入口使用链接；本仓库没有为该客户端逐一验证。

## 分流方式

- 内网、国内域名及最终判断为中国 IP 的未分类目标直连。
- AI 仅使用 MetaCubeX 的四个分类：ChatGPT / OpenAI（openai）、Gemini（google-gemini）、Claude / Anthropic（anthropic）、Grok / xAI（xai）。不再附加手写 AI 域名；其他服务按原有平台和兜底规则分流。Gemini 分类还包含 AI Studio、NotebookLM 等相关 Google AI 服务；实际范围随完整 geosite 数据更新。
- AI、TikTok、Spotify、Streaming 均为独立的 select 分组，选项顺序统一为 Proxies → HK / JP / SG / US / TW → Manual，默认跟随 Proxies。仅列出订阅中已生成的地区组，没有这五个地区时仍提供 Proxies、Manual；不再因缺少美国节点插入 REJECT。Manual 是共享手选组，客户端保存的旧选择可能覆盖初始默认，需要手动切换。后续应用选择组沿用“总代理 → 地区 → 手选”的顺序。
- Steam 商店、社区和明确的网页例外进入 Steam 组；已知游戏下载 CDN 直连。未将整个 Steam 进程强制直连。
- 日本服务进入日本组；无日本节点时回退到总代理。
- 新增地区限定服务直接使用对应地区组：mora → JP；Hulu 美版、Peacock、Pandora → US；myTV SUPER → HK。它们不进入 Streaming，也不新增应用选择组；缺少所需地区节点时 REJECT，避免误送其他地区。此规则不改变上一条既有日本服务的回退行为。
- mora 使用 Hawaiine 的独立名单，HuluUSA、Peacock、Pandora 使用 blackmatrix7，myTV SUPER 使用 MetaCubeX 的 mytvsuper 域名名单，避免套用整个 TVB 分类。地区规则优先于 Streaming 和通用平台规则，用户自定义例外继续优先；HuluUSA 上游含日版 prod.hjholdings.tv，脚本先将该域名及其子域名送往 JP，缺少 JP 时 REJECT。
- Google 与 YouTube 一样，提供总代理、现有地区组和手动组供选择，不再直接列出全部单节点。
- TikTok、Spotify 各自进入对应分组，地区组按连通性测速，不保证地区解锁。TikTok 使用上游维护名单，其中也包含 CapCut、Trae 等相关域名。
- Streaming 分流六个平台：Netflix、Disney+、HBO Max、Prime Video、Crunchyroll、Paramount+，六者共用 Streaming 的出口选择。Netflix、Prime Video 使用 MetaCubeX 的域名名单；Disney、HBO、ParamountPlus 使用 blackmatrix7；Crunchyroll 使用 [liandu2024 的独立名单](https://github.com/liandu2024/clash/blob/main/list/Crunchyroll.list)。新增名单不借用整个 Sony、CBS 或通用代理大分类。
- Netflix、Prime Video 的名单避免将整个 AWS 区域、llnwd.net 或 media-amazon.com 后缀归入 Streaming；不再使用两者原 classical 名单的 IP/进程规则。实际播放仍需按自己的账号、客户端和节点验证。地方专属平台不因本次扩充加入 Streaming，日本服务等既有分流保留。
- 已知平台进入相应分组；剩余目标进入 Final，默认代理。
- 专用 BT 客户端的进程直连规则位于服务和国内域名规则之后，通用下载器按目标分流。

本配置不是自动识别所有被封网站的探测器，也不保证地区解锁或所有网站都适合所选出口。

## 自动更新的范围

| 来源 | 数据 | 配置周期 |
| --- | --- | --- |
| [blackmatrix7/ios_rule_script](https://github.com/blackmatrix7/ios_rule_script) | 26 个平台及通用规则集，含 Disney、HBO、ParamountPlus、HuluUSA、Peacock、Pandora | 24 小时 |
| [Hawaiine/mihomo-rules](https://github.com/Hawaiine/mihomo-rules/blob/main/ruleset/mora/mora.yaml) | mora 独立规则集 | 24 小时 |
| [liandu2024/clash](https://github.com/liandu2024/clash/blob/main/list/Crunchyroll.list) | Crunchyroll 独立规则集 | 24 小时 |
| [Sukka](https://ruleset.skk.moe/Clash/domainset/game-download.txt) | 游戏下载 CDN | 12 小时 |
| [caserangle/clash-rule](https://github.com/caserangle/clash-rule) | Steam 网页例外 | 24 小时 |
| [MetaCubeX/meta-rules-dat](https://github.com/MetaCubeX/meta-rules-dat) | Netflix、Prime Video、myTV SUPER 三个域名规则集；域名分类及 IP 地理数据 | 24 小时 |

以上是客户端尝试更新的周期，依赖网络和上游可用性。外部名单遵循各自维护者的规则和许可。

**脚本逻辑和配套 YAML 不会因机场订阅或外部规则集更新而自动同步。** 在 Clash Verge Rev 中升级本仓库版本，需要重新获取这两个文件并更新扩展内容。FlClash 使用远程单文件脚本时，可通过其“同步”入口获取新版。已有的个人修改应单独保留并合并，避免直接覆盖。

## 自定义例外

JS 开头的 `CUSTOM_DIRECT_DOMAINS` 和 `CUSTOM_PROXY_DOMAINS` 默认为空。

需要时在自己的副本内填写域名后缀，不填协议、路径、端口、IP、通配符或逗号。更具体后缀优先，相同后缀同时指定时代理优先；这些例外也会同步设置 DNS 策略。

公司私有域名需要对应内网 DNS，不应直接交给公共 DNS。配套 YAML 使用明确的 Fake-IP 黑名单基线；自己已有的兼容项需要迁移。普通未分类查询可能发给国内 DNS，本配置不以 DNS 匿名化为目标。

## 兼容范围与回滚

- 仅重建直接在 `proxies` 中提供节点的订阅。纯 `proxy-providers` 和混合 provider 输入原样返回，没有实现其策略重建。
- 节点协议、服务器、端口和凭据不改；策略组、规则集和路由规则会重建。Fake-IP 过滤项及 proxy-server-nameserver-policy 引用的规则集会按需保留；DNS 关闭时也保留内核仍需解析的依赖（包括原 nameserver-policy）。DNS 模式、规则类型及 selector 前缀按内核语义忽略大小写，RULE-SET 的逗号字段会修剪空格，规则集名称本身保留大小写。缺失依赖、与内置规则集重名冲突，或保留的 DNS/规则集下载出口引用已删除的旧组时，会在修改配置前报错；请先迁移对应依赖。真实网卡名和仍保留的节点出口不受影响。
- 重名节点、与生成分组重名的节点、依赖旧订阅组的 `dialer-proxy` 会报错，应先解决输入冲突。
- 全局 IPv6、TUN 开关、端口和系统代理仍由客户端管理；配套 YAML 的 DNS IPv6 默认为关闭。其他设备按自己的环境决定客户端开关。
- 出现问题时恢复自己的两份扩展备份，重新激活订阅，并检查分组选择。

## 验证

在仓库根目录执行：

```sh
node --check linkcube-generic.js
node --test tests/override.test.cjs
node --test tests/flclash.test.cjs
node --test tests/dns-normalization.test.cjs
node --test tests/ai-platforms.test.cjs
node --test tests/streaming.test.cjs
node --test tests/regional-services.test.cjs
python -m unittest discover -s tests -p 'test_*.py'
python scripts/build_flclash.py --check
```

Node 测试只使用内置模块；Python 测试需要 PyYAML。流媒体名单范围测试使用 tests/fixtures 中的离线快照；运行时仍按上游最新名单更新，快照不能保证未来上游范围不变。

本次检查：157 项 Node 回归和 9 项 Python 检查通过，覆盖六个 Streaming 平台、应用选项顺序、五项新增地区服务及全部 32 种地区有无组合下的缺节点处理、Hulu 美日名单交叉和自定义例外。两版脚本的新增规则格式及生成分组通过 10 项隔离 Mihomo v1.19.32 配置检查，未进行完整客户端及实际播放验收。离线测试使用文档专用 IP 和 `TEST-ONLY` 假密码，没有可用节点。

维护者修改通用 JS 或 YAML 后，运行 `python scripts/build_flclash.py` 重新生成 `flclash-single.js`，再执行以上检查并一并提交。生成器只在本地构建时需要 PyYAML；设备导入后的单文件不需要 Python、模块加载或在线下载另一份脚本。

同版规则逻辑另在 Windows / Clash Verge Rev 2.5.8 / Mihomo v1.19.32 环境经过分流与联网验证；该设备使用额外的个人覆写。其他设备仍需验证自己的节点、DNS、内网与常用应用。HTTP 403 若带 `cf-mitigated: challenge`，代表浏览器验证页，应通过真实浏览器验证，不能直接认定节点失效。
