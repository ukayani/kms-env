# KMS Env ![Build Status](https://travis-ci.org/ukayani/kms-env.svg?branch=master)

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

## AWS Setup

1. Create a CMK in AWS. IAM > Encryption Keys
2. Give a user or role access to this key via the key's policy

By default, the tool will use the default credential chain for AWS.

You can specify Access Keys and Secret Access keys via Environment variables, or cli arguments.
If you are running the tool on an EC2 instance, the instance profile will be used.

### Usage

```bash
Usage: kms-env [options] [command]


  Commands:

    init [keyId] [file]      Initialize an environment variable file with provided CMK Id
    add [file] [entries...]  Adds environment variable to file after encrypting the value
    decrypt                  Decrypts secure environment variables and generates a bash export for each. Can be used with bash eval command to do in place decryption of env variables
    show [file]              Show the contents of the env file decrypting all secure vars. Warning: Only use for debugging!

  Options:

    -h, --help                        output usage information
    -V, --version                     output the version number
    -k, --access-key-id <id>          AWS Access key ID. Env: $AWS_ACCESS_KEY_ID
    -s, --secret-access-key <secret>  AWS Secret Access Key. Env: $AWS_SECRET_ACCESS_KEY
    -r, --region <region>             AWS Region. Env: $AWS_DEFAULT_REGION

```

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

