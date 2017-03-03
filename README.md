# KMS Env

A tool used to encrypt environment and decrypt environment variables
using KMS to support passing of encrypted environment variables to
docker containers.

If you are looking for a way to pass environment variables to a
docker container in a secure manner, this tool aims to help.

# Requirements

- NodeJS v7.x
- A AWS Customer Master Key in KMS
- Docker

# How it works

### todo: configure AWS credentials

## Initializing an env file

To get started, you must create run the `init` command and specify
your KMS CMK ID or alias. You can find this in the AWS console: IAM > Encryption Keys

```bash
$ kms-env init [keyid] [filename]
```

Let's initialize a file called `test.env` using a CMK with alias `mykey`

```bash
$ kms-env init alias/mykey test.env
```

After running the `init` command, a `test.env` file will be created in your
 working directory.

It will contain the following:

```bash
KMS_DATA_KEY = [encrypted value]
```

You can now start adding secure environment variables to this file

## Adding secure variables

To add secure environment variables to your file you can use:

```bash
$ kms-env add [filename] [entries...]
```

Let's add the following environment variables:

- DATABASE_PASS = test123
- DATABASE_USER = alice

```bash
$ kms-env add test.env DATABASE_PASS=test123 DATABASE_USER=alice
```

The new environment variables should be added to your `test.env`:

```bash
KMS_DATA_KEY = [encrypted value]
DATABASE_PASS = secure:[encrypted value]
DATABASE_USER = secure:[encrypted value]
```

## Decrypting secure variables

Once you have exported the above environment variables in your an environment,
you can easily have them decrypted

```bash
$ export KMS_DATA_KEY = ...
$ export DATABASE_PASS = secure:...
$ export DATABASE_USER = secure:...


$ eval $(kms-env decrypt)
$ echo $DATABASE_PASS
$ test123
$ echo $DATABASE_USER
$ alice
```

The `decrypt` command will output export statements which you can run through `eval`
to have the secure environment variables replaced in place.

## Example: Secure environment variables to Docker container

