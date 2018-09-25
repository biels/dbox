const fs = require('fs');
const cp = require("child_process");
const util = require('util');
const zlib = require('zlib');

const configDir = 'config';
const targetDir = 'target';
let apps = [];
let appPaths = [];

const unzipTargetIfPresent = () => {
  console.log(`Extracting target...`);
  const rs = fs.createReadStream(`target.zip`)
  const ws = fs.createWriteStream(`target`)
  rs.pipe(zlib.Unzip()).pipe(ws);
}

const getApps = () => {
  return getDirectories(targetDir)
}
const createDirectoryIfNecessary = (path) => {
  if (!fs.existsSync(path)) fs.mkdirSync(path);
}
const createBaseDirectoriesIfNecessary = () => {
  createDirectoryIfNecessary(configDir)
  createDirectoryIfNecessary(targetDir)
}
const createConfigDirectoriesIfNecessary = () => {
  apps.forEach(a => {
    let path = `config/${a}`;
    createDirectoryIfNecessary(path)
  })
}
const getAppTargetDir = a => `${targetDir}/${a}`;
const getAppConfigDir = a => `${configDir}/${a}`;
const getAppPaths = () => {
  return apps.map(getAppTargetDir)
}
const getConfigPaths = () => {
  return apps.map(getAppConfigDir)
}

const copyTemplatesToConfig = () => {
  apps.forEach(a => {
    let appTargetDir = getAppTargetDir(a);
    let appConfigDir = getAppConfigDir(a);
    fs.readdirSync(appTargetDir)
      .filter(f => f.endsWith('.template'))
      .forEach(f => {
        let src = `${appTargetDir}/${f}`;
        let dest = `${appConfigDir}/${f}`;
        if (fs.existsSync(src)) fs.copyFileSync(src, dest);
      })
  })
}
const copyNonTemplatesToTarget = () => {
  apps.forEach(a => {
    let appTargetDir = getAppTargetDir(a);
    let appConfigDir = getAppConfigDir(a);
    fs.readdirSync(appConfigDir)
      .filter(f => !f.endsWith('.template'))
      .forEach(f => {
        let src = `${appConfigDir}/${f}`;
        let dest = `${appTargetDir}/${f}`;
        if (fs.existsSync(src)) fs.copyFileSync(src, dest);
      })
  })
}

const findMainFilename = (files) => {
  const valid = ['server.js', 'main.js', 'app.js', 'index.js']
  const validFiles = files.filter(f => valid.includes(f))
  if(validFiles.length === 0) {
    return null;
  }
  return validFiles[0];
}
const killpm2 = () => {
  let command = `pm2 kill"`;
  console.log(`Taking previous deployment down...`);
  cp.execSync(command)
}
const startApp = (app) => {
  let appTargetDir = getAppTargetDir(app);
  let filename = null;
  if(fs.existsSync(`${appTargetDir}/entrypoint.txt`))
    filename = fs.readFileSync(`${appTargetDir}/entrypoint.txt`)
  if(filename == null) filename = findMainFilename(fs.readdirSync(appTargetDir))
  if(filename == null){
    console.log(`Could not find a valid entrypoint for ${app}`);
    return
  }
  let command = `pm2 start -f ${filename} --name "${app}"`;
  console.log(`Starting ${app} using ${filename}...`);
  cp.execSync(command, {cwd: appTargetDir})
}
const startAll = () => {
  apps.forEach(startApp)
}

// Utils

function getDirectories(path) {
  return fs.readdirSync(path).filter(function (file) {
    return fs.statSync(path + '/' + file).isDirectory();
  });
}

createBaseDirectoriesIfNecessary();
// unzipTargetIfPresent();
console.log(`Detecting apps...`);
apps = getApps();
if(apps.length === 0) {
  console.log(`No apps detected`);
  process.exit(0);
}
appPaths = getAppPaths();
createConfigDirectoriesIfNecessary()
console.log(`Detected ${apps.length} apps: ${apps.join(', ')}`);
console.log(`Provisioning all apps...`);
copyTemplatesToConfig();
copyNonTemplatesToTarget();


console.log(`Starting apps...`);
killpm2(); //Improve
startAll();
