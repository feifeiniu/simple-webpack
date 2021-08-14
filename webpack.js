const fs = require("fs");
const path = require("path");
const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const babel = require("@babel/core");
const { get } = require("lodash");
const { info } = require("console");

// 分析有哪些依赖 单个模块
function getModuleInfo(file) {
  //读取文件
  const body = fs.readFileSync(file);
  const array = [];
  array.push(body);
  const string = Buffer.concat(array).toString();
  const ast = parser.parse(string, { sourceType: "module" }); //把字符串 转化为 ast 语法树 代码组织形式 ESMoudule
  const deps = {}; //收集了依赖
  traverse(ast, {
    // visitor
    ImportDeclaration({ node }) {
      //遇到 import 节点的时候
      const dirname = path.dirname(file); //得到根目录 ./src
      let relativePath = node.source.value; // ./add.js
      const absolutePath = "./" + path.join(dirname, relativePath); //依赖的绝对路径
      deps[relativePath] = absolutePath; //value 为绝对路径
    },
  });
  // ES6 转 ES5
  const { code } = babel.transformFromAst(ast, null, {
    presets: ["@babel/preset-env"],
  });
  const moduleInfo = { file, deps, code };
  //   console.log("moduleInfo:", moduleInfo);
  return moduleInfo;
}
// getModuleInfo("./src/index.js");

//获取依赖 写一个递归函数
function getDeps(temp, { deps }) {
  Object.keys(deps).forEach((key) => {
    const child = getModuleInfo(deps[key]);
    temp.push(child);
    getDeps(temp, child);
  });
}

// 解析模块
function parseModules(file) {
  const entry = getModuleInfo(file);
  const temp = [entry];
  const depsGraph = {}; //存最后输出的依赖他
  getDeps(temp, entry); //从入口开始，递归获取依赖
  temp.forEach((info) => {
    depsGraph[info.file] = {
      deps: info.deps,
      code: info.code,
    };
  });
  return depsGraph;
}

function bundle(file) {
  const depsGraph = JSON.stringify(parseModules(file));
  return `(function (graph) {
        function require(file) {
            function absRequire(relPath) {
                return require(graph[file].deps[relPath])
            }
            var exports = {};
            (function (require,exports,code) {
                eval(code)
            })(absRequire,exports,graph[file].code)
            return exports
        }
        require('${file}')
    })(${depsGraph})`;
}

const js = bundle("./src/index.js");
!fs.existsSync("./dist") && fs.mkdirSync("./dist");
fs.writeFileSync("./dist/bundle.js", js);
