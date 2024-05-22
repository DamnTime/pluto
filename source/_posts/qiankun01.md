---
title: qiankun源码解读-示例篇
date: 2022-09-05 13:10:55
tags:
cover: https://cdn.JsDelivr.net/gh/DamnTime/pluto-img-bed@main/img/202405221541764.png
---

## 介绍

<font color="#ec5d3" bgcolor="#fdf5f5">qiankun</font> 是基于 single-spa 做了二次封装的微前端框架，既然是二次封装，那么少不了在此基础上解决了一些 single-spa 的缺陷和不足。

## single-spa 有哪些不足（其实也是<font color="#ec5d3" bgcolor="#fdf5f5">qiankun</font>的优点）

### 1. 打包工具配置的不友好

侵入型强其实说的就是第三点，更改打包工具的配置，使用 <font color="#ec5d3" bgcolor="#fdf5f5">single-spa</font> 接入微应用需要将微应用整个打包成一个 JS 文件，发布到静态资源服务器，然后在主应用中配置该 JS 文件的地址告诉 <font color="#ec5d3" bgcolor="#fdf5f5">single-spa</font> 去这个地址加载微应用。

不说其它的，就现在这个改动就存在很大的问题，将整个微应用打包成一个 JS 文件，常见的打包优化基本上都没了，比如：按需加载、首屏资源加载优化、css 独立打包等优化措施。

### 2. 样式隔离问题

<font color="#ec5d3" bgcolor="#fdf5f5">single-spa</font> 没有做这部分的工作。这时只能通过约定命名规范来实现，比如应用样式以自己的应用名称开头，以应用名构造一个独立的命名空间，这个方式新系统还好说，如果是一个已有的系统，这个改造工作量可不小。

### 3. JS 隔离

这部分工作 single-spa 也没有做。 JS 全局对象污染是一个很常见的现象，难以排查，有可能是灾难性的。

### 4. 资源预加载

这部分的工作<font color="#ec5d3" bgcolor="#fdf5f5">single-spa</font> 更没做了，因为<font color="#ec5d3" bgcolor="#fdf5f5">single-spa</font> 已经将微应用整个打包成了一个 js 文件。

### 5. 应用间通信

这部分工作 <font color="#ec5d3" bgcolor="#fdf5f5">single-spa</font> 没做，它只在注册微应用时给微应用注入一些状态信息，后续就不管了，没有任何通信的手段，只能用户自己去实现。

## 系列文章

