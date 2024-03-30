---
title: qiankun源码解读-框架源码篇
date: 2022-09-02 10:10:55
tags:
cover: /images/qiankun02/cover.png
---

# 框架源码

整个框架的源码目录是 src，入口文件是 <font color="#ec5d3c" bgcolor="#fdf5f5f5">src/index.ts</font>

#### 入口 src/index.ts

```js
/**
 * 在示例或者官网提到的所有 API 都在这里统一导出
 */
// 最关键的三个，手动加载微应用、基于路由配置、启动 qiankun
export { loadMicroApp, registerMicroApps, start } from "./apis";
// 全局状态
export { initGlobalState } from "./globalState";
// 全局的未捕获异常处理器
export * from "./errorHandler";
// setDefaultMountApp 设置主应用启动后默认进入哪个微应用、runAfterFirstMounted 设置当第一个微应用挂载以后需要调用的一些方法
export * from "./effects";
// 类型定义
export * from "./interfaces";
// 预加载
export { prefetchImmediately as prefetchApps } from "./prefetch";
```

#### registerMicroApps

```js
/**
 * 注册微应用，基于路由配置
 * @param apps = [
 *  {
 *    name: 'react16', 微应用名称
 *    entry: '//localhost:7100', 地址
 *    container: '#subapp-viewport', 挂载点
 *    loader,
 *    activeRule: '/react16' 相应的路由匹配相应的应用
 *  },
 *  ...
 * ]
 * @param lifeCycles = { ...全局各个生命周期方法对象 }
 */
export function registerMicroApps<T extends object = {}>(
  apps: Array<RegistrableApp<T>>,
  lifeCycles?: FrameworkLifeCycles<T>,
) {
  // 防止微应用重复注册，得到所有没有被注册的微应用列表
  const unregisteredApps = apps.filter(app => !microApps.some(registeredApp => registeredApp.name === app.name));

  // 所有的微应用 = 已注册 + 未注册的(将要被注册的)
  microApps = [...microApps, ...unregisteredApps];

  // 注册每一个微应用
  unregisteredApps.forEach(app => {
    // 注册时提供的微应用基本信息
    const { name, activeRule, loader = noop, props, ...appConfig } = app;

    // 调用 single-spa 的 registerApplication 方法注册微应用
    registerApplication({
      // 微应用名称
      name,
      // 微应用的加载方法，Promise<生命周期方法组成的对象>
      app: async () => {
        // 加载微应用时主应用显示 loading 状态
        loader(true);
        // 这句可以忽略，目的是在 single-spa 执行这个加载方法时让出线程，让其它微应用的加载方法都开始执行
        await frameworkStartedDefer.promise;

        // 核心、精髓、难点所在，负责加载微应用，然后一大堆处理，返回 bootstrap、mount、unmount、update 这个几个生命周期
        const { mount, ...otherMicroAppConfigs } = await loadApp(
          // 微应用的配置信息
          { name, props, ...appConfig },
          // start 方法执行时设置的配置对象
          frameworkConfiguration,
          // 注册微应用时提供的全局生命周期对象
          lifeCycles,
        );

        return {
          mount: [async () => loader(true), ...toArray(mount), async () => loader(false)],
          ...otherMicroAppConfigs,
        };
      },
      // 微应用的激活条件
      activeWhen: activeRule,
      // 传递给微应用的 props
      customProps: props,
    });
  });
}
```

#### start

```js
/**
 * 启动 qiankun
 * @param opts start 方法的配置对象
 */
export function start(opts: FrameworkConfiguration = {}) {
  // qiankun 框架默认开启预加载、单例模式、样式沙箱
  frameworkConfiguration = {
    prefetch: true,
    singular: true,
    sandbox: true,
    ...opts,
  };
  // 从这里可以看出 start 方法支持的参数不止官网文档说的那些，比如 urlRerouteOnly，这个是 single-spa 的 start 方法支持的
  const { prefetch, sandbox, singular, urlRerouteOnly, ...importEntryOpts } =
    frameworkConfiguration;

  // 预加载
  if (prefetch) {
    // 执行预加载策略，参数分别为微应用列表、预加载策略、{ fetch、getPublicPath、getTemplate }
    doPrefetchStrategy(microApps, prefetch, importEntryOpts);
  }

  // 样式沙箱
  if (sandbox) {
    if (!window.Proxy) {
      console.warn(
        "[qiankun] Miss window.Proxy, proxySandbox will degenerate into snapshotSandbox"
      );
      // 快照沙箱不支持非 singular 模式
      if (!singular) {
        console.error(
          "[qiankun] singular is forced to be true when sandbox enable but proxySandbox unavailable"
        );
        // 如果开启沙箱，会强制使用单例模式
        frameworkConfiguration.singular = true;
      }
    }
  }

  // 执行 single-spa 的 start 方法，启动 single-spa
  startSingleSpa({ urlRerouteOnly });

  frameworkStartedDefer.resolve();
}
```

