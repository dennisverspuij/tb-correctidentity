#!/bin/bash

# version with "v" v2.0.0
VVERSION=$(git describe --tags)

# version without v: 2.0.0
VERSION=$(echo $VVERSION | sed s/v//)

# create a backup
cp manifest.json manifest.json_backup

# release version
sed -i "s/_VERSION_WILL_BE_FILLED_BY_MAKE_XPI_SCRIPT_/${VERSION}/g" manifest.json
zip -FS -r correct_identity_${VVERSION}.xpi LICENSE *.html scripts _locales schema.json manifest.json

# revert to backup
cp manifest.json_backup manifest.json

# development version without "strict_max_version"
sed -i "s/_VERSION_WILL_BE_FILLED_BY_MAKE_XPI_SCRIPT_/${VERSION}_dev/g" manifest.json
sed -i "s/\(\"strict_min_version\":[^,]*\),/\1/g;s/\"strict_max_version\":/\/\/ \"strict_max_version\":/g" manifest.json
zip -FS -r correct_identity_${VVERSION}_dev.xpi LICENSE *.html scripts _locales schema.json manifest.json

# revert to backup
cp manifest.json_backup manifest.json
rm manifest.json_backup
