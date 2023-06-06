---
title: gerrit代码审查工具
date: 2022-10-15 14:20:55
tags:
cover: http://cdn.pluto1811.com/20221020140348.png
---

<img src="http://cdn.pluto1811.com/20221027100713.png"/>

<img src="http://cdn.pluto1811.com/20221027101028.png"/>

<img src="http://cdn.pluto1811.com/20221027103343.png"/>

<img src="http://cdn.pluto1811.com/20221027103428.png"/>

<img src="http://cdn.pluto1811.com/20221027103450.png"/>

<img src="http://cdn.pluto1811.com/20221027103450.png"/>

<img src="http://cdn.pluto1811.com/20221027103720.png"/>

<img src="http://cdn.pluto1811.com/20221027103622.png"/>

<img src="http://cdn.pluto1811.com/20221027103811.png"/>

<img src="http://cdn.pluto1811.com/20221027103857.png"/>

<img src="http://cdn.pluto1811.com/20221027105137.png"/>

<img src="http://cdn.pluto1811.com/20221027105416.png"/>

<img src="http://cdn.pluto1811.com/20221027105505.png"/>

<img src="http://cdn.pluto1811.com/20221027105528.png"/>

<img src="http://cdn.pluto1811.com/20221027105602.png"/>

<img src="http://cdn.pluto1811.com/20221027105628.png"/>

<img src="http://cdn.pluto1811.com/20221027105702.png"/>

<img src="http://cdn.pluto1811.com/20221027110015.png"/>

<img src="http://cdn.pluto1811.com/20221027110032.png"/>

### 使用注意：

1. git config --global alias.cr '!git push review HEAD:refs/for/$(git rev-parse --abbrev-ref HEAD)'
   执行这条命令，可以简化推送的命令，有些小伙伴还没配置
2. 同一个 commit，在做了 fix 之后，要执行
   git add .
   git commit --amend --no-edit
   不要让一个 commit，产生 2 个 reivew ID
3. 提了 comments，修复之后，点了 DONE，还要点 REPLAY，弹框会有个 pushlish，这样你的回复，reviewer 的人才看得到
4. git push review 这条命令仅用于切换了新分支后使用，一个功能分支生命周期内只能执行一次 git push review
