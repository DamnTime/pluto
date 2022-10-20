---
title: 【超实用】完美实现基于hexo的博客网站自动化部署
date: 2022-10-19 14:20:58
tags:
cover: http://cdn.pluto1811.com/20221020140348.png
---

### 前言

作为一名程序员到底有没有必要写技术博文？一千个读者眼中就会有一千个哈姆雷特，反对的人可能会说：没时间写、写了也没人看。。。我试着站在乐观的角度解答这个问题。先说结论：很有必要。

1. 温故而知新，写博文就是一个对知识体系回顾的过程。不是常有人抱怨说，新学的技术没过两天就忘了吗？试着写博文就是一个很好的记忆方式。
2. 写得过程就是一种对技术严谨的态度的升华。写博文心态上会发生变化，不会那么随意。为了保证知识点尽量准确，期间会查阅各种资料，其实是在补齐自己的短板。
3. 无形之中锻炼了自己的文笔，可能又有杠精出来说：程序员要文笔干嘛？文笔又不能修复 bug😁。事实上，任何一种技能都是有用的，只是看是否适合自己，如果有一种方式既可以巩固知识又可以锻炼文笔，何乐而不为呢？

### 选择博客框架

既然想着写博客没有一个合适的工具怎么可以呢？关于博客框架有很多，比如：<a href="https://b3log.org/solo/" target="_blank">Solo</a>、<a href="https://blog.getpelican.com/" target="_blank">pelican</a>、<a href="https://hexo.io/zh-cn/" target="_blank">Hexo</a>、<a href="https://jekyllrb.com/" target="_blank">Jekyll</a> 等等。笔者这里选择的是 Hexo。主要是因为：

1. 使用 Markdown 解析文章，只需要几秒，就能生成一个靓丽的静态网页；
2. 官网支持中文，打开官方文档，有详细地使用说明，一行代码安装搞定 npm install -g hexo-cli；
3. 同时兼容 Window Mac Linux，做到真正的跨平台；
4. 拥有丰富的插件和主题。

### 超高性价比的部署方式

博客网站一般部署在自有云服务器、github、gitee 等，首先我们这里先排除掉云服务器（因为要给钱啊 😁），另外由于某些特殊原因，github 有时候会抽风，并且速度也不咋地。综上考虑，把我们的博客部署在 gitee pages 上是最具性价比的。

#### 初始化 hexo 项目

这个过程简直不要太简单，各位可以看看 <a href="https://hexo.io/zh-cn/docs/" target="_blank">官网</a>，这里只说一下安装命令：

```js
npm install -g hexo-cli

// 新建博客
hexo init <your blog name>
```

#### 搭建 gitee pages

gitee pages 这个功能需要实名认证，这里不得不吐槽下 gitee 相关审核工作，进度实在太慢了，虽然官网说的是 1-2 个工作日，但我当时审核时间大概有一个星期左右。

1. 快速创建一个仓库，成功后将仓库设置成开源
   <img src="http://cdn.pluto1811.com/20221019175110.png"/>

2. 安装 hexo-deployer-git

```shell
npm install hexo-deployer-git
```

3. 配置 \_config.yml

```yml
deploy:
  type: git
  repo: 远程地址
  token: gitee 私人令牌
  name: 登录用户名
  email: 关联邮箱
  branch: master
  ignore_hidden: false
```

4. 生成 gitee 私人令牌
   <img src="http://cdn.pluto1811.com/20221019180205.png"/>

这里需要注意，令牌一旦生成后续不可查看，需要在生成时及时复制，填充至上面配置的 token 字段中。

#### 小结

至此，我们其实已经可以部署我们博客了，步骤如下：

1. 本地运行

```shell
npm run build && npm run deploy
```

2. 在 gitee pages 中点击更新
   <img src="http://cdn.pluto1811.com/20221019182656.png"/>

但是作为一名合格的程序员，怎么能允许有这么繁琐的操作呢？接下来，我们看看如何自动化部署。

### 自动化部署

首先我们期望的是，只要我们本地提交至远程，那么就需要触发 gitee pages 进行更新。但遗憾的是目前 gitee 除非开启我们的“钞能力”😁，否则是没法使用 web hooks 的，但 github 可以免费使用这个功能。因此这里我们需要：

1. github 提供的 web hooks，一旦我们提交至远程，使用 <a href="">yanglbme/gitee-pages-action@main</a> 触发 gitee pages 更新；
2. 在 push 之前，我们需要执行本地的 deploy 操作，将文章推送到 gitee pages 上；

#### 编写 github work flows 脚本

```yml
name: Sync To Gitee

on: [push, delete, create]

jobs:
  pages:
    runs-on: ubuntu-latest
    steps:
      - name: Build Gitee Pages
        uses: yanglbme/gitee-pages-action@main
        with:
          # 注意替换为你的 Gitee 用户名
          gitee-username: XXXX
          # 注意在 Settings->Secrets 配置 GITEE_PASSWORD
          gitee-password: ${{ secrets.GITEE_PASSWORD }}
          # 注意替换为你的 Gitee 仓库，仓库名严格区分大小写，请准确填写，否则会出错
          gitee-repo: XXXX
          # 要部署的分支，默认是 master，若是其他分支，则需要指定（指定的分支必须存在）
          branch: XXXX
```

#### push 之前部署我们的博客

这里需要用到 git hooks，首先安装

```shell
npm install -D pre-push
```

然后在 package.json 新增

```json
  "pre-push": [
    "deploy"
  ],
```

注意这里 deploy 一定要与 scripts 中的脚本执行命令保持一致

```json
  "scripts": {
    "deploy": "hexo deploy"
  }
```

### 总结

总结一下以上步骤，其实就是在我们本地 push 之前，利用 git hooks 执行部署命令，同步到了 gitee pages 上，再触发 github work flows 触发 gitee pages 的更新。另外由于我们采用这种方式部署博客，那么有一个特别注意的点：

```yml
# 在 _config.yml 需要配置
url: 你的gitee pages远程地址
root: gitee pages 根目录
```

但是如果我们这样配置时，会影响到我们的本地开发环境（npm run server）的运行结果。因此我们还需要区分一下 <a href="https://hexo.io/zh-cn/docs/configuration#%E4%BD%BF%E7%94%A8%E4%BB%A3%E6%9B%BF%E9%85%8D%E7%BD%AE%E6%96%87%E4%BB%B6" target="_blank">运行环境</a>

在根目录下新增 \_config.dev.yml 文件

```yml
url: http://127.0.0.1
root: /
```

修改 package.json 文件本地开发的脚本命令

```json
  "scripts": {
    "server": "hexo server --config _config.yml,_config.dev.yml"
  },
```

好了，以上就是 hexo 博客框架自动化部署的整个过程，当然，hexo 还有许多功能值得我们探索，各位快来试试吧！是真香，真免费啊！
