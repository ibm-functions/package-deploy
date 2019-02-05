/*
 * Licensed to the Apache Software Foundation (ASF) under one or more
 * contributor license agreements.  See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership.
 * The ASF licenses this file to You under the Apache License, Version 2.0
 * (the "License"); you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package packages


import org.junit.runner.RunWith
import org.scalatest.BeforeAndAfterAll
import org.scalatest.junit.JUnitRunner
import common.{TestHelpers, Wsk, WskProps, WskTestHelpers}

import com.jayway.restassured.RestAssured
import com.jayway.restassured.config.SSLConfig

import spray.json._

@RunWith(classOf[JUnitRunner])
class DeployWebTests extends TestHelpers
    with WskTestHelpers
    with BeforeAndAfterAll {

    implicit val wskprops = WskProps()
    val wsk = new Wsk()

    // action and web action url
    val deployAction = "/whisk.system/deployWebV2/wskdeployV2"
    val deployActionURL = s"https://${wskprops.apihost}/api/v1/web${deployAction}.http"

    // set parameters for deploy tests
    val deployTestRepo = "https://github.com/apache/incubator-openwhisk-package-deploy"
    val deployTestRegion = "us-south"
    val deployTestNamespace = "some_namespace"
    val incorrectGithubRepo = "https://github.com/apache/openwhisk-package-deploy-incorrect"
    val manifestPath = "does/not/exist"

    // statuses from deployWeb
    val successStatus = """"status": "success""""
    val activationId = """"activationId:""""
    val githubNonExistentStatus = """"error": "There was a problem cloning from github.  Does that github repo exist?  Does it begin with http?""""
    val errorLoadingManifestStatus = """"error": "Error loading manifest file. Does a manifest file exist?""""

    def makePostCallWithExpectedResult(params: JsObject, expectedResult: String, expectedCode: Int) = {
      val response = RestAssured.given()
          .contentType("application/json\r\n")
          .config(RestAssured.config().sslConfig(new SSLConfig().relaxedHTTPSValidation()))
          .body(params.toString())
          .post(deployActionURL)
      assert(response.statusCode() == expectedCode)
      response.body.asString should include(expectedResult)
      response.body.asString.parseJson.asJsObject.getFields("activationId") should have length 1
    }

    behavior of "deployWeb Package"


    // test to create a template with no github repo provided
    it should "return error if there is no github repo provided" in {
      makePostCallWithExpectedResult(JsObject(
        "manifestPath" -> JsString(manifestPath),
        "region" -> JsString(deployTestRegion),
        "namespace" -> JsString(deployTestNamespace),
        "iamData" -> JsObject()
      ), """"error": "Please enter the GitHub repo url in params"""", 400)
    }

    // test to create a template with a nonexistant github repo provided
    it should "return error if there is a nonexistant repo provided" in {
      makePostCallWithExpectedResult(JsObject(
        "gitUrl" -> JsString(incorrectGithubRepo),
        "manifestPath" -> JsString(manifestPath),
        "region" -> JsString(deployTestRegion),
        "namespace" -> JsString(deployTestNamespace),
        "iamData" -> JsObject()
      ), githubNonExistentStatus, 400)
    }

    // test to create a template with an incorrect manifestPath provided
    it should "return with failure if incorrect manifestPath is provided" in {
      makePostCallWithExpectedResult(JsObject(
        "gitUrl" -> JsString(deployTestRepo),
        "manifestPath" -> JsString(manifestPath),
        "region" -> JsString(deployTestRegion),
        "namespace" -> JsString(deployTestNamespace),
        "iamData" -> JsObject()
      ), errorLoadingManifestStatus, 400)
    }

    // test to create a template with an incorrect region provided
    it should "return with failure if incorrect region is provided" in {
        makePostCallWithExpectedResult(JsObject(
            "gitUrl" -> JsString(deployTestRepo),
            "region" -> JsString("ap-south"),
            "namespace" -> JsString(deployTestNamespace),
            "iamData" -> JsObject()
        ), """"error": "A valid region must be specified"""", 400)
    }

    // test to create a template with no namespace provided
    it should "return with failure if no namespace is provided" in {
        makePostCallWithExpectedResult(JsObject(
            "gitUrl" -> JsString(deployTestRepo),
            "region" -> JsString(deployTestRegion),
            "iamData" -> JsObject()
        ), """"error": "A namespace must be specified"""", 400)
    }

    // test to create a template with no credential data provided
    it should "return with failure if no credential data is provided" in {
        makePostCallWithExpectedResult(JsObject(
            "gitUrl" -> JsString(deployTestRepo),
            "region" -> JsString(deployTestRegion),
            "namespace" -> JsString(deployTestNamespace)
        ), """"error": "Either iamData or cfData must be specified"""", 400)
    }

}
