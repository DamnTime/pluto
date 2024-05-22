---
title: JavaScript类型，有可能你不知道这些细节
date: 2022-10-16 13:20:55
tags:
cover: https://cdn.JsDelivr.net/gh/DamnTime/pluto-img-bed@main/img/202405221527597.png
---

# JavaScript 类型，有可能你不知道这些细节

### 1. 为什么有的编程规范要求用 void 0 代替 undefined？

Undefined 类型表示未定义，它的类型只有一个值，就是 undefined。任何变量在赋值前是 Undefined 类型、值为 undefined，一般我们可以用全局变量 undefined（就是名为运行时类型是代码实际执行过程中我们用到的类型。

JavaScript 的代码 **undefined 是一个变量，而并非是一个关键字**。undefined 在 ES5 中已经是全局对象的一个只读（read-only）属性了，它不能被重写。但是在局部作用域中，还是可以被重写的。

```js
(function () {
  var undefined = 10;

  // 10 -- chrome
  alert(undefined);
})();
```

### 2. js 中关于无穷大的这件事！

JavaScript 中的 Number 类型基本符合 IEEE 754-2008 规定的双精度浮点数规则，但是 JavaScript 为了表达几个额外的语言场景（比如不让除以 0 出错，而引入了无穷大的概 念），规定了几个例外情况：

> - NaN，占用了 9007199254740990，这原本是符合 IEEE 规则的数字
> - Infinity，无穷大
> - -Infinity，负无穷大

另外，值得注意的是，JavaScript 中有 +0 和 -0，在加法类运算中它们没有区别，但是除 法的场合则需要特别留意区分，“忘记检测除以 -0，而得到负无穷大”的情况经常会导致 错误，而区分 +0 和 -0 的方式，正是检测 1/x 是 Infinity 还是 -Infinity。

**为什么在 JavaScript 中，0.1+0.2 不能 =0.3：**

```js
console.log(0.1 + 0.2 == 0.3); // false
```

实际上，这里错误的不是结论，而是比较的方法，正确的比较方法是使用 JavaScript 提供的最小精度值：

```js
console.log(Math.abs(0.1 + 0.2 - 0.3) <= Number.EPSILON);
```

检查等式左右两边差的绝对值是否小于最小精度，才是正确的比较浮点数的方法

### 3. 聊聊 Object

在 JavaScript 中，对象的定义是“属性的集合”。属性分为数据属性和访问器属性，二者 都是 key-value 结构，key 可以是字符串或者 Symbol 类型。

提到对象，我们必须要提到一个概念：类。

事实上，JavaScript 中的“类”仅仅是运行时对象的一个私有属性，而 JavaScript 中是无法自定义类型的。

JavaScript 中的几个基本类型，都在对象类型中有一个“亲戚”。它们是：

> - Number
> - String
> - Boolean
> - Symbol

我们必须认识到 3 与 new Number(3) 是完全不同的值，它们一个是 Number 类 型， 一个是对象类型。

Number、String 和 Boolean，三个构造器是两用的，当跟 new 搭配时，它们产生对象， 当直接调用时，它们表示强制类型转换。

Symbol 函数比较特殊，直接用 new 调用它会抛出错误，但它仍然是 Symbol 对象的构造器。

我们在原型上添加方法，都可以应用于基本类型，比如以下代码，在 Symbol 原型上 添加了 hello 方法，在任何 Symbol 类型变量都可以调用。

```js
Symbol.prototype.hello = () => console.log("hello");

var a = Symbol("a");
console.log(typeof a); //symbol，a 并非对象
a.hello(); //hello，有效
```

**运算符提供了装箱操作，它会根据基础类型构造一个 临时对象，使得我们能在基础类型上调用对应对象的方法。**

### 装箱转换

每一种基本类型 Number、String、Boolean、Symbol 在对象中都有对应的类，所谓装箱 转换，正是把基本类型转换为对应的对象，它是类型转换中一种相当重要的种类。

前文提到，全局的 Symbol 函数无法使用 new 来调用，但我们仍可以利用装箱机制来得到 一个 Symbol 对象，我们可以利用一个函数的 call 方法来强迫产生装箱。

```js
var symbolObject = function () {
  return this;
}.call(Symbol("a"));

console.log(typeof symbolObject); //object
console.log(symbolObject instanceof Symbol); //true
console.log(symbolObject.constructor == Symbol); //true
```

装箱机制会频繁产生临时对象，在一些对性能要求较高的场景下，我们应该尽量避免对基本 类型做装箱转换。

使用内置的 Object 函数，我们可以在 JavaScript 代码中显式调用装箱能力。

```js
var symbolObject = Object(Symbol("a"));

console.log(typeof symbolObject); //object
console.log(symbolObject instanceof Symbol); //true
console.log(symbolObject.constructor == Symbol); //true
```

每一类装箱对象皆有私有的 Class 属性，这些属性可以用 Object.prototype.toString 获 取：

```js
var symbolObject = Object(Symbol("a"));

console.log(Object.prototype.toString.call(symbolObject)); //[object Symbol]
```

在 JavaScript 中，没有任何方法可以更改私有的 Class 属性，因此 Object.prototype.toString 是可以准确识别对象对应的基本类型的方法，它比 instanceof 更加准确。
