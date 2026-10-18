# Clash 通用分流覆写

为自己的机场订阅添加统一的策略组、国内直连、AI 分流、Steam 下载分流和 DNS 策略。

**这里提供的是覆写文件，不是机场订阅。** 不包含可用节点、节点密码、订阅地址或作者的个人服务器/内网例外。每台设备仍需使用自己的节点订阅。

## FlClash：只导入一个 JS

**桌面版 FlClash 单文件地址：**

```text
https://raw.githubusercontent.com/cattoldme/clash-overrides/main/flclash-single.js
```

**Android 省电版单文件地址：**

```text
https://raw.githubusercontent.com/cattoldme/clash-overrides/main/flclash-mobile.js
```

两版使用同一套 C 风格图标：服务保留品牌色，AI、Streaming、Proxies 等功能组使用浅色线条，五个地区使用旗帜图片。分组名称已去掉 emoji，节点原名中的旗帜不变。图标针对深色界面设计；FlClash 的图标样式应选择显示图标，不能设为隐藏。

**更新后请检查分组选择：** 名称是客户端保存选择的标识，去掉 emoji 后，原先选定的地区可能回到默认值，需要重新选择。分组选项、初始默认值与分流规则保持原样。订阅中的节点也不能与 `Proxies`、`AI`、`HK` 等内置分组同名。

图标从本仓库的 `icons/` 下载，FlClash 会缓存图片；首次加载需要能访问 GitHub 原始文件，图片不可用时客户端可能显示首字母，分流仍正常工作。素材来源和许可见 [图标说明](icons/README.md)。

两版均包含通用 JS 和基础 YAML，只选一个导入，不需要再导入 YAML，也不要同时叠加原通用 JS。也可下载对应 JS，通过本地文件或脚本编辑器导入并绑定。

1. 先导入并启用自己的机场订阅，备份原有扩展和覆写设置。
2. 在 FlClash 的脚本管理页点“＋”，选择“从 URL 导入”，粘贴上面的地址。
3. 在要使用的机场配置的“扩展脚本”中选中该脚本。仅下载脚本而不绑定到配置不会生效。
4. 重新应用配置，使用规则模式。检查 AI、TikTok、Spotify、Steam 等分组、35 个基础规则集和 DNS 是否加载正确，再按自己的节点选择出口。
5. 后续需要获取新版时，在该远程脚本菜单选择“同步”。不要将其当作机场订阅 URL，也不要将外部规则集自动更新等同于脚本定时同步。

菜单名称会因版本和平台不同而略有差异；没有 URL 导入入口时，可以下载同一 JS，在脚本编辑器中粘贴并绑定。

脚本通过 `main(config)` 合入基础配置并生成分流。它保留节点、hosts、原有具体域名 DNS 策略和 Fake-IP 过滤项；已有 whitelist/rule 过滤模式不会被改为 blacklist。DNS 基础设置按配套 YAML 启用。没有节点、provider-only 或混合 provider 的输入仍按原通用版行为跳过。