#### 预加载 - doPrefetchStrategy

```js
/**
 * 执行预加载策略，qiankun 支持四种
 * @param apps 所有的微应用
 * @param prefetchStrategy 预加载策略，四种 =》
 *  1、true，第一个微应用挂载以后加载其它微应用的静态资源，利用的是 single-spa 提供的 single-spa:first-mount 事件来实现的
 *  2、string[]，微应用名称数组，在第一个微应用挂载以后加载指定的微应用的静态资源
 *  3、all，主应用执行 start 以后就直接开始预加载所有微应用的静态资源
 *  4、自定义函数，返回两个微应用组成的数组，一个是关键微应用组成的数组，需要马上就执行预加载的微应用，一个是普通的微应用组成的数组，在第一个微应用挂载以后预加载这些微应用的静态资源
 * @param importEntryOpts = { fetch, getPublicPath, getTemplate }
 */
export function doPrefetchStrategy(
  apps: AppMetadata[],
  prefetchStrategy: PrefetchStrategy,
  importEntryOpts?: ImportEntryOpts,
) {
  // 定义函数，函数接收一个微应用名称组成的数组，然后从微应用列表中返回这些名称所对应的微应用，最后得到一个数组[{name, entry}, ...]
  const appsName2Apps = (names: string[]): AppMetadata[] => apps.filter(app => names.includes(app.name));

  if (Array.isArray(prefetchStrategy)) {
    // 说明加载策略是一个数组，当第一个微应用挂载之后开始加载数组内由用户指定的微应用资源，数组内的每一项表示一个微应用的名称
    prefetchAfterFirstMounted(appsName2Apps(prefetchStrategy as string[]), importEntryOpts);
  } else if (isFunction(prefetchStrategy)) {
    // 加载策略是一个自定义的函数，可完全自定义应用资源的加载时机（首屏应用、次屏应用)
    (async () => {
      // critical rendering apps would be prefetch as earlier as possible，关键的应用程序应该尽可能早的预取
      // 执行加载策略函数，函数会返回两个数组，一个关键的应用程序数组，会立即执行预加载动作，另一个是在第一个微应用挂载以后执行微应用静态资源的预加载
      const { criticalAppNames = [], minorAppsName = [] } = await prefetchStrategy(apps);
      // 立即预加载这些关键微应用程序的静态资源
      prefetchImmediately(appsName2Apps(criticalAppNames), importEntryOpts);
      // 当第一个微应用挂载以后预加载这些微应用的静态资源
      prefetchAfterFirstMounted(appsName2Apps(minorAppsName), importEntryOpts);
    })();
  } else {
    // 加载策略是默认的 true 或者 all
    switch (prefetchStrategy) {
      case true:
        // 第一个微应用挂载之后开始加载其它微应用的静态资源
        prefetchAfterFirstMounted(apps, importEntryOpts);
        break;

      case 'all':
        // 在主应用执行 start 以后就开始加载所有微应用的静态资源
        prefetchImmediately(apps, importEntryOpts);
        break;

      default:
        break;
    }
  }
}

// 判断是否为弱网环境
const isSlowNetwork = navigator.connection
  ? navigator.connection.saveData ||
    (navigator.connection.type !== 'wifi' &&
      navigator.connection.type !== 'ethernet' &&
      /(2|3)g/.test(navigator.connection.effectiveType))
  : false;

/**
 * prefetch assets, do nothing while in mobile network
 * 预加载静态资源，在移动网络下什么都不做
 * @param entry
 * @param opts
 */
function prefetch(entry: Entry, opts?: ImportEntryOpts): void {
  // 弱网环境下不执行预加载
  if (!navigator.onLine || isSlowNetwork) {
    // Don't prefetch if in a slow network or offline
    return;
  }

  // 通过时间切片的方式去加载静态资源，在浏览器空闲时去执行回调函数，避免浏览器卡顿
  requestIdleCallback(async () => {
    // 得到加载静态资源的函数
    const { getExternalScripts, getExternalStyleSheets } = await importEntry(entry, opts);
    // 样式
    requestIdleCallback(getExternalStyleSheets);
    // js 脚本
    requestIdleCallback(getExternalScripts);
  });
}

/**
 * 在第一个微应用挂载之后开始加载 apps 中指定的微应用的静态资源
 * 通过监听 single-spa 提供的 single-spa:first-mount 事件来实现，该事件在第一个微应用挂载以后会被触发
 * @param apps 需要被预加载静态资源的微应用列表，[{ name, entry }, ...]
 * @param opts = { fetch , getPublicPath, getTemplate }
 */
function prefetchAfterFirstMounted(apps: AppMetadata[], opts?: ImportEntryOpts): void {
  // 监听 single-spa:first-mount 事件
  window.addEventListener('single-spa:first-mount', function listener() {
    // 已挂载的微应用
    const mountedApps = getMountedApps();
    // 从预加载的微应用列表中过滤出未挂载的微应用
    const notMountedApps = apps.filter(app => mountedApps.indexOf(app.name) === -1);

    // 开发环境打印日志，已挂载的微应用和未挂载的微应用分别有哪些
    if (process.env.NODE_ENV === 'development') {
      console.log(`[qiankun] prefetch starting after ${mountedApps} mounted...`, notMountedApps);
    }

    // 循环加载微应用的静态资源
    notMountedApps.forEach(({ entry }) => prefetch(entry, opts));

    // 移除 single-spa:first-mount 事件
    window.removeEventListener('single-spa:first-mount', listener);
  });
}

/**
 * 在执行 start 启动 qiankun 之后立即预加载所有微应用的静态资源
 * @param apps 需要被预加载静态资源的微应用列表，[{ name, entry }, ...]
 * @param opts = { fetch , getPublicPath, getTemplate }
 */
export function prefetchImmediately(apps: AppMetadata[], opts?: ImportEntryOpts): void {
  // 开发环境打印日志
  if (process.env.NODE_ENV === 'development') {
    console.log('[qiankun] prefetch starting for apps...', apps);
  }

  // 加载所有微应用的静态资源
  apps.forEach(({ entry }) => prefetch(entry, opts));
}
```

