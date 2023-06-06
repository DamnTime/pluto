/**
 * 文件上传
 */
const fs = require("fs");
const { resolve, join } = require("path");
const qiniu = require("qiniu");

const prefix = "pluto";

const ROOT = resolve(__dirname);

const staticPath = join(ROOT, "./public");

/**
 *   
 *AK: 'FPZn50jfaVSbgMXLEU3CUIWKIqQaYUp6tOqXQ2l1',
  SK: 'RDhwROl7ZNKUFuNb6DrZdae_zZZaNTo-GIVNO5ql',
  bucket: 'pluto1811',
  origin: 'http://cdn.pluto1811.com/',
 */

// 授权秘钥
const accessKey = "FPZn50jfaVSbgMXLEU3CUIWKIqQaYUp6tOqXQ2l1";
const secretKey = "RDhwROl7ZNKUFuNb6DrZdae_zZZaNTo-GIVNO5ql";

// 存储空间名称
const bucket = "pluto1811";

// 要上传的资源目录

// 上传后的文件前缀
// const prefix = 'static'

// 创建鉴权对象
const mac = new qiniu.auth.digest.Mac(accessKey, secretKey);

// 创建并修改配置对象(Zone_z0=华东 Zone_z1=华北 Zone_z2=华南 Zone_na0=北美)
const config = new qiniu.conf.Config();
config.zone = qiniu.zone.Zone_z2;

// 文件上传方法
function uploadFile(localFile, key) {
  // 配置上传到七牛云的完整路径
  // const key = localFile.replace(staticPath, prefix);
  // console.log('开始上传');
  const options = {
    scope: `${bucket}:${key}`,
    expires: 60,
  };
  const putPolicy = new qiniu.rs.PutPolicy(options);
  // 生成上传凭证
  const uploadToken = putPolicy.uploadToken(mac);
  // 创建额外内容对象
  const putExtra = new qiniu.form_up.PutExtra();
  // 创建表单上传对象
  const formUploader = new qiniu.form_up.FormUploader(config);
  return new Promise((rsv) => {
    formUploader.putStream(
      uploadToken,
      key,
      fs.createReadStream(localFile),
      putExtra,
      (respErr, respBody) => {
        if (respErr) throw respErr;
        console.log("已上传: ", respBody);
        rsv();
      }
    );
  });
}

// 目录上传方法
async function uploadDirectory(dirPath) {
  const files = fs.readdirSync(dirPath);
  let i = 0;
  /* eslint-disable no-await-in-loop */
  while (i < files.length) {
    const item = files[i];
    const path = `${dirPath}/${item}`;
    const stats = fs.statSync(path);
    if (stats.isDirectory()) {
      uploadDirectory(path);
    } else {
      await uploadFile(
        path,
        `${prefix}${path.replace(join(resolve(__dirname), "public"), "")}`
      );
    }
    i += 1;
  }
  /* eslint-enable no-await-in-loop */
}

fs.exists(staticPath, (exists) => {
  if (!exists) {
    console.log("目录不存在！");
  } else {
    console.log("开始上传...");
    uploadDirectory(staticPath);
  }
});
