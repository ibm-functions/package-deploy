const fs = require('fs');
const git = require('simple-git');
const common = require('./lib/common');

/**
 * Action to deploy Cloud Functions elements from a compliant repository
 *  @param {string} gitUrl - (required) github url containing the manifest and elements to deploy
 *  @param {string} region - (required) target region
 *  @param {string} namespace (required) target namespace
 *  @param {string} manifestPath - (optional) the path to the manifest file, e.g. "openwhisk/src"
 *  @param {object} envData - (optional) env details such as cloudant username or cloudant password
 *  @param {object} iamData (required for IAM only) {
 *                                                    token: "value",        // (required) IAM token
 *                                                    refreshToken: "value"  // (required) IAM refresh token
 *                                                  }
 *  @param {object} cfData (required for CF only)
 *                                                  {
 *                                                    token: "value",        // (required) CF access token
 *                                                    refreshToken: "value", // (required) CF access refresh token
 *                                                    org: "value",          // (required) CF target organization name
 *                                                    space: "value"         // (required) CF target space name
 *                                                  }
 *  @return {object} Promise
 */
function main(params) {
  const activationId = process.env.__OW_ACTIVATION_ID;
  // Grab optional envData and manifestPath params for wskdeploy
  let {
    envData,
    manifestPath,
    gitUrl,
    region,
    namespace,
    iamData,
    cfData
  } = params;

  // confirm gitUrl was provided as a parameter
  if (!gitUrl) {
    return sendError(400, 'Please enter the GitHub repo url in params');
  }
  if (!region || (region !== 'us-south' && region !== 'us-east'&& region !== 'eu-gb' &&
      region !== 'eu-de' && region !== 'jp-tok' && region !== 'ys1')) {
    return sendError(400, 'A valid region must be specified');
  }
  if (!namespace) {
    return sendError(400, 'A namespace must be specified');
  }
  if (!iamData && !cfData) {
    return sendError(400, 'Either iamData or cfData must be specified');
  }

  return new Promise((resolve, reject) => {
    getRepo(gitUrl, manifestPath)
    .then(result => {
      Object.assign(result, {envData, region, namespace, iamData, cfData});
      return common.main(result);
    })
    .then(success => {
      resolve({
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: { status: success, activationId },
      });
    })
    .catch(err => {
      console.log(err);
      reject(sendError(400, err));
    });
  });

}

function getRepo(gitUrl, manifestPath) {

  return new Promise((resolve, reject) => {
    // if no manifestPath was provided, use current directory
    if (!manifestPath) {
      manifestPath = '.';
    }

    // Extract the name of the repo for the tmp directory
    const tmpUrl = gitUrl.replace('https://', '');
    const repoSplit = tmpUrl.split('/');
    const repoOrg = repoSplit[1];
    const repoName = repoSplit[2];
    const localDirName = `${__dirname}/../tmp/${repoOrg}/${repoName}`;

    // any pre installed github repos should be a sibling to this package in "preInstalled" folder
    const templatesDirName = `${__dirname}/preInstalled/${repoOrg}/${repoName}`;

    if (fs.existsSync(templatesDirName)) {
      resolve({
        repoDir: templatesDirName,
        usingTemp: false,
        manifestPath,
        manifestFileName: 'manifest.yaml'
      });
    } else {
      return git().clone(gitUrl, localDirName, ['--depth', '1'], (err) => {
        if (err) {
          reject('There was a problem cloning from github.  Does that github repo exist?  Does it begin with http?');
        }
        resolve({
          repoDir: localDirName,
          usingTemp: true,
          manifestPath,
          manifestFileName: 'manifest.yaml'
        });
      });
    }
  });
}

function sendError(statusCode, err, message) {
  let error = err;
  if (err.message) {
    error = err.message;
  }
  const activationId = process.env.__OW_ACTIVATION_ID;
  const params = { error, activationId };
  if (message) {
    params.message = message;
  }
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: params,
  };
}

exports.main = main;
