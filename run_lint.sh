#!/bin/bash

# npx eslint scripts/*.js


find scripts -type f -name '*.js' -not -name 'ical.js' -not -name 'i18n.js' -print0 | xargs -0 -I {} npx eslint {}
