#!/bin/bash

NAME=$(git describe)

zip -FS -r correct_identity_$NAME.xpi LICENSE *.html scripts _locales manifest.json 
