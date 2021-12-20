#!/bin/bash

NAME=$(git describe --tags)

zip -FS -r correct_identity2_$NAME.xpi LICENSE *.html scripts _locales schema.json manifest.json

