# Licensed to the Apache Software Foundation (ASF) under one or more contributor
# license agreements; and to You under the Apache License, Version 2.0.

FROM ibmfunctions/action-nodejs-v10

RUN apt-get update \
  && apt-get install -y git \
  && npm install --save simple-git@1.74.1 template-file@3.0.1

RUN curl -fsSL https://clis.ng.bluemix.net/install/linux | sh

RUN bx plugin install cloud-functions