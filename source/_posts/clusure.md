---
title: 闭包和执行上下文到底是怎么回事？
date: 2022-09-22 13:20:55
tags:
cover: http://cdn.pluto1811.com/goodsImage/1615190740385/316773783.jpg
---

# show me the code：

```js
console.log(a); // undefined
var a = 100;
fn("zhangsan"); // 'zhangsan' 20
function fn(name) {
  age = 20;
  console.log(name, age);
  var age;
}
console.log(b); // 这里报错
// Uncaught ReferenceError: b is not defined
b = 100;
```

以一段代码开头引出 js 的执行上下文

### 什么是 js 的执行上下文

js 是解释执行的脚本语言

解析的时候会先创建一个全局执行上下文，先把代码中即将执行的（内部函数的不算，因为你不知道函数何时执行）变量、函数声明都拿出来，变量先暂时赋值为 undefined，函数先声明好可使用，然后再开始正式执行程序

#### 总结一下：在 ES5 中，可分为下面 3 部分

- 词法环境，当获取变量时使用。
- 变量环境，当声明变量时使用。
- this 值。

在执行一个函数时，也会创建一个函数执行上下文，跟全局上下文差不多，不过函数执行上下文会多出 this,arguments 和函数参数。

稍微延伸下函数的参数：

- 形参
- 函数的形参是定义该函数时，设置的函数参数个数
- 实参
- 调用函数时传递几个就是有几个

函数的实参会放在 arguments 中，argumens 是一个类数组，而非对象（arguments instanceof Array === false）

一段关于 argumens 的骚操作：

```js
function min() {
  return Math.min.apply(this, arguments);
}
min(1, 2, 3, 4, -1, 2, 0 - 3); // -3
```

---

### this 的指向

this 的值是在执行的时候才能确认，定义的时候不能确认！因为 this 是执行上下文环境的一部分，而执行上下文需要在代码执行之前确定，而不是定义的时候

#### 1. 默认指向（如果是严格模式，this 指向 undefined；非严格模式，则是全局对象，如在浏览器中指向 window）

```js
function foo() {
  console.log(this.a);
}
var a = 1;
foo(); // 1
function bar() {
  var a = 2;
  return function baz() {
    console.log(this.a);
  };
}
bar()(); // 1
```

#### 2. 隐含指向

```js
function foo() {
  console.log(this.a);
}
var a = 1;
var obj = { a: 2, foo: foo };
obj.foo(); // 2
// 上例中，函数 foo() 调用时，前置了一个环境对象 obj，那么此时 foo 中的 this 就会指向它的环境对象 obj。

var obj2 = { a: 3, obj: obj };
obj2.obj.foo(); // 2
// 如果时这种情况，则 this 指向引用链的最后一层，即obj

// this 也会隐含的“丢失”，如下面三种情况
// 第一种
var foo1 = obj.foo;
foo1(); // 1
// 牢记函数的this绑定是函数被调用时确定的，foo1 执行时，只是一个直白，无修饰的调用，此时符合默认指向规则。

//第二种
function go(fn) {
  fn();
}
go(obj.foo); // 1
// go 传入的实参 obj.foo 只是赋值给了形参 fn，本质上就是 fn = obj.foo，然后 fn() 。它和第一种是类似的。

// 第三种
setTimeout(obj.foo, 1000); // 1
// 本质上，这个this指向的过程，类似于第二种。
```

#### 3. 明朗指向

```js
var obj = { a: 1 },
  a = 2;
function foo() {
  console.log(this.a);
}
foo.call(obj); // 1 ; calll 和 apply 类似，不再赘述。
```

#### 4. new 指向

延伸一下=>new 的时候发生了什么：

> - 一个全新的对象（暂且叫它 myObj 吧）被凭空创建。
> - myObj 被接入被调用函数的原型链。
> - 函数中的 this 指向 myObj
> - 返回这个 myObj

```js
function foo(a) {
  this.a = a;
}
var bar = new foo(1);
console.log(bar.a); // 1
```

### 箭头函数 this 的指向

---

##### 特点：

- 不可以当作构造函数，也就是说，不可以使用 new 命令，否则会抛出一个错误。
- 不可以使用 arguments 对象，该对象在函数体内不存在。如果要用，可以用 Rest 参数代替。
- 不可以使用 yield 命令，因此箭头函数不能用作 Generator 函数。
- 本身没有 this，它会直接绑定到它的词法作用域内的 this，也就是定义它时的作用域内的 this 值
- 一旦指向确定，就无法被覆盖

```js
var x = 11;
var obj = {
  x: 22,
  y: function () {
    return (say = () => {
      console.log(this.x);
    });
  },
};
obj.y()(); //输出22

var x = 11;
var obj = {
  x: 22,
  say: () => {
    console.log(this.x);
  },
};

obj.say(); // 输出11
```

### 闭包

**1. 定义：** 红皮书+作者自己的理解：

有权限访问另一个函数作用域中的变量的函数，保护该变量不被 GC 回收，并不是说一定要 return 出去，函数可以访问被创建时所处的上下文环境，强调的是访问外部函数的局部变量。

**2. 原理：**

- 作用域链
- 自由变量 => 当前作用域没有定义的变量，这成为 自由变量 。自由变量如何得到 —— 向父级作用域寻找
  如果父级也没呢？再一层一层向上寻找，直到找到全局作用域还是没找到，就宣布放弃。这种一层一层的关系，就是 作用域链 。
- 垃圾(内存)回收机制
- 一般情况一个函数（函数作用域）执行完毕，里面声明的变量会全部释放，被垃圾回收器回收，而闭包不会被垃圾回收，会一直存在内存。
- 全局变量生命周期会持续到浏览器关闭页面

```js
function foo(x) {
  var tmp = 3;
  function bar(y) {
    alert(x + y + ++tmp);
  }
  bar(10);
}
foo(2);
```

一道经典的面试题：

```js
<body>
  <button>Button0</button>
  <button>Button1</button>
  <button>Button2</button>
  <button>Button3</button>
  <button>Button4</button>
</body>;

var btns = document.getElementsByTagName("button");
for (var i = 0, len = btns.length; i < len; i++) {
  btns[i].onclick = function () {
    alert(i);
  };
}
// 输出的都是4
```

**解题思路：**

> 1. 由 var 申明的变量，会造成变量提升，每次循环其实操作的是同一个变量；
> 2. onlick 事件函数顺着作用域链从内向外查找变量 i
> 3. onclick 事件是被异步触发的，当事件被触发时，for 循环早已结束，此时变量 i 的值已经是 5

方案一：

```js
for (var i = 0, len = btns.length; i < len; i++) {
  (function (j) {
    btns[j].onclick = function () {
      alert(j);
    };
  })(i);
}
```

for 循环每一次都执行一个 IIEF （自执行函数），每一次变量 i 被当做参数传到 IIEF 中去 ， 那么这个自执行函数中创建了一个变量，参数 j 然后元素节点 btnList 绑定一个 onclick 事件，执行函数里面需要用到这个参数 j ，但是你又没点 ， 那么这个遍历 j 就没有被清理 ， 就一直在参数里面被保存着 ， 每一个 IIEF 都做一样的事情 ， 所以这个时候就产生了闭包 ， 变量 j 并没有被回收，依然在等待你使用

方案二：

```js
for (let i = 0, len = btns.length; i < len; i++) {
  btns[i].onclick = function () {
    alert(i);
  };
}
// let块级作用域，每次循环操作的其实是不同的i。
```
