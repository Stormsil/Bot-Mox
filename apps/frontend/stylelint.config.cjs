module.exports = {
  overrides: [
    {
      files: ['src/styles/variables.css'],
      rules: {
        'color-no-hex': null,
        'function-disallowed-list': null,
      },
    },
  ],
  rules: {
    'color-no-hex': true,
    'function-disallowed-list': [/^rgb$/i, /^rgba$/i],
  },
};
