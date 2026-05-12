import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';
import { PublisherGithub } from '@electron-forge/publisher-github';
import { FuseV1Options, FuseVersion } from '@electron/fuses';

const config: ForgeConfig = {
  packagerConfig: {
    icon: 'icon',
    asar: {
      unpack: '**/node_modules/better-sqlite3/**/*',
    },
    prune: true,
    ignore: (file: string) => {
      if (!file) {
        return false;
      }

      // Exclude non-essential files from the package
      const excludedPatterns = [
        '/.map',
        '/.md',
        '/.ts',
        '/LICENSE',
        '/changelog',
        '/CHANGELOG',
        '/.eslintrc',
        '/tsconfig',
        '/.prettierrc',
        '/forge.config',
        '/postcss.config',
        '/tailwind.config',
        '/vite.',
        '/src/',
      ];

      for (const pattern of excludedPatterns) {
        if (file.endsWith(pattern) || file.includes(pattern)) {
          // Don't exclude if it's under /.vite (these are built files)
          if (file.includes('/.vite/')) continue;
          return true;
        }
      }

      // The Vite plugin defaults to excluding everything except `/.vite`,
      // which drops native runtime dependencies like better-sqlite3.
      const includedPaths = ['/.vite', '/node_modules', '/package.json'];
      return !includedPaths.some(
        (includedPath) =>
          file === includedPath || file.startsWith(`${includedPath}/`),
      );
    },
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({
      compression: 'maximum',
    }),
    new MakerZIP({}, ['darwin']),
  ],
  publishers: [
    new PublisherGithub({
      repository: {
        owner: 'Abu-ellil',
        name: 'etiquette-tailor-demo',
      },
    }),
  ],
  plugins: [
    new AutoUnpackNativesPlugin({}),
    new VitePlugin({
      // `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
      // If you are familiar with Vite configuration, it will look really familiar.
      build: [
        {
          // `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
          entry: 'src/main/index.ts',
          config: 'vite.main.config.ts',
          target: 'main',
        },
        {
          entry: 'src/main/preload.ts',
          config: 'vite.preload.config.ts',
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.ts',
        },
      ],
    }),
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};

export default config;