#### 应用间通信 initGlobalState

```js
// 触发全局监听，执行所有应用注册的回调函数
function emitGlobal(
  state: Record<string, any>,
  prevState: Record<string, any>
) {
  // 循环遍历，执行所有应用注册的回调函数
  Object.keys(deps).forEach((id: string) => {
    if (deps[id] instanceof Function) {
      deps[id](cloneDeep(state), cloneDeep(prevState));
    }
  });
}

/**
 * 定义全局状态，并返回通信方法，一般由主应用调用，微应用通过 props 获取通信方法。
 * @param state 全局状态，{ key: value }
 */
export function initGlobalState(state: Record<string, any> = {}) {
  if (state === globalState) {
    console.warn("[qiankun] state has not changed！");
  } else {
    // 方法有可能被重复调用，将已有的全局状态克隆一份，为空则是第一次调用 initGlobalState 方法，不为空则非第一次次调用
    const prevGlobalState = cloneDeep(globalState);
    // 将传递的状态克隆一份赋值为 globalState
    globalState = cloneDeep(state);
    // 触发全局监听，当然在这个位置调用，正常情况下没啥反应，因为现在还没有应用注册回调函数
    emitGlobal(globalState, prevGlobalState);
  }
  // 返回通信方法，参数表示应用 id，true 表示自己是主应用调用
  return getMicroAppStateActions(`global-${+new Date()}`, true);
}

/**
 * 返回通信方法
 * @param id 应用 id
 * @param isMaster 表明调用的应用是否为主应用，在主应用初始化全局状态时，initGlobalState 内部调用该方法时会传递 true，其它都为 false
 */
export function getMicroAppStateActions(
  id: string,
  isMaster?: boolean
): MicroAppStateActions {
  return {
    /**
     * 全局依赖监听，为指定应用（id = 应用id）注册回调函数
     * 依赖数据结构为：
     * {
     *   {id}: callback
     * }
     *
     * @param callback 注册的回调函数
     * @param fireImmediately 是否立即执行回调
     */
    onGlobalStateChange(
      callback: OnGlobalStateChangeCallback,
      fireImmediately?: boolean
    ) {
      // 回调函数必须为 function
      if (!(callback instanceof Function)) {
        console.error("[qiankun] callback must be function!");
        return;
      }
      // 如果回调函数已经存在，重复注册时给出覆盖提示信息
      if (deps[id]) {
        console.warn(
          `[qiankun] '${id}' global listener already exists before this, new listener will overwrite it.`
        );
      }
      // id 为一个应用 id，一个应用对应一个回调
      deps[id] = callback;
      // 克隆全局状态
      const cloneState = cloneDeep(globalState);
      // 如果需要，立即出发回调执行
      if (fireImmediately) {
        callback(cloneState, cloneState);
      }
    },

    /**
     * setGlobalState 更新 store 数据
     *
     * 1. 对新输入 state 的第一层属性做校验，如果是主应用则可以添加新的一级属性进来，也可以更新已存在的一级属性，
     *    如果是微应用，则只能更新已存在的一级属性，不可以新增一级属性
     * 2. 触发全局监听，执行所有应用注册的回调函数，以达到应用间通信的目的
     *
     * @param state 新的全局状态
     */
    setGlobalState(state: Record<string, any> = {}) {
      if (state === globalState) {
        console.warn("[qiankun] state has not changed！");
        return false;
      }

      // 记录旧的全局状态中被改变的 key
      const changeKeys: string[] = [];
      // 旧的全局状态
      const prevGlobalState = cloneDeep(globalState);
      globalState = cloneDeep(
        // 循环遍历新状态中的所有 key
        Object.keys(state).reduce((_globalState, changeKey) => {
          if (isMaster || _globalState.hasOwnProperty(changeKey)) {
            // 主应用 或者 旧的全局状态存在该 key 时才进来，说明只有主应用才可以新增属性，微应用只可以更新已存在的属性值，且不论主应用微应用只能更新一级属性
            // 记录被改变的key
            changeKeys.push(changeKey);
            // 更新旧状态中对应的 key value
            return Object.assign(_globalState, {
              [changeKey]: state[changeKey],
            });
          }
          console.warn(
            `[qiankun] '${changeKey}' not declared when init state！`
          );
          return _globalState;
        }, globalState)
      );
      if (changeKeys.length === 0) {
        console.warn("[qiankun] state has not changed！");
        return false;
      }
      // 触发全局监听
      emitGlobal(globalState, prevGlobalState);
      return true;
    },

    // 注销该应用下的依赖
    offGlobalStateChange() {
      delete deps[id];
      return true;
    },
  };
}
```

