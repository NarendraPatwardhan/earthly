To copy the files for [this example ( Part 6 )](https://github.com/earthly/earthly/tree/main/examples/tutorial/go/part6) run

```bash
earthly --artifact github.com/earthly/earthly/examples/tutorial/go:main+part6/part6 ./part6
```

Examples in [Python](#more-examples), [Javascript](#more-examples) and [Java](#more-examples) are at the bottom of this page.

## The WITH DOCKER Command

You may find that you need to run Docker commands inside of a target. For those cases Earthly offers `WITH DOCKER`. `WITH DOCKER` will initialize a Docker daemon that can be used in the context of a `RUN` command. Let's take a look at a couple examples. 

Whenever you need to use `WITH DOCKER` we recommend (though it is not required) that you use Earthly's own Docker in Docker (dind) image: `earthly/dind:alpine`.

Notice `WITH DOCKER` creates a block of code that has an `END` keyword. Everything that happens within this block is going to take place within our `earthly/dind:alpine` container.

### Pulling an Image
```Dockerfile
hello:
    FROM earthly/dind:alpine
    WITH DOCKER --pull hello-world
        RUN docker run hello-world
    END

```
You can see in the command above that we can pass a flag to `WITH DOCKER` telling it to pull an image from Docker Hub. We can pass other flags to load in artifacts built by other targets `--load` or even images defined by docker-compose `--compose`. These images will be available within the context of `WITH DOCKER`'s docker daemon.

### Loading an Image
We can load in an image created by another target with the `--load` flag.

```Dockerfile
my-hello-world:
    FROM ubuntu
    CMD echo 'hello world'
    SAVE IMAGE my-hello:latest

hello:
    FROM earthly/dind:alpine
    WITH DOCKER --load hello:latest=+my-hello-world
        RUN docker run hello
    END
```

## A Real World Example

One common use case for `WITH DOCKER` is running integration tests that require other services. In this case we need to set up a redis service for our tests.

### Using Docker Compose

`docker-compose.yml`
```yml
version: "3"
services:
  redis:
    container_name: local-redis
    image: redis:6.0-alpine
    ports:
      - 127.0.0.1:6379:6379
    hostname: redis
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:6379"]
      interval: 1s
      timeout: 10s
      retries: 5

```
`main.go`
```go
package main

import (
	"github.com/sirupsen/logrus"
)

var howCoolIsEarthly = "IceCool"

func main() {
	logrus.Info("hello world")
}
```
`main_integration_test.go`
```go
package main

import (
	"context"
	"testing"

	"github.com/go-redis/redis/v8"
	"github.com/stretchr/testify/require"
)

func TestIntegration(t *testing.T) {
	ctx := context.Background()
	rdb := redis.NewClient(&redis.Options{
		Addr:     "localhost:6379",
		Password: "", // no password set
		DB:       0,  // use default DB
	})

	err := rdb.Set(ctx, "howCoolIsEarthly", howCoolIsEarthly, 0).Err()
	if err != nil {
		panic(err)
	}

	resultFromDB, err := rdb.Get(ctx, "howCoolIsEarthly").Result()
	if err != nil {
		panic(err)
	}
	require.Equal(t, howCoolIsEarthly, resultFromDB)
}
```

```Dockerfile
VERSION 0.6
FROM golang:1.15-alpine3.13
WORKDIR /go-example

deps:
    COPY go.mod go.sum ./
    RUN go mod download
    SAVE ARTIFACT go.mod AS LOCAL go.mod
    SAVE ARTIFACT go.sum AS LOCAL go.sum

test-setup:
    FROM +deps
    COPY main.go .
    COPY main_integration_test.go .
    ENV CGO_ENABLED=0
    ENTRYPOINT [ "go", "test", "github.com/earthly/earthly/examples/go"]
    SAVE IMAGE test:latest

integration-tests:
    FROM earthly/dind:alpine
    COPY docker-compose.yml ./
    WITH DOCKER --compose docker-compose.yml --load tests:latest=+test-setup
        RUN docker run --network=host tests 
    END

```
When we use the `--compose` flag, Earthly will start up the services defined in the `docker-compose` file for us. 

## More Examples
<details open>
<summary>Python</summary>

To copy the files for [this example ( Part 6 )](https://github.com/earthly/earthly/tree/main/examples/tutorial/python/part6) run

```bash
earthly --artifact github.com/earthly/earthly/examples/tutorial/python:main+part6/part6 ./part6
```
`./tests/test_db_connection.py`

```python
import unittest
import psycopg2

class MyIntegrationTests(unittest.TestCase):

    def test_db_connection_active(self):
        connection = psycopg2.connect(
            host="localhost",
            database="test_db",
            user="earthly",
            password="password")
        
        self.assertEqual(connection.closed, 0)

if __name__ == '__main__':
    unittest.main()
```

```yml
version: "3.9"
   
services:
  db:
    image: postgres
    container_name: db
    hostname: postgres
    environment:
      - POSTGRES_DB=test_db
      - POSTGRES_USER=earthly
      - POSTGRES_PASSWORD=password
    ports:
      - 5432:5432
```

`./Earthfile`

```Dockerfile
VERSION 0.6
FROM python:3
WORKDIR /code

build:
  COPY ./requirements.txt .
  RUN pip install -r requirements.txt
  COPY . .

test:
  FROM +build
  COPY ./docker-compose.yml .
  RUN apt-get update
  RUN apt-get install -y postgresql-client
  WITH DOCKER --compose docker-compose.yml
      RUN while ! pg_isready --host=localhost --port=5432 --dbname=my_db --username=example; do sleep 1; done ;\
        python manage.py test
  END
```
</details>

<details open>
<summary>JS</summary>
To copy the files for [this example ( Part 6 )](https://github.com/earthly/earthly/tree/main/examples/tutorial/js/part6) run

```bash
earthly --artifact github.com/earthly/earthly/examples/tutorial/js:main+part6/part6 ./part6
```
In this example, we use `WITH DOCKER` to run a frontend app and backend api together using Earthly.

The App

`./app/package.json`

```json
{
  "name": "example-js",
  "version": "0.0.1",
  "description": "Hello world",
  "private": true,
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "author": "",
  "license": "MPL-2.0",
  "devDependencies": {
    "webpack": "^4.42.1",
    "webpack-cli": "^3.3.11"
  },
  "dependencies": {
    "http-server": "^0.12.1"
  }
}
```

`./app/package-lock.json` (empty)

```json
```

The code of the app might look like this

`./app/src/index.js`

```js
async function getUsers() {

    const response = await fetch('http://localhost:3080/api/users');
    return await response.json();
}

function component() {
  const element = document.createElement('div');
  getUsers()
    .then( users => {
      element.innerHTML = `hello world <b>${users[0].first_name} ${users[0].last_name}</b>`
    })

	return element;
}

document.body.appendChild(component());
```

`./app/src/index.html`

```html
<!doctype html>
<html>

<head>
    <title>Getting Started</title>
</head>

<body>
    <script src="./main.js"></script>
</body>

</html>
```
And our api.

`./api/package.json`

```json
{
  "name": "api",
  "version": "1.0.0",
  "description": "",
  "main": "index.js",
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "author": "",
  "license": "ISC",
  "dependencies": {
    "cors": "^2.8.5",
    "express": "^4.17.1",
    "http-proxy-middleware": "^1.0.4",
    "pg": "^8.7.3"
  }
}
```
`./api/package-lock.json` (empty)

```json
```
`./api/server.js`

```js
const express = require('express');
const path = require('path');
const cors = require("cors");
const app = express(),
bodyParser = require("body-parser");
port = 3080;

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../my-app/build')));

app.use(cors());

const users = [
	{
		'first_name': 'Lee',
		'last_name' : 'Earth'
	}
]

app.get('/api/users', (req, res) => {
  console.log('api/users called!')
  res.json(users);
});

app.listen(port, 'localhost', () => {
  console.log(`Server listening on the port::${port}`);
});
```

The `Earthfile` is at the root of the directory.

`./Earthfile`

```Dockerfile
VERSION 0.6
FROM node:13.10.1-alpine3.11
WORKDIR /js-example

app-deps:
    COPY ./app/package.json ./
    COPY ./app/package-lock.json ./
    RUN npm install
    # Output these back in case npm install changes them.
    SAVE ARTIFACT package.json AS LOCAL ./app/package.json
    SAVE ARTIFACT package-lock.json AS LOCAL ./app/package-lock.json

build-app:
    FROM +app-deps
    COPY ./app/src ./app/src
    RUN mkdir -p ./app/dist && cp ./app/src/index.html ./app/dist/
    RUN cd ./app && npx webpack
    SAVE ARTIFACT ./app/dist /dist AS LOCAL ./app/dist

app-docker:
    FROM +app-deps
    ARG tag='latest'
    COPY +build-app/dist ./app/dist
    EXPOSE 8080
    ENTRYPOINT ["/js-example/node_modules/http-server/bin/http-server", "./app/dist"]
    SAVE IMAGE js-example:$tag

api-deps:
    COPY ./api/package.json ./
    COPY ./api/package-lock.json ./
    RUN npm install
    # Output these back in case npm install changes them.
    SAVE ARTIFACT package.json AS LOCAL ./api/package.json
    SAVE ARTIFACT package-lock.json AS LOCAL ./api/package-lock.json

api-docker:
    FROM +api-deps
    ARG tag='latest'
    COPY ./api/server.js .
    RUN pwd
    RUN ls
    EXPOSE 3080
    ENTRYPOINT ["node", "server.js"]
    SAVE IMAGE js-api:$tag

# Run your app and api side by side
app-with-api:
    FROM earthly/dind:alpine
    RUN apk add curl
    WITH DOCKER \
        --load app:latest=+app-docker \
        --load api:latest=+api-docker
        RUN docker run -d --network host api && \
            docker run -d -p 8080:8080 app  && \
            sleep 5 && \
            curl localhost:8080 | grep 'Getting Started' && \
            curl localhost:3080/api/users | grep 'Earth'
    END
```
Now you can run `earthly -P +app-with-api` to run the app and api side-by-side.
</details>