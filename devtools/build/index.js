const esbuild = require('esbuild');
const chalk = require('chalk');
const fse = require('fs-extra');
const bs = require('browser-sync').create();

const isDevEnv = process.argv.includes('--dev');
const outdir = 'dist';
const outdirFrontend = 'dist/public';

try {
  fse.rmSync(outdir, { recursive: true, force: true });
  fse.mkdirSync(outdir);
  fse.mkdirSync(outdirFrontend);
  fse.copyFileSync('public/index.html', `${outdirFrontend}/index.html`);
} catch (err) {
  console.error(`[${chalk.red('build script')}] initialize dist failed:`, err);
  process.exit(1);
}

Promise.all([
  esbuild.context({
    target: 'es2017',
    platform: 'browser',
    entryPoints: ['src/frontend/index.tsx'],
    outdir: outdirFrontend,
    bundle: true,
    minify: !isDevEnv,
    sourcemap: isDevEnv,
    plugins: [
      {
        name: 'on-end',
        setup(build) {
          build.onEnd((result) => {
            if (result.errors.length) {
              console.error(`[${chalk.red('build script')}] build frontend failed:`, result.errors.join('\n'));
            } else {
              console.log(`[${chalk.green('build script')}] build frontend success`);
            }
          })
        }
      }
    ],
  }),
  esbuild.context({
    target: 'node18.5',
    platform: 'node',
    entryPoints: ['src/backend/server.ts'],
    outdir,
    bundle: true,
    minify: !isDevEnv,
    sourcemap: isDevEnv,
    plugins: [
      {
        name: 'on-end',
        setup(build) {
          build.onEnd((result) => {
            if (result.errors.length) {
              console.error(`[${chalk.red('build script')}] build backend failed:`, result.errors.join('\n'));
            } else {
              console.log(`[${chalk.green('build script')}] build backend success`);
            }
          })
        }
      }
    ],
  }),
]).then(([frontendCtx, serverContext]) => {
  frontendCtx.rebuild();
  serverContext.rebuild();
  if(isDevEnv) {
    frontendCtx.watch();
    serverContext.watch();
    // HMR
    bs.init({
      files: [outdirFrontend],
      proxy: 'http://localhost:3000',
    });
  }
  console.log(`[${chalk.green('build script')}] build done!`);
}).catch((err) => {
  console.error(`[${chalk.red('build script')}] build failed:`, err);
  process.exit(1);
});

