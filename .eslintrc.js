module.exports = {
  "root": true,
  "parserOptions": {
    "ecmaVersion": 2017
  },
  "env": {
    "browser": true,
    "es6": true,
    "webextensions": true
  },
  "plugins": ["promise"],
  "extends": [
    "eslint:recommended",
    "plugin:promise/recommended"
  ],
  "rules": {
    "max-len": ["warn", { "code": 120 }],
    "no-console": 0,
    "no-var": 1,
    "no-unused-vars": ["warn", { "vars": "all", "args": "all" } ],
    "no-undef": ["warn"],
    "no-proto": ["error"],
    "no-trailing-spaces" : ["error"],
    "prefer-arrow-callback": ["warn"],
    "prefer-spread": ["warn"],
    "prefer-template": ["warn"],
    "indent": ["error", 2, {"FunctionDeclaration" : {"parameters" : "first"},
                            "FunctionExpression": {"parameters": "first"},
                            "CallExpression": {"arguments": "first"}
                           }]
  }
};