#### 全局未捕获异常处理器

```js
/**
 * 整个文件的逻辑一眼明了，整个框架提供了两种全局异常捕获，一个是 single-spa 提供的，另一个是 qiankun 自己的，你只需提供相应的回调函数即可
 */

// single-spa 的异常捕获
export { addErrorHandler, removeErrorHandler } from "single-spa";

// qiankun 的异常捕获
// 监听了 error 和 unhandlerejection 事件
export function addGlobalUncaughtErrorHandler(
  errorHandler: OnErrorEventHandlerNonNull
): void {
  window.addEventListener("error", errorHandler);
  window.addEventListener("unhandledrejection", errorHandler);
}

// 移除 error 和 unhandlerejection 事件监听
export function removeGlobalUncaughtErrorHandler(
  errorHandler: (...args: any[]) => any
) {
  window.removeEventListener("error", errorHandler);
  window.removeEventListener("unhandledrejection", errorHandler);
}
```

#### setDefaultMountApp

```js
/**
 * 设置主应用启动后默认进入的微应用，其实是规定了第一个微应用挂载完成后决定默认进入哪个微应用
 * 利用的是 single-spa 的 single-spa:no-app-change 事件，该事件在所有微应用状态改变结束后（即发生路由切换且新的微应用已经被挂载完成）触发
 * @param defaultAppLink 微应用的链接，比如 /react16
 */
export function setDefaultMountApp(defaultAppLink: string) {
  // 当事件触发时就说明微应用已经挂载完成，但这里只监听了一次，因为事件被触发以后就移除了监听，所以说是主应用启动后默认进入的微应用，且只执行了一次的原因
  window.addEventListener("single-spa:no-app-change", function listener() {
    // 说明微应用已经挂载完成，获取挂载的微应用列表，再次确认确实有微应用挂载了，其实这个确认没啥必要
    const mountedApps = getMountedApps();
    if (!mountedApps.length) {
      // 这个是 single-spa 提供的一个 api，通过触发 window.location.hash 或者 pushState 更改路由，切换微应用
      navigateToUrl(defaultAppLink);
    }

    // 触发一次以后，就移除该事件的监听函数，后续的路由切换（事件触发）时就不再响应
    window.removeEventListener("single-spa:no-app-change", listener);
  });
}

// 这个 api 和 setDefaultMountApp 作用一致，官网也提到，兼容老版本的一个 api
export function runDefaultMountEffects(defaultAppLink: string) {
  console.warn(
    "[qiankun] runDefaultMountEffects will be removed in next version, please use setDefaultMountApp instead"
  );
  setDefaultMountApp(defaultAppLink);
}
```

