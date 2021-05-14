#!/bin/bash
#
# use the command line interface to install standard actions deployed
# automatically
#
# To run this command
# ./installCatalog.sh  <AUTH> <EDGE_HOST> <WSK_CLI> <DOCKER>
# AUTH and EDGE_HOST are found in $HOME/.wskprops
# WSK_CLI="$OPENWHISK_HOME/bin/wsk"

set -e
set -x

if [ $# -eq 0 ]
  then
  echo "Usage: ./installCatalog.sh <authkey> <edgehost> <pathtowskcli> <docker>"
fi

AUTH="$1"
EDGE_HOST="$2"
WSK_CLI="$3"
DOCKER="$4"

# If docker is not provided, set to default version.
if [ -z "$4" ]
  then
    DOCKER="ibmfunctions/wskdeploy:0.0.4"
fi

# If the auth key file exists, read the key in the file. Otherwise, take the
# first argument as the key itself.
if [ -f "$AUTH" ]; then
  AUTH=`cat $AUTH`
fi

PACKAGE_HOME="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

export WSK_CONFIG_FILE= # override local property file to avoid namespace clashes

# make deployWeb.zip & install
OLD_PATH=`pwd`
cd actions

if [ -e deployWeb.zip ]
  then
  rm -rf deployWeb.zip
fi

cp -f deployWeb_package.json package.json
zip -r deployWeb.zip package.json deployWeb.js lib ../../../preInstalled/

cd $OLD_PATH

$WSK_CLI -i --apihost "$EDGE_HOST" package update --auth "$AUTH" --shared no "deployWebV2" \
-a description "This package offers a convenient way for you to describe and deploy any part of the OpenWhisk programming model using a Manifest file written in YAML." \
-a prettyName "Whisk Deploy Web"

$WSK_CLI -i --apihost "$EDGE_HOST" action update --auth "$AUTH" "deployWebV2/wskdeployV2" "$PACKAGE_HOME/actions/deployWeb.zip" --web true \
-a description 'Creates an action that allows you to run wskdeploy from OpenWhisk' \
-a parameters '[ {"name":"gitUrl", "required":true, "bindTime":true, "description": "The URL to the GitHub repository to deploy"}, {"name":"manifestPath", "required":false, "bindTime":true, "description": "The relative path to the manifest file from the GitHub repo root"}, {"name":"envData", "required":false, "description": "Template-specific environment data object"} ]' \
-a sampleInput '{"gitUrl":"github.com/my_template", "manifestPath":"runtimes/swift", "envData": "{\"ENV_VARIABLE_1\":\"VALUE_1\", \"ENV_VARIABLE_2\":\"VALUE_2\"}"}' \
--docker "$DOCKER"
