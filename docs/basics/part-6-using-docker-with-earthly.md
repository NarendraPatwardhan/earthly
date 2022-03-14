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

build:
    FROM +deps
    COPY main.go .
    RUN go build -o build/go-example main.go
    SAVE ARTIFACT build/go-example /go-example AS LOCAL build/go-example

integration-test:
    FROM +deps
    COPY main.go .
    COPY main_integration_test.go .
    COPY docker-compose.yml ./
    WITH DOCKER --compose docker-compose.yml
        RUN CGO_ENABLED=0 go test github.com/earthly/earthly/examples/go
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
## Using Docker Compose
```yml
version: "3.9"
   
services:
  db:
    image: postgres
    container_name: db
    hostname: postgres
    environment:
      - POSTGRES_NAME=my_mediamy_db
      - POSTGRES_USER=example
      - POSTGRES_PASSWORD=1234
      - POSTGRES_HOST_AUTH_METHOD=trust
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
## Loading an Image from Another Target

</details>