#### runAfterFirstMounted

```js
/**
 * 第一个微应用 mount 后需要调用的方法，比如开启一些监控或者埋点脚本
 * 同样利用的 single-spa 的 single-spa:first-mount 事件，当第一个微应用挂载以后会触发
 * @param effect 回调函数，当第一个微应用挂载以后要做的事情
 */
export function runAfterFirstMounted(effect: () => void) {
  // can not use addEventListener once option for ie support
  window.addEventListener("single-spa:first-mount", function listener() {
    if (process.env.NODE_ENV === "development") {
      console.timeEnd(firstMountLogLabel);
    }

    effect();

    // 这里不移除也没事，因为这个事件后续不会再被触发了
    window.removeEventListener("single-spa:first-mount", listener);
  });
}
```

#### 手动加载微应用 loadMicroApp

```js
/**
 * 手动加载一个微应用，是通过 single-spa 的 mountRootParcel api 实现的，返回微应用实例
 * @param app = { name, entry, container, props }
 * @param configuration 配置对象
 * @param lifeCycles 还支持一个全局生命周期配置对象，这个参数官方文档没提到
 */
export function loadMicroApp<T extends object = {}>(
  app: LoadableApp<T>,
  configuration?: FrameworkConfiguration,
  lifeCycles?: FrameworkLifeCycles<T>,
): MicroApp {
  const { props } = app;
  // single-spa 的 mountRootParcel api
  return mountRootParcel(() => loadApp(app, configuration ?? frameworkConfiguration, lifeCycles), {
    domElement: document.createElement('div'),
    ...props,
  });
}
```

#### qiankun 的核心 loadApp

接下来介绍 loadApp 方法，个人认为 qiankun 的核心代码可以说大部分都在这里，当然这也是整个框架的精髓和难点所在