兼容核对基准为 [FlClash v0.9.1](https://github.com/chen08209/FlClash/releases/tag/v0.9.1)。该版在脚本执行后会回写统一延迟、TCP 并发、进程识别、地理数据来源/更新及保活参数。**仅切换脚本不能保证这些设置随之切换**，请同时在客户端设置中选择下表对应值，并检查最终配置预览。

| 设置 | Windows 桌面版 | Android 省电版 | 生效位置 |
| --- | --- | --- | --- |
| Auto / Fallback 测速周期 | 300 秒 | 900 秒 | 脚本 |
| 地区测速周期 | 600 秒 | 600 秒 | 脚本 |
| 统一延迟 `unified-delay` | true | false | 客户端需同步 |
| 普通规则集更新 | 24 小时 | 48 小时 | 脚本 |
| 游戏下载规则集更新 | 12 小时 | 24 小时 | 脚本 |
| 地理数据自动更新 | true，24 小时 | true，72 小时 | 客户端需同步 |
| 地理数据来源 / 加载 | 完整 MetaCubeX / memconservative | 同左 | 客户端需同步 |
| TCP 并发 / 进程识别 | true / strict | 同左 | 客户端需同步 |

两版业务规则、分组选项和默认出口相同；手机版保留 Fallback、地区自动组、DNS 容错和 Fake-IP 映射持久化。自动组使用预期 HTTP 204、5000ms 超时、最大失败次数 5，容差仍为 Auto 80ms / 地区 50ms。测速只判断测试地址可达，不保证服务解锁。

`lazy: true` 不会阻止启动首次测速；手机关闭统一延迟可减少第二次 HEAD 请求，延长 Auto 周期会让部分静默故障更晚被发现。延长更新周期会牺牲名单新鲜度，也不保证只在 Wi-Fi 或充电时更新。实际续航需实机对照，不承诺省电比例。本次核对的 Mihomo v1.19.32 Android 实现已禁用 TCP keepalive，不能把单独延长其间隔算作省电收益；FlClash 实际核心仍需核对。

**TUN 的 TCP DNS 接管需要显式客户端覆写：**

1. 在 FlClash 的 TUN 配置中找到 DNS 接管（`dns-hijack`），显式选择该字段的覆写，不只填写脚本。
2. 列表中同时保留 `any:53` 和 `tcp://any:53`，重新应用配置。
3. 检查最终配置预览中的 `tun.dns-hijack` 确实有这两项，并核对上表中的统一延迟和地理数据更新周期。

v0.9.1 默认会把 `dns-hijack` 重设为只有 `any:53`；未显式选择覆写时，脚本里的 TCP 项会被移除。UDP/TCP 53 接管不包含 DoH/DoT；Windows 内网 DNS、Android 私人 DNS 也存在接管边界，不能据此声称全面防 DNS 泄漏。端口、全局 IPv6、TUN 开关仍按自己的客户端设置；Android DNS 监听地址可能由安全模式调整。让 AI/内网 DNS 策略及 Fake-IP 兼容项在最终配置中保留。

依据：[脚本导入入口](https://github.com/chen08209/FlClash/blob/8d4f9744948751f1273fe871e1d05276fac09b0e/lib/views/config/scripts.dart)、[最终配置生成](https://github.com/chen08209/FlClash/blob/8d4f9744948751f1273fe871e1d05276fac09b0e/lib/common/task.dart)、[TUN 字段覆写界面](https://github.com/chen08209/FlClash/blob/8d4f9744948751f1273fe871e1d05276fac09b0e/lib/views/config/tun.dart)、[Mihomo TUN 边界](https://wiki.metacubex.one/config/inbound/tun/)。

两版从同一源码生成，并有分流等价及隔离内核回归；尚未在 FlClash Android/Windows 客户端完成本批变更的实际联网和续航验收。其他设备需验证自己的节点、最终 DNS 和常用应用。

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
6. 检查旧的分组选择是否被保留：主代理不要误选 DIRECT；Final 建议选 Proxies；AI、TikTok、Spotify、Streaming、YouTube、Telegram、Google、GitHub、Steam 默认跟随 Proxies，也可分别选择实际可用地区或 Manual（客户端若保留旧选择需手动切换）；Bilibili、Microsoft、Apple、PayPal 可按需求选 DIRECT。

**不要把 JS URL 或配套 YAML URL 粘贴到机场“订阅导入”框。** 它们不是包含节点的完整订阅，Clash Verge Rev 中应按以上方式放入扩展编辑器。

其他设备可以打开上述公开链接获取同一份内容。其他客户端只有在兼容该脚本接口及 Mihomo 配置字段时才适用；不能仅凭支持 Clash 就认定兼容。若某客户端提供兼容的远程覆写 URL 功能，可在其对应入口使用链接；本仓库没有为该客户端逐一验证。

## 分流方式

- 内网、国内域名及最终判断为中国 IP 的未分类目标直连。
- AI 仅使用 MetaCubeX 的四个分类：ChatGPT / OpenAI（openai）、Gemini（google-gemini）、Claude / Anthropic（anthropic）、Grok / xAI（xai）。不再附加手写 AI 域名；其他服务按原有平台和兜底规则分流。Gemini 分类还包含 AI Studio、NotebookLM 等相关 Google AI 服务；实际范围随完整 geosite 数据更新。
- AI、TikTok、Spotify、Streaming、YouTube、Telegram、Google、GitHub、Steam 均为独立的 select 分组，选项顺序统一为 Proxies → HK / JP / SG / US / TW → Manual，默认跟随 Proxies。仅列出订阅中已生成的地区组，没有这五个地区时仍提供 Proxies、Manual；不再因缺少美国节点插入 REJECT。Manual 是共享手选组，只列出未归入 HK / JP / SG / US / TW 的有效节点，沿用订阅顺序；没有其他节点时仅提供 REJECT 占位，选择该组会拒绝流量。客户端保存的旧选择可能覆盖初始默认，需要手动切换。后续应用选择组沿用“总代理 → 地区 → 手选”的顺序。
- Steam 商店、社区和明确的网页例外进入 Steam 组；已知游戏下载 CDN 直连。未将整个 Steam 进程强制直连。
- 两个版权地区选择组保留 Proxies、Manual 手动入口，只筛选直接列出的地区组。Bahamut 顺序为 TW → HK → Proxies → Manual，有台湾节点时默认 TW；[动画疯官方服务范围](https://ani.gamer.com.tw/animeRule.php)为台湾、香港、澳门，现有地区组只提供 TW、HK，缺少台港节点时默认 Proxies。Bilibili 顺序为 DIRECT → TW → HK → SG → Proxies → Manual，默认 DIRECT；主站有[港澳台限定内容](https://www.bilibili.com/bangumi/play/ss5019)，[国际版官方服务地区](https://www.bilibili.tv/en/about/)包含新加坡、印度尼西亚、菲律宾、泰国、越南、马来西亚，现有五地区组中补充 SG。未新增澳门等地区组；缺少的地区自动省略。Bilibili 主站和国际版仍共用出口，各地区内容按单片授权，不保证所有内容在这些地区都可播放；DIRECT 使用当前本机出口，不会自动变成大陆出口。
- 日本服务进入日本组；无日本节点时回退到总代理。
- 地区服务不再附加无人维护的手写网站清单：已移除原来的 19 条日本网站域名补全，只保留接入的上游规则。原清单中的网站仍可能被上游或通用规则匹配，不代表阻止访问；Hulu 日版接口的上游纠错例外继续保留。
- 新增地区限定服务直接使用对应地区组：mora → JP；Hulu 美版、Peacock、Pandora → US；myTV SUPER → HK。它们不进入 Streaming，也不新增应用选择组；缺少所需地区节点时统一回退到 Proxies，与既有日本服务保持一致。
- mora 使用 Hawaiine 的独立名单，HuluUSA、Peacock、Pandora 使用 blackmatrix7，myTV SUPER 使用 MetaCubeX 的 mytvsuper 域名名单，避免套用整个 TVB 分类。地区规则优先于 Streaming 和通用平台规则，用户自定义例外继续优先；HuluUSA 上游含日版 prod.hjholdings.tv，脚本先将该域名及其子域名送往 JP，缺少 JP 时回退到 Proxies。
- Google 与 YouTube 一样，提供总代理、现有地区组和手动组供选择，不再直接列出全部单节点。
- TikTok、Spotify 各自进入对应分组，地区组按连通性测速，不保证地区解锁。TikTok 使用上游维护名单，其中也包含 CapCut、Trae 等相关域名。
- Streaming 分流六个平台：Netflix、Disney+、HBO Max、Prime Video、Crunchyroll、Paramount+，六者共用 Streaming 的出口选择。Netflix、Prime Video、Disney、HBO 使用 MetaCubeX 的域名名单；ParamountPlus 使用 blackmatrix7；Crunchyroll 使用 [liandu2024 的独立名单](https://github.com/liandu2024/clash/blob/main/list/Crunchyroll.list)。YouTube 也使用 MetaCubeX 域名名单，避免原名单中的整个 gvt1/gvt2 更新后缀。维护分类仍可能包含相关产品或共享服务，不保证完全独占。
- ParamountPlus 上游包含 NBC 等平台也使用的 `link.theplatform.com`。此共享播放接口固定跟随 Proxies，避免因切换 Streaming 地区误改 NBC 出口；Paramount+ 使用该接口时也跟随 Proxies，域名分流无法区分同一主机下的不同平台路径。用户自定义例外仍优先，其他 Paramount+ 专属域名继续走 Streaming。
- Netflix、Prime Video、Disney、HBO 的域名名单避免原名单中的宽泛 AWS 区域后缀；不再使用这四者原 classical 名单的 IP/进程规则。Disney/HBO 换源并非全集等价，使用精简的维护分类而不是补回共享后缀。实际播放仍需按自己的账号、客户端和节点验证。地方专属平台不因本次扩充加入 Streaming，日本服务等既有分流保留。
- Global 和 Apple 分别使用同一上游的 Domain 名单及剩余 classical 名单，两条相邻规则保持同一出口及 `no-resolve`；域名通过域名树匹配，IP、关键字和进程规则仍保留。不能只使用基础 `Global.yaml` / `Apple.yaml`，否则会丢失大量域名。两个浮动文件更新不是原子的；范围守卫可核对同一上游提交，不能保证未来客户端独立更新完全同步。需要回退时将两条合回原目标的完整 `_Classical.yaml` provider，并重新生成和验证单文件。
- 已知平台进入相应分组；剩余目标进入 Final，默认代理。
- 专用 BT 客户端的进程直连规则位于服务和国内域名规则之后，通用下载器按目标分流。

本配置不是自动识别所有被封网站的探测器，也不保证地区解锁或所有网站都适合所选出口。

## 自动更新的范围

| 来源 | 数据 | 桌面 / 手机周期 |
| --- | --- | --- |
| [blackmatrix7/ios_rule_script](https://github.com/blackmatrix7/ios_rule_script) | 25 个规则集，含 Global/Apple 各自的域名与残余规则，以及 ParamountPlus、HuluUSA、Peacock、Pandora | 24 / 48 小时 |
| [Hawaiine/mihomo-rules](https://github.com/Hawaiine/mihomo-rules/blob/main/ruleset/mora/mora.yaml) | mora 独立规则集 | 24 / 48 小时 |
| [liandu2024/clash](https://github.com/liandu2024/clash/blob/main/list/Crunchyroll.list) | Crunchyroll 独立规则集 | 24 / 48 小时 |
| [Sukka](https://ruleset.skk.moe/Clash/domainset/game-download.txt) | 游戏下载 CDN | 12 / 24 小时 |
| [caserangle/clash-rule](https://github.com/caserangle/clash-rule) | Steam 网页例外 | 24 / 48 小时 |
| [MetaCubeX/meta-rules-dat](https://github.com/MetaCubeX/meta-rules-dat) | Netflix、Prime Video、myTV SUPER、Disney、HBO、YouTube 六个域名规则集；完整地理数据 | 规则集 24 / 48 小时；地理数据 24 / 72 小时，需同步客户端 |

以上是客户端尝试更新的周期，依赖网络和上游可用性。外部名单遵循各自维护者的规则和许可。

**脚本逻辑和配套 YAML 不会因机场订阅或外部规则集更新而自动同步。** 在 Clash Verge Rev 中升级本仓库版本，需要重新获取这两个文件并更新扩展内容。FlClash 使用远程单文件脚本时，可通过其“同步”入口获取新版。已有的个人修改应单独保留并合并，避免直接覆盖。

## 自定义例外

JS 开头的 `CUSTOM_DIRECT_DOMAINS` 和 `CUSTOM_PROXY_DOMAINS` 默认为空。

需要时在自己的副本内填写域名后缀，不填协议、路径、端口、IP、通配符或逗号。更具体后缀优先，相同后缀同时指定时代理优先；这些例外也会同步设置 DNS 策略。

公司私有域名需要对应内网 DNS，不应直接交给公共 DNS。自定义直连会按内核的域名精度继承已有映射，支持逗号多域名、`+.`、`.` 和整标签 `*` 通配；既有根域和子域 DNS 分别保留，本地域名默认使用系统 DNS，没有对应映射时才使用国内公共 DNS。自定义代理后缀使用境外 DNS，但既有更具体的子域 DNS 仍优先保留，可能出现该子域流量代理、DNS 沿用私有解析的情况。配套 YAML 使用明确的 Fake-IP 黑名单基线；自己已有的兼容项需要迁移。普通未分类查询可能发给国内 DNS，本配置不以 DNS 匿名化为目标。

## 兼容范围与回滚

- 仅重建直接在 `proxies` 中提供节点的订阅。纯 `proxy-providers` 和混合 provider 输入原样返回，没有实现其策略重建。
- 节点协议、服务器、端口和凭据不改；策略组、规则集和路由规则会重建。Fake-IP 过滤项、proxy-server-nameserver-policy 及域名嗅探设置引用的规则集会按需保留；嗅探的 force-domain、skip-domain、skip-src-address、skip-dst-address 依赖也会在 DNS 缺省或关闭时检查，嗅探关闭时同样保留内核仍需解析的引用。DNS 关闭时也保留原 nameserver-policy 的依赖。DNS 模式、规则类型及 selector 前缀按内核语义忽略大小写，RULE-SET 的逗号字段会修剪空格，规则集名称本身保留大小写。缺失依赖、与内置规则集重名冲突，或保留的 DNS/规则集下载出口引用已删除的旧组时，会在修改配置前报错；请先迁移对应依赖。真实网卡名和仍保留的节点出口不受影响。
- 重名节点、与生成分组重名的节点、依赖旧订阅组的 `dialer-proxy` 会报错，应先解决输入冲突。
- 保留的 listeners、两种 tunnels 写法、NTP 的 `dialer-proxy`、子规则的固定出口也会在输出前检查；引用已删除的组或不存在的出口会报错，不自动重定向。子规则（含嵌套逻辑条件）及 TUN 的 `route-address-set` / `route-exclude-address-set` 依赖的规则集按需保留，沿用相同的缺失、重名及旧下载出口检查。
- 全局 IPv6、TUN 开关、端口和系统代理仍由客户端管理；配套 YAML 的 DNS IPv6 默认为关闭。其他设备按自己的环境决定客户端开关。
- 出现问题时恢复自己的两份扩展备份，重新激活订阅，并检查分组选择。

## 验证

在仓库根目录执行：

```sh
node --check linkcube-generic.js
node --check flclash-single.js
node --check flclash-mobile.js
node --test tests/*.test.cjs
python -m unittest discover -s tests -p 'test_*.py'
python scripts/build_flclash.py --check
python scripts/check_rule_scope.py --snapshot tests/fixtures
```

Node 测试只使用内置模块；Python 测试需要 PyYAML。流媒体名单范围测试使用 tests/fixtures 中的离线快照；运行时仍按上游最新名单更新，快照不能保证未来上游范围不变。

`tests/test_kernel.py` 默认跳过；设置 `MIHOMO_BIN` 为安装的 Mihomo 可执行文件后再运行 Python 测试，可检查多域名/通配/根子域 DNS 的实际答案、HTTP 503 判定、两版首次 HEAD 数及保留子规则/隧道依赖。测试只监听回环、关闭 TUN，不操作正在使用的客户端；DNS 实验特意隔离普通域名策略，不能当作完整 GEO 数据与真实订阅联网验收。Windows 示例：

```powershell
$env:MIHOMO_BIN='C:\Program Files\Clash Verge\verge-mihomo.exe'
python -m unittest discover -s tests -p 'test_*.py'
```

新增快照的固定提交、原始 URL、校验和及完整 classical 集合摘要记录于 `tests/fixtures/reviewed-sources.json`。需要联网核对更新时，执行 `python scripts/check_rule_scope.py --commit <blackmatrix7完整提交SHA>`，同一次检查的三份文件均从该 SHA 获取；不会改写快照或修改运行时订阅。域名和残余合并后的集合必须与完整名单相同。

回归覆盖全部 32 种地区组合、两版业务等价与限定参数差异、内网 DNS 继承、保留依赖的原子校验、共享云服务负例、Global/Apple 完整范围及输入输出隔离。离线测试使用文档专用 IP 和 `TEST-ONLY` 假密码，没有可用节点；实际账号播放、内网环境、网络切换和待机耗电另需实机验收。

维护者修改通用 JS、YAML 或档位参数后，运行 `python scripts/build_flclash.py` 同时重新生成两个单文件，再执行以上检查。`--check` 会检查两份产物。生成器只在本地构建时需要 PyYAML；设备导入后的单文件不需要 Python、模块加载或在线下载另一份脚本。

此前规则曾在 Windows / Clash Verge Rev 2.5.8 / Mihomo v1.19.32 环境配合个人覆写联网使用；本批双版本变更仍需实机验收。HTTP 403 若带 `cf-mitigated: challenge`，代表浏览器验证页，应通过真实浏览器验证，不能直接认定节点失效。
