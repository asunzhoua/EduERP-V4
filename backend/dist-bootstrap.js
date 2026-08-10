// Runtime bootstrap: register tsconfig path aliases against the compiled dist/
// output so `node dist/main.js` can resolve @common/* @modules/* @events/* etc.
const tsconfigPaths = require('tsconfig-paths');

tsconfigPaths.register({
  baseUrl: __dirname + '/dist',
  paths: {
    '@common/*': ['common/*'],
    '@modules/*': ['modules/*'],
    '@events/*': ['events/*'],
    '@database/*': ['database/*'],
    '@config/*': ['config/*'],
    '@utils/*': ['utils/*'],
  },
});

require('./dist/main.js');