```js
/**
 * 完成了以下几件事：
 *  1、通过 HTML Entry 的方式远程加载微应用，得到微应用的 html 模版（首屏内容）、JS 脚本执行器、静态经资源路径
 *  2、样式隔离，shadow DOM 或者 scoped css 两种方式
 *  3、渲染微应用
 *  4、运行时沙箱，JS 沙箱、样式沙箱
 *  5、合并沙箱传递出来的 生命周期方法、用户传递的生命周期方法、框架内置的生命周期方法，将这些生命周期方法统一整理，导出一个生命周期对象，
 * 供 single-spa 的 registerApplication 方法使用，这个对象就相当于使用 single-spa 时你的微应用导出的那些生命周期方法，只不过 qiankun
 * 额外填了一些生命周期方法，做了一些事情
 *  6、给微应用注册通信方法并返回通信方法，然后会将通信方法通过 props 注入到微应用
 * @param app 微应用配置对象
 * @param configuration start 方法执行时设置的配置对象
 * @param lifeCycles 注册微应用时提供的全局生命周期对象
 */
export async function loadApp<T extends object>(
  app: LoadableApp<T>,
  configuration: FrameworkConfiguration = {},
  lifeCycles?: FrameworkLifeCycles<T>,
): Promise<ParcelConfigObject> {
  // 微应用的入口和名称
  const { entry, name: appName } = app;
  // 实例 id
  const appInstanceId = `${appName}_${+new Date()}_${Math.floor(Math.random() * 1000)}`;

  // 下面这个不用管，就是生成一个标记名称，然后使用该名称在浏览器性能缓冲器中设置一个时间戳，可以用来度量程序的执行时间，performance.mark、performance.measure
  const markName = `[qiankun] App ${appInstanceId} Loading`;
  if (process.env.NODE_ENV === 'development') {
    performanceMark(markName);
  }

  // 配置信息
  const { singular = false, sandbox = true, excludeAssetFilter, ...importEntryOpts } = configuration;

  /**
   * 获取微应用的入口 html 内容和脚本执行器
   * template 是 link 替换为 style 后的 template
   * execScript 是 让 JS 代码(scripts)在指定 上下文 中运行
   * assetPublicPath 是静态资源地址
   */
  const { template, execScripts, assetPublicPath } = await importEntry(entry, importEntryOpts);

  // single-spa 的限制，加载、初始化和卸载不能同时进行，必须等卸载完成以后才可以进行加载，这个 promise 会在微应用卸载完成后被 resolve，在后面可以看到
  if (await validateSingularMode(singular, app)) {
    await (prevAppUnmountedDeferred && prevAppUnmountedDeferred.promise);
  }

  // --------------- 样式隔离 ---------------
  // 是否严格样式隔离
  const strictStyleIsolation = typeof sandbox === 'object' && !!sandbox.strictStyleIsolation;
  // 实验性的样式隔离，后面就叫 scoped css，和严格样式隔离不能同时开启，如果开启了严格样式隔离，则 scoped css 就为 false，强制关闭
  const enableScopedCSS = isEnableScopedCSS(configuration);

  // 用一个容器元素包裹微应用入口 html 模版, appContent = `<div id="__qiankun_microapp_wrapper_for_${appInstanceId}__" data-name="${appName}">${template}</div>`
  const appContent = getDefaultTplWrapper(appInstanceId, appName)(template);
  // 将 appContent 有字符串模版转换为 html dom 元素，如果需要开启样式严格隔离，则将 appContent 的子元素即微应用入口模版用 shadow dom 包裹起来，以达到样式严格隔离的目的
  let element: HTMLElement | null = createElement(appContent, strictStyleIsolation);
  // 通过 scoped css 的方式隔离样式，从这里也就能看出官方为什么说：
  // 在目前的阶段，该功能还不支持动态的、使用 <link />标签来插入外联的样式，但考虑在未来支持这部分场景
  // 在现阶段只处理 style 这种内联标签的情况
  if (element && isEnableScopedCSS(configuration)) {
    const styleNodes = element.querySelectorAll('style') || [];
    forEach(styleNodes, (stylesheetElement: HTMLStyleElement) => {
      css.process(element!, stylesheetElement, appName);
    });
  }

  // --------------- 渲染微应用 ---------------
  // 主应用装载微应用的容器节点
  const container = 'container' in app ? app.container : undefined;
  // 这个是 1.x 版本遗留下来的实现，如果提供了 render 函数，当微应用需要被激活时就执行 render 函数渲染微应用，新版本用的 container，弃了 render
  // 而且 legacyRender 和 strictStyleIsolation、scoped css 不兼容
  const legacyRender = 'render' in app ? app.render : undefined;

  // 返回一个 render 函数，这个 render 函数要不使用用户传递的 render 函数，要不将 element 插入到 container
  const render = getRender(appName, appContent, container, legacyRender);

  // 渲染微应用到容器节点，并显示 loading 状态
  render({ element, loading: true }, 'loading');

  // 得到一个 getter 函数，通过该函数可以获取 <div id="__qiankun_microapp_wrapper_for_${appInstanceId}__" data-name="${appName}">${template}</div>
  const containerGetter = getAppWrapperGetter(
    appName,
    appInstanceId,
    !!legacyRender,
    strictStyleIsolation,
    enableScopedCSS,
    () => element,
  );

  // --------------- 运行时沙箱 ---------------
  // 保证每一个微应用运行在一个干净的环境中（JS 执行上下文独立、应用间不会发生样式污染）
  let global = window;
  let mountSandbox = () => Promise.resolve();
  let unmountSandbox = () => Promise.resolve();
  if (sandbox) {
    /**
     * 生成运行时沙箱，这个沙箱其实由两部分组成 => JS 沙箱（执行上下文）、样式沙箱
     *
     * 沙箱返回 window 的代理对象 proxy 和 mount、unmount 两个方法
     * unmount 方法会让微应用失活，恢复被增强的原生方法，并记录一堆 rebuild 函数，这个函数是微应用卸载时希望自己被重新挂载时要做的一些事情，比如动态样式表重建（卸载时会缓存）
     * mount 方法会执行一些一些 patch 动作，恢复原生方法的增强功能，并执行 rebuild 函数，将微应用恢复到卸载时的状态，当然从初始化状态进入挂载状态就没有恢复一说了
     */
    const sandboxInstance = createSandbox(
      appName,
      containerGetter,
      Boolean(singular),
      enableScopedCSS,
      excludeAssetFilter,
    );
    // 用沙箱的代理对象作为接下来使用的全局对象
    global = sandboxInstance.proxy as typeof window;
    mountSandbox = sandboxInstance.mount;
    unmountSandbox = sandboxInstance.unmount;
  }

  // 合并用户传递的生命周期对象和 qiankun 框架内置的生命周期对象
  const { beforeUnmount = [], afterUnmount = [], afterMount = [], beforeMount = [], beforeLoad = [] } = mergeWith(
    {},
    // 返回内置生命周期对象，global.__POWERED_BY_QIANKUN__ 和 global.__INJECTED_PUBLIC_PATH_BY_QIANKUN__ 的设置就是在内置的生命周期对象中设置的
    getAddOns(global, assetPublicPath),
    lifeCycles,
    (v1, v2) => concat(v1 ?? [], v2 ?? []),
  );

  await execHooksChain(toArray(beforeLoad), app, global);

  // get the lifecycle hooks from module exports，获取微应用暴露出来的生命周期函数
  const scriptExports: any = await execScripts(global, !singular);
  const { bootstrap, mount, unmount, update } = getLifecyclesFromExports(scriptExports, appName, global);

  // 给微应用注册通信方法并返回通信方法，然后会将通信方法通过 props 注入到微应用
  const {
    onGlobalStateChange,
    setGlobalState,
    offGlobalStateChange,
  }: Record<string, Function> = getMicroAppStateActions(appInstanceId);

  const parcelConfig: ParcelConfigObject = {
    name: appInstanceId,
    bootstrap,
    // 挂载阶段需要执行的一系列方法
    mount: [
      // 性能度量，不用管
      async () => {
        if (process.env.NODE_ENV === 'development') {
          const marks = performance.getEntriesByName(markName, 'mark');
          // mark length is zero means the app is remounting
          if (!marks.length) {
            performanceMark(markName);
          }
        }
      },
      // 单例模式需要等微应用卸载完成以后才能执行挂载任务，promise 会在微应用卸载完以后 resolve
      async () => {
        if ((await validateSingularMode(singular, app)) && prevAppUnmountedDeferred) {
          return prevAppUnmountedDeferred.promise;
        }

        return undefined;
      },
      // 添加 mount hook, 确保每次应用加载前容器 dom 结构已经设置完毕
      async () => {
        // element would be destroyed after unmounted, we need to recreate it if it not exist
        // unmount 阶段会置空，这里重新生成
        element = element || createElement(appContent, strictStyleIsolation);
        // 渲染微应用到容器节点，并显示 loading 状态
        render({ element, loading: true }, 'mounting');
      },
      // 运行时沙箱导出的 mount
      mountSandbox,
      // exec the chain after rendering to keep the behavior with beforeLoad
      async () => execHooksChain(toArray(beforeMount), app, global),
      // 向微应用的 mount 生命周期函数传递参数，比如微应用中使用的 props.onGlobalStateChange 方法
      async props => mount({ ...props, container: containerGetter(), setGlobalState, onGlobalStateChange }),
      // 应用 mount 完成后结束 loading
      async () => render({ element, loading: false }, 'mounted'),
      async () => execHooksChain(toArray(afterMount), app, global),
      // initialize the unmount defer after app mounted and resolve the defer after it unmounted
      // 微应用挂载完成以后初始化这个 promise，并且在微应用卸载以后 resolve 这个 promise
      async () => {
        if (await validateSingularMode(singular, app)) {
          prevAppUnmountedDeferred = new Deferred<void>();
        }
      },
      // 性能度量，不用管
      async () => {
        if (process.env.NODE_ENV === 'development') {
          const measureName = `[qiankun] App ${appInstanceId} Loading Consuming`;
          performanceMeasure(measureName, markName);
        }
      },
    ],
    // 卸载微应用
    unmount: [
      async () => execHooksChain(toArray(beforeUnmount), app, global),
      // 执行微应用的 unmount 生命周期函数
      async props => unmount({ ...props, container: containerGetter() }),
      // 沙箱导出的 unmount 方法
      unmountSandbox,
      async () => execHooksChain(toArray(afterUnmount), app, global),
      // 显示 loading 状态、移除微应用的状态监听、置空 element
      async () => {
        render({ element: null, loading: false }, 'unmounted');
        offGlobalStateChange(appInstanceId);
        // for gc
        element = null;
      },
      // 微应用卸载以后 resolve 这个 promise，框架就可以进行后续的工作，比如加载或者挂载其它微应用
      async () => {
        if ((await validateSingularMode(singular, app)) && prevAppUnmountedDeferred) {
          prevAppUnmountedDeferred.resolve();
        }
      },
    ],
  };

  // 微应用有可能定义 update 方法
  if (typeof update === 'function') {
    parcelConfig.update = update;
  }

  return parcelConfig;
}
```

