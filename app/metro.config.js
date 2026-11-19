// The messenger lives outside app/ as a shared library (../packages/messenger, linked by npm as
// @holroyd/messenger). Metro must watch that folder, and the library's imports (ts-mls, @noble) resolve from
// app/node_modules, where npm installed them.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.watchFolders = [...(config.watchFolders ?? []), path.resolve(__dirname, '../packages/messenger')];
config.resolver.nodeModulesPaths = [...(config.resolver.nodeModulesPaths ?? []), path.resolve(__dirname, 'node_modules')];

// ENG-R5 (Nov 19 tech-debt review): the in-memory backend with its sample family (state/fakeRuntime) and the
// demo's frame (demo/DemoChrome) ship only in the builds that use them. Every other build gets the small
// ".off" file beside each one, so the phone app carries no fixture family or demo code.
const fake = process.env.EXPO_PUBLIC_HEARTH_FAKE === '1' || process.env.EXPO_PUBLIC_HEARTH_DEMO === '1';
const demo = process.env.EXPO_PUBLIC_HEARTH_DEMO === '1';
const offInRealBuild = [
  { re: /(^|\/)fakeRuntime$/, keep: fake },
  { re: /(^|\/)demo\/DemoChrome$/, keep: demo },
];
const upstream = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const swap = offInRealBuild.find((o) => !o.keep && o.re.test(moduleName));
  const name = swap ? `${moduleName}.off` : moduleName;
  return (upstream ?? context.resolveRequest)(context, name, platform);
};
module.exports = config;
