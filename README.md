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
    -p, --profile <name>              AWS Credential profile to use
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

The motivation behind creating kms-env was to securely pass sensitive environment
variables to an application running in a docker container in AWS

The `env` file created by `kms-env` can be used with the `docker run` command using the `--env-file [file]` argument.

### Step 1: Create a docker image with kms-env installed

To use `kms-env` to securely pass env vars to a docker container, the container needs kms-env installed.

**Example Dockerfile with node + kms-env**

An example docker file which has kms-env installed is provided at [Dockerfile](examples/Dockerfile)

You can use this docker file as your base image for your application image if you are building a NodeJs application.
If you are using a different platform (eg JVM) then you will also need to install the necessary dependencies for that platform.

**How it works**
The docker file uses an `env-decrypt` bash entrypoint script, so it will first run `kms-env decrypt` and then run whatever is supplied as a command to `docker run`

So, for example:

```
docker run [image] npm start
```

Assuming your image has the working directory set to a node project, the `npm start` command will run after the `kms-env decrypt`

### Step 2: Permissions to the CMK

In order for your container to decrypt environment variables, it will need read access to the CMK used to
encrypt the env vars.

To set up permissions, you will need to attach a policy to the role which is assumed by your AWS EC2 instance
or the task role (if you are using AWS ECS)

**Example IAM Policy Granting Access to a CMK**
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Action": [
                "kms:Decrypt"
            ],
            "Resource": [
                "arn:aws:kms:us-east-1:xxxxxxxxxz:key/xxxx-xxxx-xxxx-xxxx-xxxxxxxxxxx"
            ],
            "Effect": "Allow"
        }
    ]
}
```

The above policy, when attached to a role will give decrypt access for the CMK. You must supply the ARN for your specific key.

**ECS Task Role**
If you are running docker containers using AWS ECS, you would attach the above policy to the [Task Role](http://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-iam-roles.html) associated with your ECS Task Definition


### Step 3: Supplying an env file to your container

Once you have a container image that has `kms-env` installed and the container is running on an EC2 instance or ECS Task with
the correct permissions, you can supply your `env` files to your container.

**Supplying env via docker run**

If you are running docker on EC2 directly, you can use supply your `env` file via:

```docker
docker run --env-file [filepath] [image] [command]
```

The above command will run your container with the supplied env file as environment variables. If the container is using the example base image,
it will automatically decrypt the secure env vars in place for your application to read.

**Supplying env via ECS Task Definition**

To supply environment variables to a container running on ECS you will need to supply them via the task definition JSON

The following is an example task def (with some fields left blank) where we supply the environment variables which would be present in
a `.env` file generated by `kms-env`

**Example Task Def**
```json
{
    "family": "",
    "taskRoleArn": "",
    "networkMode": "",
    "containerDefinitions": [
        {
            "name": "",
            "image": "",
            "cpu": 0,
            "memory": 0,
            "memoryReservation": 0,
            "essential": true,
            "environment": [
                {
                    "name": "MY_VAR",
                    "value": "secure:xxxxxxxxx"
                }
            ]
        }
    ]
}
```

When the above task runs, it would supply the env vars to the docker container similar to the `--env` or `-e` argument for the `docker run` command.