#### 样式隔离

qiankun 的样式隔离有两种方式，一种是严格样式隔离，通过 shadow dom 来实现，另一种是实验性的样式隔离，就是 scoped css，两种方式不可共存

#### 严格样式隔离

在 qiankun 中的严格样式隔离，就是在这个 createElement 方法中做的，通过 shadow dom 来实现， shadow dom 是浏览器原生提供的一种能力，在过去的很长一段时间里，浏览器用它来封装一些元素的内部结构。以一个有着默认播放控制按钮的 <video> 元素为例，实际上，在它的 Shadow DOM 中，包含来一系列的按钮和其他控制器。Shadow DOM 标准允许你为你自己的元素（custom element）维护一组 Shadow DOM。具体内容可查看 shadow DOM

```js
/**
 * 做了两件事
 *  1、将 appContent 由字符串模版转换成 html dom 元素
 *  2、如果需要开启严格样式隔离，则将 appContent 的子元素即微应用的入口模版用 shadow dom 包裹起来，达到样式严格隔离的目的
 * @param appContent = `<div id="__qiankun_microapp_wrapper_for_${appInstanceId}__" data-name="${appName}">${template}</div>`
 * @param strictStyleIsolation 是否开启严格样式隔离
 */
function createElement(appContent: string, strictStyleIsolation: boolean): HTMLElement {
  // 创建一个 div 元素
  const containerElement = document.createElement('div');
  // 将字符串模版 appContent 设置为 div 的子与阿苏
  containerElement.innerHTML = appContent;
  // appContent always wrapped with a singular div，appContent 由模版字符串变成了 DOM 元素
  const appElement = containerElement.firstChild as HTMLElement;
  // 如果开启了严格的样式隔离，则将 appContent 的子元素（微应用的入口模版）用 shadow dom 包裹，以达到微应用之间样式严格隔离的目的
  if (strictStyleIsolation) {
    if (!supportShadowDOM) {
      console.warn(
        '[qiankun]: As current browser not support shadow dom, your strictStyleIsolation configuration will be ignored!',
      );
    } else {
      const { innerHTML } = appElement;
      appElement.innerHTML = '';
      let shadow: ShadowRoot;

      if (appElement.attachShadow) {
        shadow = appElement.attachShadow({ mode: 'open' });
      } else {
        // createShadowRoot was proposed in initial spec, which has then been deprecated
        shadow = (appElement as any).createShadowRoot();
      }
      shadow.innerHTML = innerHTML;
    }
  }

  return appElement;
}

```

## 结语

以上内容就是对 qiankun 框架的完整解读了
