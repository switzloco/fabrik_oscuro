# Pocketful Stage 3

Build and start the HTTP service from this directory:

```sh
docker build -t pocketful-stage3 .
docker run --rm -p 8080:8080 -e PORT=8080 pocketful-stage3
```

The API and browser UI listen on `0.0.0.0`. Check readiness with `GET http://localhost:8080/health`.
State is held in memory and can be initialized with `POST /_test/reset`. Open `http://localhost:8080/` for the wallet.
