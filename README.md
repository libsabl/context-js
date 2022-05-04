# Single Package TypeScript Template

This repo contains a standard template project for a single TypeScript library package.

## How to use this template

1. Install `degit`:

    ```sh
    npm i -g degit
    ```

2. Clone the repo. Using `degit` gets you the repo content without the git history:

    ```sh
    degit https://github.com/libsabl/template-ts-lib-single my-project
    git init my-project
    ```

3. Replace `name`, `description`, and `contributors` in `package.json`.

4. Update copyright year / holder in [LICENSE](./LICENSE) and LICENSE_HEADER, which is a sample
for a standard copyright notice to include at the top of new code files. For convenience, you
can global find/replace the string `the Sable authors`.

5. See [SETUP.md](./SETUP.md) and try out the tooling from the command line and in VS Code.

6. Replace contents of `/src` and `/test` with your own code. Off you go!

## Developer setup

See [SETUP.md](./SETUP.md), [CONFIG.md](./CONFIG.md).
