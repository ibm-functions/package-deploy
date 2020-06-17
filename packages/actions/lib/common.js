const fs = require('fs');
const path = require('path');
const moment = require('moment');
const { exec } = require('child_process');
const { renderTemplateFile } = require('template-file');
const util = require('util');
const fs_writeFile = util.promisify(fs.writeFile);
const fs_readFile = util.promisify(fs.readFile);
const async_exec = util.promisify(exec);

/**
 * Common function to enable deployment from deployWeb.js & deploy.js
 */
function main(params) {
  const {
    manifestPath,
    usingTemp,
    manifestFileName,
    repoDir,
    envData,
    region,
    namespace,
    iamData,
    cfData
  } = params;

  const manifestFilePath = `${repoDir}/${manifestPath}/${manifestFileName}`;
  const configTemplate = path.join('lib', 'config.json');
  const cfConfigTemplate = path.join('lib', 'cf_config.json');
  const fnConfigTemplate = path.join('lib', 'fn_config.json');
  const execOptions = {
    cwd: `${repoDir}/${manifestPath}`,
    maxBuffer: 1024 * 1024,
  };

  //If we were passed environment data (Cloudant bindings, etc.) add it to the options for `exec`
  if (envData) {
    envData.HOME = '/root';
    execOptions.env = envData;
  }

  let wskDeployCmd = `ibmcloud fn deploy -v --manifest ${manifestFileName}`;
  let namespaceCmd = iamData ? `ibmcloud fn property set -v --namespace ${namespace}` : 'ibmcloud fn property unset --namespace';

  if (!fs.existsSync(manifestFilePath)) {
    if (usingTemp) {
      deleteFolder(repoDir);
    }
    return Promise.reject('Error loading manifest file. Does a manifest file exist?');
  }
  else {
    return getRegionData(region, iamData, cfData)
    .then(regionGlob => {
      let timeGlob = {currentTime: moment().format()};
      return Promise.all(
        [
          renderAndWriteFile(configTemplate, regionGlob, '/root/.bluemix/config.json'),
          renderAndWriteFile(cfConfigTemplate, regionGlob, '/root/.bluemix/.cf/config.json'),
          renderAndWriteFile(fnConfigTemplate, timeGlob, '/root/.bluemix/plugins/cloud-functions/config.json')
        ]);
    })
    .then(() => {
      console.log('setting namespace');
      return async_exec(namespaceCmd);
    })
    .then(result => {
      console.log(result.stdout);
      console.log('running deploy');
      return execWskDeploy(wskDeployCmd, execOptions);
    })
    .catch(error => {
      return Promise.reject(error);
    })
    .finally(() => {
      if (usingTemp) {
        deleteFolder(repoDir);
      }
    });
  }
}

function execWskDeploy(wskDeployCmd, execOptions) {
  return new Promise((resolve, reject) => {
    exec(wskDeployCmd, execOptions, (err, stdout, stderr) => {
      if (err) {
        return reject('Error running `wsk deploy`: ' + err);
      }
      if (stdout) {
        console.log('stdout from wsk deploy: ', stdout);
        if (stdout.error) {
          return reject(stdout);
        }
      }
      if (stderr) {
        console.log('stderr from wsk deploy: ', stderr);
        return reject(stderr);
      }
      console.log('Finished! Resolving now');
      resolve({
        status: 'success',
        success: true,
      });
    });
  });
}

function renderAndWriteFile(template, dataObject, configFile) {
  return renderTemplateFile(template, dataObject)
  .then(renderedString => {
    return fs_writeFile(configFile, renderedString);
  })
  .catch(error => {
    return Promise.reject(error);
  });
}

function getRegionData(regionInput, iamData, cfData) {
  const region_data = path.join('lib', 'region_data.json');
  return new Promise((resolve, reject) => {
    fs_readFile(region_data)
    .then(contents => {
      let regionData = JSON.parse(contents);
      let dataObject;
      if (iamData) {
        dataObject = {
          region: regionData[regionInput].region,
          apiEndpoint: regionData[regionInput].apiEndpoint,
          iamEndpoint: regionData[regionInput].iamEndpoint,
          iamToken: iamData.token,
          iamRefreshToken: iamData.refreshToken
        };
      }
      else {
        dataObject = {
          region: regionData[regionInput].region,
          apiEndpoint: regionData[regionInput].apiEndpoint,
          authorizationEndpoint: regionData[regionInput].authorizationEndpoint,
          accessToken: cfData.token,
          refreshToken: cfData.refreshToken,
          organizationFields: {
            name: cfData.org
          },
          spaceFields: {
            name: cfData.space
          }
        };
      }
      resolve(dataObject);
    })
    .catch(error => {
      console.log('an error was thrown', error);
      reject(error);
    });
  });

}


/**
 * recursive function to delete a folder, must first delete items inside.
 * @param  {string} pathToDelete    inclusive path to folder to delete
 */
function deleteFolder(pathToDelete) {
  if (fs.existsSync(pathToDelete)) {
    fs.readdirSync(pathToDelete).forEach((file, index) => {
      const curPath = path.join(pathToDelete, file);
      if (fs.lstatSync(curPath).isDirectory()) {
        deleteFolder(curPath);
      } else {
        // unlinkSync deletes files.
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(pathToDelete);
  }
}

module.exports = {
  main,
};
