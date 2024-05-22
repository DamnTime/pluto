---
title: babel 探秘系列-基础篇
date: 2022-08-10 13:20:55
tags:
cover: https://cdn.JsDelivr.net/gh/DamnTime/pluto-img-bed@main/img/202405221543690.png
---

# babel 探秘-基础篇

在现代前端开发中，babel 可以说是一道绕不过去的坎，它让我们可以尽情的使用 esnext 语法（装逼）。当然，我们可以不去关心 babel 的配置吗？毕竟有那么多，毕竟搜索引擎在手天下我有。。。能给你找一大堆理由出来，你信不信。

不过为了技术水平的提升（还嫌不够卷吗？？），还是想去了解下。

## babel 是什么

> - Babel 是一个 Javascript 转译器 （Transpiler）
> - babel 最开始叫 6to5，顾名思义是 es6 转 es5，但是后来随着 es 标准的演进，有了 es7、es8 等， 6to5 的名字已经不合适了，所以改名为了 babel。
> - babel 是巴别塔的意思，来自圣经中的典故：
>   当时人类联合起来兴建希望能通往天堂的高塔，为了阻止人类的计划，上帝让人类说不同的语言，使人类相互之间不能沟通，计划因此失败，人类自此各散东西。于是世上出现不同语言和种族提供解释。这座塔就是巴别塔。（取名字的艺术之高超啊。。。）

## babel 有什么用

> - 把代码中的 esnext 的新的语法、typescript 和 flow 的语法转成基于目标环境支持的语法
> - 通过 Polyfill 方式在目标环境中添加缺失的特性(@babel/polyfill 模块)

## babel 怎么配置

可分为两个层面：

### 一：语法层面：

比如箭头函数、let、const、展开运算符等；
需要转译箭头函数时：

```js
//.babelrc
{
    "plugins": ["@babel/plugin-transform-arrow-functions"]
     // 当然也可以相对路径引入
    "plugins": ["./node_modules/@babel/plugin-transform-arrow-functions"]
}
```

此时会发现如果一个个配置的话，会非常繁琐，可能需要配置几十个插件，因此就引出我们第一个配置重点：preset。从字面我们可以理解到这是“预设”的意思。

## 官方 Preset

#### @babel/preset-env

- 一篮子的 es next plugins 的集合, 主要是针对最新的 js 语法特性作 es5 语法的转换

#### @babel/preset-flow

- 主要包含@babel/plugin-transform-flow-strip-types 插件，针对 flow 语法的转换

#### @babel/preset-react

- 主要包含@babel/plugin-syntax-jsx、@babel/plugin-transform-react-jsx、@babel/plugin-transform-react-display-name，针对 jsx 语法的转换

#### @babel/preset-typescript

- 主要包含@babel/plugin-transform-flow-strip-types 插件，对 ts 语法的转换

## 这里主要介绍 @babel/preset-env

在不进行任何配置的情况下，@babel/preset-env 所包含的插件将支持所有最新的 JS 特性(ES2015,ES2016 等，不包含 stage 阶段)，将其转换成 ES5 代码，如果没有在 Babel 配置文件中(如 .babelrc)设置 targets 或 ignoreBrowserslistConfig，@babel/preset-env 会使用 [browserslist](https://github.com/browserslist/browserslist) 配置源，显然如果指定了[browserslist](https://github.com/browserslist/browserslist)配置源会减少我们编译后的代码体积
配置 browserslist 有三种方法：

1. 在 babel 配置文件中 指定 target；
2. 在项目根目录添加 .browserslistrc 文件；
3. 在 package.json 文件中指定 browserslist 属性；

例如：

```js
// babel.config.js
module.exports = {
  presets: [
    [
      "@babel/preset-env",
      {
        targets: "last 2 Chrome versions",
      },
    ],
  ],
};
```

## 二、babel 用法-api 层面

刚刚我们说到了 @babel/preset-env 主要是针对语法层面的转译，但这还不够，还需要对 api 层面进行转换，比如 includes、Array.from 等等。此时我们的@babel-polyfill 便派上用场了；
polyfill 的使用同样可以分为两种：

1. babel-polyfill
   会污染全局适合在业务项目中使用。（Babel7.4.0 版本开始，babel/polyfill 已经被废弃，推荐直接使用 core-js）;
2. babel-runtime
   不污染全局适合在组件或类库项目中使用。

### 第一种（babel-polyfill）方式：

两种引入方式：

1. 简单粗暴，直接在项目入口文件或 webpack 中配置 entry 属性;
   这种是方式全量引入，缺点也很明显，最终打包体积势必会增大
2. 在 babel 的配置文件中设置 useBuiltIns 参数为 usage（按需引入），同时设置 corejs (如果不设置，会给出警告，默认使用的是"corejs": 2)，这里建议安装 core-js@3，因为 core-js@2 分支中已经不会再添加新特性，新特性都会添加到 core-js@3，此时可以将之前全量引入的 @babel/polyfill 删除了，因为会直接从 core-js 中引入 polyfill

```js
// babel.config.js
module.exports = {
  presets: [
    [
      "@babel/preset-env",
      {
        useBuiltIns: "usage",
        corejs: 3,
      },
    ],
  ],
};
```

### 第二种方式（babel-runtime）的方式：

```js
npm install --save-dev @babel/plugin-transform-runtime
npm install --save @babel/runtime // 注意这里是 --save 表示会在生产环境中作为依赖被安装
```

这两个插件需要配合使用，于是像这样配置：

```js
// babel.config.js
module.exports = {
  presets: [
    [
      "@babel/preset-env",
      {
        useBuiltIns: "usage",
        corejs: 3,
      },
    ],
  ],
  plugins: [["@babel/plugin-transform-runtime"]],
};
```

如果这样配置，并不能解决问题，polyfill 的方法依然会污染全局，此时需要再引入 @babel/runtime-corejs3
npm install @babel/runtime-corejs3 --save
摘自官方的一段话，我们就知道为什么更推荐使用 core3 了
![](http://cdn.pluto1811.com/1626857604731.jpg)

最终配置：

```js
// babel.config.js
module.exports = {
  presets: [["@babel/preset-env"]],
  plugins: [
    [
      "@babel/plugin-transform-runtime",
      {
        corejs: 3,
        // useBuiltIns: 'usage' 在babel7.x 版本被废除 已经默认配置了
      },
    ],
  ],
};
```

## Q&A

1. **Q:** 如果同时配置 presets 中 corejs：3 和 @babel/plugin-transform-runtime 中的 corejs：3 有什么影响？
   **A:** 几乎没什么影响，猜测与 babel 转译顺序有关，babel 的 plugin 比 prset 要先执行，preset-env 得到的是 @babel/runtime 使用帮助函数包装后的代码，里面已经什么需要转译的部分了。

2. **Q:** 给 @babel/plugin-transform-runtime 配置 corejs 是否真的如此的完美，既可以将帮助函数变成引用的形式，又可以动态引入 polyfill，并且不会污染全局环境。
   **A:** @babel/plugin-transform-runtime 包本身 体积会比 @babel/preset-env 要大
