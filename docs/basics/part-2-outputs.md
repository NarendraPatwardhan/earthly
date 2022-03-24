To copy the files for [this example ( Part 2 )](https://github.com/earthly/earthly/tree/main/examples/tutorial/go/part2) run

```bash
earthly --artifact github.com/earthly/earthly/examples/tutorial/go:main+part2/part2 ./part2
```

Targets have the ability to produce output. You can save files or docker images to your local machine or push them to remote repositories. Targets can also run commands that effect the local environment outside of the build. But not all targets produce output. In this sections we'll take a look at the commands that can produce output and how to use them.

## Saving Files
The command [SAVE ARTIFACT](https://docs.earthly.dev/docs/earthfile#save-artifact) copies a file, a directory, or a series of files and directories represented by a wildcard, from the build environment into the target's artifact environment.

This gives us the ability to copy files between targets, **but it does not allow us to save any files to local machine.**

```Dockerfile
build:
    COPY main.go .
    RUN go build -o build/go-example main.go
    SAVE ARTIFACT build/go-example /go-example

docker:
    COPY +build/go-example .
    ENTRYPOINT ["/go-example/go-example"]
    SAVE IMAGE go-example:latest
```
In order to **save the file locally** , we need to `AS LOCAL` to the command.

```Dockerfile
build:
    COPY main.go .
    RUN go build -o build/go-example main.go
    SAVE ARTIFACT build/go-example /go-example AS LOCAL build/go-example
```

If we run this example with `earthly +build`, we'll see a `build` directory show up locally with a `go-example` file inside of it.



## Saving Docker Images
Saving Docker images to your locally machine is easy with the `SAVE IMAGE` command.

```Dockerfile
build:
    COPY main.go .
    RUN go build -o build/go-example main.go
    SAVE ARTIFACT build/go-example /go-example AS LOCAL build/go-example

docker:
    COPY +build/go-example .
    ENTRYPOINT ["/go-example/go-example"]
    SAVE IMAGE go-example:latest
```
In this example, running `earthly +docker` will save an image named `go-example` with a tag of `latests`.

```bash
=> docker image ls
REPOSITORY          TAG       IMAGE ID       CREATED          SIZE
go-example          latest    08b9f749023d   19 seconds ago   297MB
```
**NOTE**

If we run a target as a reference in `FROM` or `COPY`, outputs will not be produced.
```Dockerfile
build:
    COPY main.go .
    RUN go build -o build/go-example main.go
    SAVE ARTIFACT build/go-example /go-example AS LOCAL build/go-example

docker:
    COPY +build/go-example .
    ENTRYPOINT ["/go-example/go-example"]
    SAVE IMAGE go-example:latest
```
In this case, running `earthly +docker` will not produce any output. In other words, you will not have a `build/go-example` written locally, but running `earthly +build` will still produce output as expected.

The exception to this rule is the `BUILD` command.

```Dockerfile
build-app:
    COPY main.go .
    RUN go build -o build/go-example main.go
    SAVE ARTIFACT build/go-example /go-example AS LOCAL build/go-example

another-target:
    BUILD +build-app
```
Running `earthly +another-target` in this case, will still output `build/go-example` locally.

## Pushing

### Docker 

In addition to saving files and images locally, we can also push them to remote repositories.

```Dockerfile
docker:
    COPY +build/go-example .
    ENTRYPOINT ["/go-example/go-example"]
    SAVE IMAGE --push go-example:latest
```
Note that adding the `--push` flag to `SAVE IMAGE` is not enough, we'll also need to invoke push when we call earthly. `earthly --push +docker`.

#### External Changes
You can also use `--push` as part of a `RUN` command to define commands that have an effect external to the build. These kinds of effects are only allowed to take place if the entire build succeeds.

This allows you to push to remote repositories. 

```Dockerfile
release:
    RUN --push --secret GITHUB_TOKEN=+secrets/GH_TOKEN github-release upload
```
```bash
earthly --push +release
```
But also allows you to do things like run database migrations.

```Dockerfile
migrate:
    FROM +build
    RUN --push bundle exec rails db:migrate
```
```bash
earthly --push +migrate
```
Or apply terraform changes

```Dockerfile
apply:
    RUN --push terraform apply -auto-approve
```
```bash
earthly --push +apply
```
**NOTE**

Just like saving files, any command that uses `--push` will only produce output if called directly, `earthly --push +target-with-push` or via a `BUILD` command. Calling a target via `FROM` or `COPY` will not invoke `--push`.