> [微前端框架之源码示例项目与框架源码解读](https://www.zybuluo.com/static/img/logo.png)，由源码最简单的部分入门，先搞懂怎么启动项目的，api 怎么调用的。带着问题，再去读源码事半功倍。

> [qiankun 2.x 运行时沙箱 源码分析](https://www.zybuluo.com/static/img/logo.png)，详细解读了 qiankun 2.x 版本的沙箱实现

> [HTML Entry 源码分析](https://www.zybuluo.com/static/img/logo.png)，详细解读了 HTML Entry 的原理以及在 qiankun 中的应用

## 框架目录结构

从 [github](https://github.com/liyongning/qiankun) 克隆项目
![1615968380013.jpg](http://cdn.pluto1811.com/forEditor/1615968394334/1615968380013.jpg)

---

#### 不简单的 package.json

- [npm-run-all](https://www.npmjs.com/package/npm-run-all)

  > 一个 CLI 工具，用于并行或顺序执行多个 npm 脚本

- [father-build](https://www.npmjs.com/package/father-build)

  > 基于 rollup 的库构建工具，father 更加强大

- 多项目的目录组织以及 scripts 部分的编写
- main 和 module 字段
  > 标识组件库的入口，当两者同时存在时，module 字段的优先级高于 main

## 示例项目

### 主应用

主应用在 <font color="#ec5d3" bgcolor="#fdf5f5">examples/main</font> 目录下，提供了两种实现方式，基于路由配置的 <font color="#ec5d3" bgcolor="#fdf5f5">registerMicroApps</font> 和 手动加载微应用的 <font color="#ec5d3" bgcolor="#fdf5f5">loadMicroApp</font>。主应用很简单，就是一个从 0 通过 webpack 配置的一个同时支持 react 和 vue 的项目，至于为什么同时支持 react 和 vue，继续往下看

#### webpack.config.js

就是一个普通的 webpack 配置，配置了一个开发服务器 devServer、两个 loader (babel-loader、css loader)、一个插件 HtmlWebpackPlugin (告诉 webpack html 模版文件是哪个)
通过 webpack 配置文件的 entry 字段得知入口文件分别为 <font color="#ec5d3" bgcolor="#fdf5f5">index.js</font> 和 <font color="#ec5d3" bgcolor="#fdf5f5">multiple.js</font>

#### 基于路由配置

通用将微应用关联到一些 url 规则的方式，实现当浏览器 url 发生变化时，自动加载相应的微应用的功能

#### index.js

```js
// qiankun api 引入
import {
  registerMicroApps,
  runAfterFirstMounted,
  setDefaultMountApp,
  start,
  initGlobalState,
} from "../../es";
// 全局样式
import "./index.less";

// 专门针对 angular 微应用引入的一个库
import "zone.js";

/**
 * 主应用可以使用任何技术栈，这里提供了 react 和 vue 两种，可以随意切换
 * 最终都导出了一个 render 函数，负责渲染主应用
 */
// import render from './render/ReactRender';
import render from "./render/VueRender";

// 初始化主应用，其实就是渲染主应用
render({ loading: true });

// 定义 loader 函数，切换微应用时由 qiankun 框架负责调用显示一个 loading 状态
const loader = (loading) => render({ loading });

// 注册微应用
registerMicroApps(
  // 微应用配置列表
  [
    {
      // 应用名称
      name: "react16",
      // 应用的入口地址
      entry: "//localhost:7100",
      // 应用的挂载点，这个挂载点在上面渲染函数中的模版里面提供的
      container: "#subapp-viewport",
      // 微应用切换时调用的方法，显示一个 loading 状态
      loader,
      // 当路由前缀为 /react16 时激活当前应用
      activeRule: "/react16",
    },
    {
      name: "react15",
      entry: "//localhost:7102",
      container: "#subapp-viewport",
      loader,
      activeRule: "/react15",
    },
    {
      name: "vue",
      entry: "//localhost:7101",
      container: "#subapp-viewport",
      loader,
      activeRule: "/vue",
    },
    {
      name: "angular9",
      entry: "//localhost:7103",
      container: "#subapp-viewport",
      loader,
      activeRule: "/angular9",
    },
    {
      name: "purehtml",
      entry: "//localhost:7104",
      container: "#subapp-viewport",
      loader,
      activeRule: "/purehtml",
    },
  ],
  // 全局生命周期钩子，切换微应用时框架负责调用
  {
    beforeLoad: [
      (app) => {
        // 这个打印日志的方法可以学习一下，第三个参数会替换掉第一个参数中的 %c%s，并且第三个参数的颜色由第二个参数决定
        console.log("[LifeCycle] before load %c%s", "color: green;", app.name);
      },
    ],
    beforeMount: [
      (app) => {
        console.log("[LifeCycle] before mount %c%s", "color: green;", app.name);
      },
    ],
    afterUnmount: [
      (app) => {
        console.log(
          "[LifeCycle] after unmount %c%s",
          "color: green;",
          app.name
        );
      },
    ],
  }
);

// 定义全局状态，并返回两个通信方法
const { onGlobalStateChange, setGlobalState } = initGlobalState({
  user: "qiankun",
});

// 监听全局状态的更改，当状态发生改变时执行回调函数
onGlobalStateChange((value, prev) =>
  console.log("[onGlobalStateChange - master]:", value, prev)
);

// 设置新的全局状态，只能设置一级属性，微应用只能修改已存在的一级属性
setGlobalState({
  ignore: "master",
  user: {
    name: "master",
  },
});

// 设置默认进入的子应用，当主应用启动以后默认进入指定微应用
setDefaultMountApp("/react16");

// 启动应用
start();

// 当第一个微应用挂载以后，执行回调函数，在这里可以做一些特殊的事情，比如开启一监控或者买点脚本
runAfterFirstMounted(() => {
  console.log("[MainApp] first app mounted");
});
```

---

#### ReactRender.js

```js
/**
 * 同 vue 实现的渲染函数，这里通过 react 实现了一个一样的渲染函数
 */
import React from "react";
import ReactDOM from "react-dom";

// 渲染主应用
function Render(props) {
  const { loading } = props;

  return (
    <>
      {loading && <h4 className="subapp-loading">Loading...</h4>}
      <div id="subapp-viewport" />
    </>
  );
}

// 将主应用渲染到指定节点下
export default function render({ loading }) {
  const container = document.getElementById("subapp-container");
  ReactDOM.render(<Render loading={loading} />, container);
}
```

---

#### VueRender.js

```js
/**
 * 导出一个由 vue 实现的渲染函数，渲染了一个模版，模版里面包含一个 loading 状态节点和微应用容器节点
 */
import Vue from "vue/dist/vue.esm";

// 返回一个 vue 实例
function vueRender({ loading }) {
  return new Vue({
    template: `
      <div id="subapp-container">
        <h4 v-if="loading" class="subapp-loading">Loading...</h4>
        <div id="subapp-viewport"></div>
      </div>
    `,
    el: "#subapp-container",
    data() {
      return {
        loading,
      };
    },
  });
}

// vue 实例
let app = null;

// 渲染函数
export default function render({ loading }) {
  // 单例，如果 vue 实例不存在则实例化主应用，存在则说明主应用已经渲染，需要更新主营应用的 loading 状态
  if (!app) {
    app = vueRender({ loading });
  } else {
    app.loading = loading;
  }
}
```

#### 手动加载微应用

通常这种场景下的微应用是一个不带路由的可独立运行的业务组件，这种使用方式的情况比较少见

#### multiple.js

```js
import { loadMicroApp } from "../../es";

let app;

function mount() {
  app = loadMicroApp(
    { name: "react15", entry: "//localhost:7102", container: "#react15" },
    { sandbox: { experimentalStyleIsolation: true } }
  );
}

function unmount() {
  app.unmount();
}

document.querySelector("#mount").addEventListener("click", mount);
document.querySelector("#unmount").addEventListener("click", unmount);

loadMicroApp({ name: "vue", entry: "//localhost:7101", container: "#vue" });
```

<br />

---

### 微应用

#### vue

vue 微应用在 <font color="#ec5d3" bgcolor="#fdf5f5">examples/vue</font> 目录下，就是一个通过 vue-cli 创建的 vue demo 应用，然后对 <font color="#ec5d3" bgcolor="#fdf5f5">vue.config.js</font> 和 <font color="#ec5d3" bgcolor="#fdf5f5">main.js</font> 做了一些更改

#### vue.config.js

需要注意的地方就三点

```js
{
  ...
  // publicPath 没在这里设置，是通过 webpack 提供的全局变量 __webpack_public_path__ 来即时设置的，webpackjs.com/guides/public-path/
  devServer: {
    ...
    // 设置跨域，因为主应用需要通过 fetch 去获取微应用引入的静态资源的，所以必须要求这些静态资源支持跨域
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
  },
  output: {
    library: `${name}-[name]`,	// 库名称，唯一
    // 将你的 library 暴露为所有的模块定义下都可运行的方式
    libraryTarget: 'umd',
    jsonpFunction: `webpackJsonp_${name}`,
  }
  ...
}
```

#### main.js

```js
// 动态设置 __webpack_public_path__
import "./public-path";
import ElementUI from "element-ui";
import "element-ui/lib/theme-chalk/index.css";
import Vue from "vue";
import VueRouter from "vue-router";
import App from "./App.vue";
// 路由配置
import routes from "./router";
import store from "./store";

Vue.config.productionTip = false;

Vue.use(ElementUI);

let router = null;
let instance = null;

// 应用渲染函数
function render(props = {}) {
  const { container } = props;
  // 实例化 router，根据应用运行环境设置路由前缀
  router = new VueRouter({
    // 作为微应用运行，则设置 /vue 为前缀，否则设置 /
    base: window.__POWERED_BY_QIANKUN__ ? "/vue" : "/",
    mode: "history",
    routes,
  });

  // 实例化 vue 实例
  instance = new Vue({
    router,
    store,
    render: (h) => h(App),
  }).$mount(container ? container.querySelector("#app") : "#app");
}

// 支持应用独立运行
if (!window.__POWERED_BY_QIANKUN__) {
  render();
}

/**
 * 从 props 中获取通信方法，监听全局状态的更改和设置全局状态，只能操作一级属性
 * @param {*} props
 */
function storeTest(props) {
  props.onGlobalStateChange &&
    props.onGlobalStateChange(
      (value, prev) =>
        console.log(`[onGlobalStateChange - ${props.name}]:`, value, prev),
      true
    );
  props.setGlobalState &&
    props.setGlobalState({
      ignore: props.name,
      user: {
        name: props.name,
      },
    });
}

/**
 * 导出的三个生命周期函数
 */
// 初始化
export async function bootstrap() {
  console.log("[vue] vue app bootstraped");
}

// 挂载微应用
export async function mount(props) {
  console.log("[vue] props from main framework", props);
  storeTest(props);
  render(props);
}

// 卸载、销毁微应用
export async function unmount() {
  instance.$destroy();
  instance.$el.innerHTML = "";
  instance = null;
  router = null;
}
```

#### public-path.js

```js
/**
 * 在入口文件中使用 ES6 模块导入，则在导入后对 __webpack_public_path__ 进行赋值。
 * 在这种情况下，必须将公共路径(public path)赋值移至专属模块，然后将其在最前面导入
 */

// qiankun 设置的全局变量，表示应用作为微应用在运行
if (window.__POWERED_BY_QIANKUN__) {
  // eslint-disable-next-line no-undef
  // __webpack_public_path__决定了webpack output.publicPath的值，用于来指定应用程序中所有的资源的基本路径
  __webpack_public_path__ = window.__INJECTED_PUBLIC_PATH_BY_QIANKUN__;
}
```

## 未完待续 ~
